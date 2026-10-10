"""Measure actual local image try-on; never label these frames live video.
Run inside the isolated .tools/fashn-env after installing the author code and
weights. Public example inputs must already exist under artifacts/fashn.
"""
import hashlib
import json
import os
from pathlib import Path
import time

root = Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HOME', str(root / '.tools/fashn-cache'))
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
import torch
from PIL import Image
from fashn_vton import TryOnPipeline

output = root / 'artifacts/fashn'
weights = root / '.tools/fashn-weights'
start = time.perf_counter()
pipeline = TryOnPipeline(weights_dir=str(weights), device='cuda')
torch.cuda.synchronize()
load_seconds = time.perf_counter() - start
person = Image.open(output / 'person0.png').convert('RGB')
garment = Image.open(output / 'garment0.png').convert('RGB')
results = []
for steps in [10, 20]:
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.synchronize()
    start = time.perf_counter()
    result = pipeline(person_image=person, garment_image=garment, category='tops',
                      garment_photo_type='model', num_samples=1, num_timesteps=steps, seed=42)
    torch.cuda.synchronize()
    seconds = time.perf_counter() - start
    file = output / f'output-{steps}.png'
    result.images[0].save(file)
    results.append({'steps': steps, 'seconds': seconds, 'image': file.name,
                    'outputSize': result.images[0].size,
                    'peakAllocatedGpuBytes': torch.cuda.max_memory_allocated(),
                    'imageSha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    print(json.dumps(results[-1]), flush=True)
evidence = {'scope': 'Real local generated still images, offline inference with public author example photos; not moving video or PC-stick performance',
            'model': 'FASHN VTON 1.5', 'device': torch.cuda.get_device_name(),
            'torch': torch.__version__, 'loadSeconds': load_seconds,
            'modelSha256': hashlib.sha256((weights / 'model.safetensors').read_bytes()).hexdigest(),
            'inputs': {name: hashlib.sha256((output / name).read_bytes()).hexdigest() for name in ['person0.png', 'garment0.png']},
            'results': results}
(output / 'benchmark.json').write_text(json.dumps(evidence, indent=2) + '\n')
