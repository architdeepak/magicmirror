"""Evaluate the complete released RTV pipeline on a public still test photo.

Repeated still frames do not prove moving quality or temporal consistency.
Run with .tools/rtv-env/bin/python after preparing the isolated runtime.
"""
import json
import argparse
import os
from pathlib import Path
import statistics
import sys
import time

import cv2
import numpy as np
import torch

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--amp', action='store_true', help='Evaluate CUDA mixed precision; quality must be reviewed separately.')
parser.add_argument('--densepose-short-edge', type=int, default=800)
args = parser.parse_args()
if not 256 <= args.densepose_short_edge <= 1024:
    parser.error('densepose-short-edge must be between 256 and 1024')
directory = root / 'artifacts/rtv'
image = cv2.imread(str(directory / 'person.jpg'))
if image is None:
    raise SystemExit('Download the public MediaPipe pose.jpg fixture into artifacts/rtv/person.jpg first.')
torch.set_num_threads(4)
os.chdir(root / '.tools/rtv')
sys.path.insert(0, os.getcwd())
from VITON.viton_upperbody import FrameProcessor

processor = FrameProcessor(['lab_03_vmsdp2ta'], ckpt_dir=str(root / '.tools/rtv-weights'))
processor.load_all.join()
processor.switch_to_target_garment(0)
from detectron2.data.transforms import ResizeShortestEdge
processor.densepose_extractor.predictor.aug = ResizeShortestEdge([args.densepose_short_edge, args.densepose_short_edge], 1333)
stages = {}

def measure(owner, method, label):
    original = getattr(owner, method)
    stages[label] = []
    def wrapped(*args, **kwargs):
        torch.cuda.synchronize()
        started = time.perf_counter()
        result = original(*args, **kwargs)
        torch.cuda.synchronize()
        stages[label].append((time.perf_counter() - started) * 1000)
        return result
    setattr(owner, method, wrapped)

measure(processor.smpl_regressor, 'forward', 'bodyEstimation')
measure(processor.upper_body, 'render', 'bodyRasterization')
measure(processor.densepose_extractor, 'get_IUV', 'densePose')
measure(processor.viton_model, 'forward', 'garmentGenerator')
samples = []
for index in range(8):
    torch.cuda.synchronize()
    started = time.perf_counter()
    with torch.inference_mode(), torch.autocast('cuda', enabled=args.amp, dtype=torch.float16):
        result = processor(image.copy())
    torch.cuda.synchronize()
    elapsed = (time.perf_counter() - started) * 1000
    if index >= 3:
        samples.append(elapsed)
    print(json.dumps({'frame': index, 'ms': elapsed}), flush=True)
if result.shape != image.shape or not bool(np.isfinite(result).all()):
    raise RuntimeError('Pipeline returned invalid image data')
changed = int((result != image).any(axis=2).sum())
if not changed:
    raise RuntimeError('Pipeline returned unchanged input; no garment was generated')
from OpenGL.GL import glGetString, GL_RENDERER, GL_VENDOR
evidence = {
    'runtime': 'full RTV pipeline, repeated public test photo',
    'inputSource': 'https://storage.googleapis.com/mediapipe-assets/pose.jpg',
    'gpu': torch.cuda.get_device_name(0), 'cpuThreads': torch.get_num_threads(),
    'mixedPrecision': args.amp, 'densePoseShortEdge': args.densepose_short_edge,
    'glRenderer': glGetString(GL_RENDERER).decode(), 'glVendor': glGetString(GL_VENDOR).decode(),
    'inputShape': list(image.shape), 'changedPixels': changed,
    'medianMs': statistics.median(samples), 'samplesMs': samples,
    'stagesMedianMs': {name: statistics.median(values[3:]) for name, values in stages.items()},
    'movingQualityVerified': False, 'liveUseReady': False,
}
suffix = f'{"amp" if args.amp else "fp32"}-{args.densepose_short_edge}'
cv2.imwrite(str(directory / f'person-tryon-{suffix}.png'), result)
(directory / f'pipeline-benchmark-{suffix}.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence, indent=2), flush=True)
