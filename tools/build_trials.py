"""Build the 'Where on the Moon?' trial bank from the LunarSim-VPR test set.

For every test query: the correct database view (nearest true match: <10 m, <60 deg heading) and five
distractors chosen by geometry only (other places >25 m away with a similar heading, so neither model is
favoured): three spatial neighbours and two random places. Each AI's pick is its most similar option
among the same six images a player sees.
Usage: python build_trials.py DATA_DIR SALAD_FEATS_DIR FTNV_DESC OUT_DIR"""
import json, sys, os, numpy as np, torch
from PIL import Image

DATA, ZSDIR, FTNV, OUT = sys.argv[1:5]
TERR = ['t1001', 't1002', 't1003']
ftnv = torch.load(FTNV, weights_only=False)
trials, stats = [], {}
os.makedirs(f'{OUT}/img', exist_ok=True)


def yawdiff(a, b):
    return np.abs((a - b + 180) % 360 - 180)


for t in TERR:
    meta = json.load(open(f'{DATA}/test/{t}/meta.json'))
    db, q = meta['db'], meta['q']; ndb = len(db)
    zs = torch.load(f'{ZSDIR}/test/{t}/feats.pt', weights_only=False, mmap=True)['salad_zs'].float().numpy()
    nv = ftnv[t].float().numpy()
    dxy = np.array([[m['x'], m['y']] for m in db]); dyaw = np.array([m['yaw'] for m in db])
    for qi, m in enumerate(q):
        rng = np.random.default_rng(int(t[1:]) * 10000 + qi)
        dist = np.linalg.norm(dxy - [m['x'], m['y']], axis=1); yd = yawdiff(dyaw, m['yaw'])
        pos = np.nonzero((dist < 10) & (yd < 60))[0]
        if len(pos) == 0:
            continue
        ans = int(pos[np.argmin(dist[pos] + 0.05 * yd[pos])])
        far = np.nonzero((dist > 25) & (yd < 60))[0]
        if len(far) < 5:
            continue
        near = far[np.argsort(dist[far])][:12]
        pick = list(rng.choice(near, 3, replace=False))
        rest = np.setdiff1d(far, pick)
        pick += list(rng.choice(rest, 2, replace=False))
        opts = [ans] + [int(x) for x in pick]
        rng.shuffle(opts)
        ai = {}
        for nm, D in (('gal', nv), ('terr', zs)):
            s = D[ndb + qi] @ D[opts].T
            ai[nm] = int(np.argmax(s))
        a = opts.index(ans)
        trials.append({'t': t, 'q': m['file'][:-4].replace('+', ''), 'c': m['cond'].split('_')[0], 'az': m['az'], 'el': m['el'],
                       'o': [db[o]['file'][:-4].replace('+', '') for o in opts], 'a': a, 'g': ai['gal'], 'z': ai['terr']})
        st = stats.setdefault(trials[-1]['c'], [0, 0, 0])
        st[0] += 1; st[1] += ai['gal'] == a; st[2] += ai['terr'] == a
print(len(trials), 'trials')
for c in sorted(stats):
    n, g, z = stats[c]; print(c, n, f'gal {100*g/n:.1f}  terr {100*z/n:.1f}')
json.dump({'trials': trials, 'ai_acc': {c: {'n': v[0], 'gal': round(100 * v[1] / v[0], 1), 'terr': round(100 * v[2] / v[0], 1)}
           for c, v in stats.items()}}, open(f'{OUT}/trials.json', 'w'), separators=(',', ':'))
if '--images' in sys.argv:
    need = {(tr['t'], tr['q']) for tr in trials} | {(tr['t'], o) for tr in trials for o in tr['o']}
    for t, n in sorted(need):
        os.makedirs(f'{OUT}/img/{t}', exist_ok=True)
        Image.open(f'{DATA}/test/{t}/{n.replace("az90", "az+90").replace("az180", "az+180")}.png').convert('L').save(f'{OUT}/img/{t}/{n}.webp', quality=82, method=6)
    print(len(need), 'images')
