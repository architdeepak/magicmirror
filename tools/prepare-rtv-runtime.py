"""Keep the research ROMP/BEV model downloads inside the isolated RTV checkout."""
import json
from pathlib import Path
import sys
import sysconfig

root = Path(__file__).resolve().parents[1]
environment = root / '.tools/rtv-env'
if Path(sys.prefix).resolve() != environment.resolve():
    raise SystemExit('Run with .tools/rtv-env/bin/python; this tool never patches global packages.')
site = Path(sysconfig.get_path('purelib'))
cache = root / '.tools/rtv-weights/pose'
cache.mkdir(parents=True, exist_ok=True)
for module in ['romp', 'bev']:
    target = site / module / 'main.py'
    source = target.read_text()
    old = 'osp.join(osp.expanduser("~"),\'.romp\','
    new = f'osp.join({json.dumps(str(cache))},'
    count = source.count(old)
    if count:
        target.write_text(source.replace(old, new))
    elif new not in source:
        raise SystemExit(f'Unrecognized {module} model-cache layout; inspect it before patching.')
    print(f'{module}: isolated model cache configured ({count} replacements)')

utils = site / 'romp/utils.py'
source = utils.read_text()
source = source.replace("os.system('pip install wget')", "raise RuntimeError('Install wget in the RTV environment before downloading models.')")
utils.write_text(source)

texture = root / '.tools/rtv/OffscreenRenderer/off_screen_render.py'
source = texture.read_text()
old = 'np.array(list(img.getdata()), np.int8)'
new = 'np.array(list(img.getdata()), np.uint8)'
if old not in source and new not in source:
    raise SystemExit('Unrecognized RTV texture loader; inspect it before patching.')
texture.write_text(source.replace(old, new))
print('RTV texture bytes use uint8; automatic package installation disabled.')
