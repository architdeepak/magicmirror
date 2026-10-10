"""Offline, non-generative garment extraction experiment on the development Spark.
Uses the separately installed FASHN Human Parser. Its inherited NVIDIA license
restricts use to research/evaluation. It is not integrated or distributed with
the app. This script does not bundle its weights.
"""
import argparse, json, os, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('HF_HOME', str(ROOT / '.tools/fashn-cache'))
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import numpy as np
from PIL import Image, ImageOps
import torch
from fashn_human_parser import FashnHumanParser

parser = argparse.ArgumentParser()
parser.add_argument('--image', action='append')
parser.add_argument('--category', choices=['top','outerwear','dress','skirt','bottoms'], default='top')
args = parser.parse_args()
label = {'top':3,'outerwear':3,'dress':4,'skirt':5,'bottoms':6}[args.category]
images = [Path(p) for p in args.image] if args.image else [ROOT/'artifacts/fashn/garment0.png', ROOT/'artifacts/fashn/person0.png',ROOT/'.tools/rtv/assets/garment_images/lab_06_white_bg.jpg']
out = ROOT/'artifacts/clothing-extraction';out.mkdir(parents=True,exist_ok=True)
device = 'cuda' if torch.cuda.is_available() else 'cpu'
start=time.perf_counter();model=FashnHumanParser(device=device)
if device=='cuda':torch.cuda.synchronize()
load_seconds=time.perf_counter()-start
results=[]
for index,file in enumerate(images):
    image=ImageOps.exif_transpose(Image.open(file)).convert('RGB');image.thumbnail((1024,1024))
    if device=='cuda':torch.cuda.reset_peak_memory_stats()
    started=time.perf_counter();seg=model.predict(image)
    if device=='cuda':torch.cuda.synchronize()
    seconds=time.perf_counter()-started
    mask=(seg==label).astype(np.uint8)*255
    rgba=np.asarray(image.convert('RGBA')).copy();rgba[:,:,3]=mask
    selected=Image.fromarray(rgba);bbox=selected.getbbox()
    if bbox:selected=selected.crop(bbox)
    output=out/f'{index}-garment.png';selected.save(output)
    Image.fromarray(mask).save(out/f'{index}-mask.png')
    result={'input':str(file.relative_to(ROOT)), 'category':args.category,'device':device,'inferenceSeconds':seconds,'selectedPixels':int(np.count_nonzero(mask)),'fraction':float(np.count_nonzero(mask)/mask.size),'bounds':bbox,'output':str(output.relative_to(ROOT)),'peakGpuBytes':torch.cuda.max_memory_allocated() if device=='cuda' else None}
    results.append(result);print(json.dumps(result),flush=True)
report={'scope':'Actual offline human parsing and unchanged source RGB pixels, no image generation; development Spark, no live renderer integration or clothing fit validation. Outputs require visual review.','model':'fashn-ai/fashn-human-parser','cachedRevision':(ROOT/'.tools/fashn-cache/hub/models--fashn-ai--fashn-human-parser/refs/main').read_text().strip(),'loadSeconds':load_seconds,'results':results}
(out/'result.json').write_text(json.dumps(report,indent=2)+'\n')
