"""Render 'Sun Lab' images: three test places seen from the query pose under a grid of Sun directions,
plus, for each render, the rank of the true place among all 150 map images under the frozen Galatea model
(learned-lambda head, seed 0) and the database image of the place.
Usage (from the galatea-lunar-vpr/src directory, with GALATEA_* paths set):
  python build_sunlab.py OUT_DIR"""
import os, sys, json, numpy as np, torch
sys.path.insert(0, os.getcwd())
import paths, nets
from lunarsim import Terrain, render
from aggregators import OTHead
from PIL import Image

OUT = sys.argv[1]; os.makedirs(f'{OUT}/sunlab', exist_ok=True)
torch.set_num_threads(2); torch.set_grad_enabled(False)
T_ID = 't1001'; SEED = 1001
PLACES = [12, 57, 103]
AZ = list(range(0, 360, 45)); EL = [6, 15, 30, 60]
meta = json.load(open(f'{paths.DATA}/test/{T_ID}/meta.json'))
ndb = len(meta['db'])
q0 = {m['place']: m for m in meta['q'] if m['cond'] == 'C0_same'}
run = json.load(open(f'{paths.RESULTS}/runs/galatea_s0/results.json'))['info']['args']
head = OTHead(m=run['m'], l=run['l'], iters=run['iters'], mode=run['mode'], lam0=run['lam0'], dustbin=not run['no_dustbin'])
head.load_state_dict(torch.load(f'{paths.RESULTS}/runs/galatea_s0/head.pt', map_location='cpu')); head.eval()
dino = nets.DinoSalad().eval()
dbdesc = torch.load(f'{paths.RESULTS}/runs/galatea_s0/desc_test.pt', weights_only=False)[T_ID][:ndb].float()
T = Terrain(SEED)
out = {'places': []}
for p in PLACES:
    m = q0[p]
    Image.open(f'{paths.DATA}/test/{T_ID}/db_{p:04d}.png').convert('L').save(f'{OUT}/sunlab/p{p}_db.webp', quality=85)
    rec = {'place': p, 'db': f'sunlab/p{p}_db.webp', 'grid': {}}
    for el in EL:
        for az in AZ:
            img = render(T, m['x'], m['y'], m['yaw'], az, el, rng=np.random.default_rng(p * 1000 + az + el))
            fn = f'sunlab/p{p}_az{az}_el{el}.webp'
            Image.fromarray(img).save(f'{OUT}/{fn}', quality=85)
            x = nets.to_rgb_tensor([img], (210, 280))
            d = head(dino.forward_tokens(x))[0]
            sims = dbdesc @ d
            rank = int((sims > sims[p]).sum()) + 1
            rec['grid'][f'{az}_{el}'] = {'img': fn, 'rank': rank, 'sim': round(float(sims[p]), 3)}
            print(p, az, el, rank, flush=True)
    out['places'].append(rec)
out['az'] = AZ; out['el'] = EL; out['db_sun'] = [135, 30]
json.dump(out, open(f'{OUT}/sunlab.json', 'w'), separators=(',', ':'))
