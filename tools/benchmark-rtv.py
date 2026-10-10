"""Measure the released RTV garment generator; not an end-to-end try-on test.

Uses upstream code and a tensor-only checkpoint in .tools. DensePose, body-mesh
estimation, image capture, composition, network transport and quality are excluded.
"""
import argparse
import contextlib
import hashlib
import io
import json
from pathlib import Path
import statistics
import subprocess
import sys
import time

import torch

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=root / '.tools/rtv')
parser.add_argument('--weights', type=Path, default=root / '.tools/rtv-weights/lab_03_vmsdp2ta/latest_net_G.pth')
parser.add_argument('--iterations', type=int, default=12)
args = parser.parse_args()
if not 3 <= args.iterations <= 100:
    parser.error('iterations must be between 3 and 100')
if not torch.cuda.is_available():
    raise SystemExit('This benchmark requires CUDA; CPU performance would not prove the GPU path.')
sys.path.insert(0, str(args.source.resolve()))
from model.pix2pixHD import networks

checkpoint = torch.load(args.weights, map_location='cpu', weights_only=True)
digest = hashlib.sha256()
with args.weights.open('rb') as handle:
    for block in iter(lambda: handle.read(1024 * 1024), b''):
        digest.update(block)
evidence = {
    'source': 'https://github.com/ZaiqiangWu/RTV',
    'commit': subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', 'HEAD'], text=True).strip(),
    'checkpoint': str(args.weights.relative_to(root)), 'checkpointSha256': digest.hexdigest(),
    'device': torch.cuda.get_device_name(0), 'torch': torch.__version__,
    'scope': 'released garment generator only, synthetic conditioning tensors',
    'endToEndVerified': False, 'realismVerified': False, 'runs': [],
}
for dtype in [torch.float32, torch.float16]:
    with contextlib.redirect_stdout(io.StringIO()):
        generator = networks.define_G(6, 4, 64, 'global', 4, 9, 1, 3, 'instance', gpu_ids=[])
    generator.load_state_dict(checkpoint, strict=True)
    generator = generator.eval().to(device='cuda', dtype=dtype)
    frame = torch.zeros((1, 6, 512, 512), device='cuda', dtype=dtype)
    samples = []
    torch.cuda.reset_peak_memory_stats()
    with torch.inference_mode():
        for step in range(args.iterations + 3):
            torch.cuda.synchronize()
            started = time.perf_counter()
            output = generator(frame)
            torch.cuda.synchronize()
            elapsed = (time.perf_counter() - started) * 1000
            if step >= 3:
                samples.append(elapsed)
        if tuple(output.shape) != (1, 4, 512, 512) or not bool(torch.isfinite(output).all()):
            raise RuntimeError('Generator returned invalid RGBA tensors')
    evidence['runs'].append({'dtype': str(dtype), 'medianMs': statistics.median(samples),
        'minMs': min(samples), 'maxMs': max(samples), 'peakMemoryBytes': torch.cuda.max_memory_allocated(),
        'outputShape': list(output.shape), 'samplesMs': samples})
    del generator, frame, output
    torch.cuda.empty_cache()
directory = root / 'artifacts/rtv'
directory.mkdir(parents=True, exist_ok=True)
(directory / 'generator-benchmark.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence, indent=2))
