"""Offline motion evaluation of the full released RTV renderer.

The comparison plays at source speed. Processing time is measured separately;
this file does not demonstrate a live camera stream or authorize deployment.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import time

import cv2
import numpy as np
import torch

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--video', type=Path, default=root / 'artifacts/rtv/sample_video2.mp4')
parser.add_argument('--frames', type=int, default=300)
parser.add_argument('--max-width', type=int, default=960)
parser.add_argument('--no-autotune', dest='autotune', action='store_false', default=True, help='Compare motion without cuDNN autotuning.')
parser.add_argument('--output-dir', type=Path, default=root / 'artifacts/rtv/motion')
parser.add_argument('--capture-masks', action='store_true', help='Save generated RGB and alpha layers at review frames without changing composition.')
parser.add_argument('--fp32', action='store_true', help='Compare original precision against mixed precision.')
parser.add_argument('--densepose-short-edge', type=int, default=512)
args = parser.parse_args()
if not 8 <= args.frames <= 1800 or not 320 <= args.max_width <= 1920:
    parser.error('Use 8–1800 frames and a maximum width of 320–1920.')
if not 256 <= args.densepose_short_edge <= 1024:
    parser.error('densepose-short-edge must be between 256 and 1024.')
video_path = args.video.resolve()
directory = args.output_dir.resolve()
directory.mkdir(parents=True, exist_ok=True)
capture = cv2.VideoCapture(str(video_path))
fps = capture.get(cv2.CAP_PROP_FPS)
ok, first = capture.read()
if not ok or not 1 <= fps <= 120:
    raise SystemExit('The test video could not be decoded with a valid frame rate.')
scale = min(1, args.max_width / first.shape[1])
width = int(first.shape[1] * scale) // 2 * 2
height = int(first.shape[0] * scale) // 2 * 2
torch.set_num_threads(4)
os.chdir(root / '.tools/rtv')
sys.path.insert(0, os.getcwd())
from VITON.viton_upperbody import FrameProcessor
from detectron2.data.transforms import ResizeShortestEdge

review_frames = {0, 30, 90, 180, 299}
diagnostic_layers = None
mask_evidence = []
if args.capture_masks:
    import VITON.viton_upperbody as viton_module
    original_overlay = viton_module.naive_overlay_alpha

    def capture_overlay(raw_image, generated_image, raw_alpha):
        global diagnostic_layers
        if index in review_frames:
            # Retain the arrays; disk writes happen after the timed pipeline call.
            diagnostic_layers = (raw_image, generated_image, raw_alpha)
        return original_overlay(raw_image, generated_image, raw_alpha)

    viton_module.naive_overlay_alpha = capture_overlay

processor = FrameProcessor(['lab_03_vmsdp2ta'], ckpt_dir=str(root / '.tools/rtv-weights'))
processor.load_all.join()
processor.switch_to_target_garment(0)
torch.backends.cudnn.benchmark = args.autotune
processor.densepose_extractor.predictor.aug = ResizeShortestEdge([args.densepose_short_edge] * 2, 1333)
encoder_log = (directory / 'encoder.log').open('wb')
encoder = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{width * 2}x{height}', '-r', str(fps),
    '-i', 'pipe:0', '-an', '-c:v', 'libvpx-vp9', '-threads', '2', '-deadline', 'realtime',
    '-cpu-used', '6', '-crf', '30', '-b:v', '0', str(directory / 'comparison.webm')],
    stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=encoder_log)
samples = []
changed = []
frame = first
try:
    for index in range(args.frames):
        if index:
            ok, frame = capture.read()
            if not ok:
                break
        frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)
        torch.cuda.synchronize()
        started = time.perf_counter()
        with torch.inference_mode(), torch.autocast('cuda', enabled=not args.fp32, dtype=torch.float16):
            result = processor(frame.copy())
        torch.cuda.synchronize()
        elapsed = (time.perf_counter() - started) * 1000
        if result.shape != frame.shape or not np.isfinite(result).all():
            raise RuntimeError(f'Invalid rendered frame {index}')
        samples.append(elapsed)
        changed.append(int((result != frame).any(axis=2).sum()))
        comparison = np.concatenate([frame, result], axis=1)
        cv2.putText(comparison, 'INPUT', (14, 28), cv2.FONT_HERSHEY_SIMPLEX, .8, (255, 255, 255), 2)
        cv2.putText(comparison, 'OFFLINE TRY-ON', (width + 14, 28), cv2.FONT_HERSHEY_SIMPLEX, .8, (255, 255, 255), 2)
        encoder.stdin.write(comparison.tobytes())
        if index in review_frames:
            cv2.imwrite(str(directory / f'frame-{index:03d}.jpg'), comparison)
        if diagnostic_layers is not None:
            source, generated, alpha = diagnostic_layers
            threshold = (alpha > 128).astype(np.uint8) * 255
            eroded = cv2.erode(threshold, np.ones((3, 3), dtype=np.uint8))
            prefix = directory / f'frame-{index:03d}'
            for label, layer in [('input', source), ('generated', generated),
                                 ('alpha', alpha), ('threshold', threshold), ('eroded', eroded)]:
                cv2.imwrite(str(prefix) + f'-{label}.png', layer)
            panels = []
            for label, layer in [('INPUT', source), ('GENERATED RGB', generated),
                                 ('RAW ALPHA', cv2.cvtColor(alpha, cv2.COLOR_GRAY2BGR)),
                                 ('FINAL MASK', cv2.cvtColor(eroded, cv2.COLOR_GRAY2BGR))]:
                panel = layer.copy()
                cv2.putText(panel, label, (14, 28), cv2.FONT_HERSHEY_SIMPLEX, .8, (255, 255, 255), 2)
                panels.append(panel)
            cv2.imwrite(str(prefix) + '-layers.jpg', np.concatenate(panels, axis=1))
            count, labels, components, _ = cv2.connectedComponentsWithStats((threshold == 0).astype(np.uint8))
            enclosed_holes = []
            for component in range(1, count):
                x, y, w, h, area = map(int, components[component])
                if x > 0 and y > 0 and x + w < width and y + h < height and area > 10:
                    region = labels == component
                    enclosed_holes.append({'bounds': [x, y, w, h], 'area': area,
                        'rawAlphaMedian': float(np.median(alpha[region])),
                        'generatedMeanBgr': generated[region].mean(axis=0).round(2).tolist()})
            mask_evidence.append({'frame': index, 'positiveAlphaPixels': int((alpha > 0).sum()),
                'thresholdPixels': int((threshold > 0).sum()), 'erodedPixels': int((eroded > 0).sum()),
                'pixelsRemovedByErosion': int(((threshold > 0) & (eroded == 0)).sum()),
                'enclosedHolesBeforeErosion': enclosed_holes})
            diagnostic_layers = None
        if index % 30 == 0:
            print(json.dumps({'frame': index, 'ms': elapsed, 'changedPixels': changed[-1]}), flush=True)
    blank = np.zeros((height, width, 3), dtype=np.uint8)
    with torch.inference_mode(), torch.autocast('cuda', enabled=not args.fp32, dtype=torch.float16):
        empty_result = processor(blank.copy())
    if not np.array_equal(blank, empty_result):
        raise RuntimeError('No-person frame retained generated clothing')
finally:
    capture.release()
    encoder.stdin.close()
    code = encoder.wait(timeout=60)
    encoder_log.close()
    if code:
        raise RuntimeError('Comparison encoder failed; inspect encoder.log')
if len(samples) < 8 or not any(changed):
    raise RuntimeError('The motion test produced no garment frames')
evidence = {'sourceFile': str(video_path), 'sourceSha256': hashlib.sha256(video_path.read_bytes()).hexdigest(),
    'frames': len(samples), 'inputFps': fps, 'inputDimensions': [width, height],
    'mode': 'offline full pipeline', 'mixedPrecision': not args.fp32,
    'densePoseShortEdge': args.densepose_short_edge,
    'cudnnAutotune': torch.backends.cudnn.benchmark,
    'warmMedianMs': statistics.median(samples[3:]), 'warmMaxMs': max(samples[3:]),
    'warmP95Ms': float(np.percentile(samples[3:], 95)),
    'changedFrames': sum(value > 0 for value in changed), 'changedPixelsPerFrame': changed,
    'frameTimesMs': samples, 'noPersonClearsGarment': True,
    'maskDiagnostics': mask_evidence,
    'temporalQualityApproved': False, 'liveUseReady': False}
(directory / 'result.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps({key: value for key, value in evidence.items() if key not in ['changedPixelsPerFrame', 'frameTimesMs']}, indent=2), flush=True)
