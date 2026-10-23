# lunarsim.org

Website for **LunarSim / Galatea** (visual place recognition on the Moon) and the game **Where on the Moon?**

- `site/` — the static website (no build step)
  - `index.html` home · `play/` the game · `sunlab/` Sun Lab · `research/` method and results
  - `data/trials.json` — 3,150 game rounds built from the LunarSim-VPR test set
  - `data/img/` — the test images (WebP) · `data/sunlab*` — Sun Lab renders and model ranks
  - `data/config.json` — game settings; **research data collection is off** (`"collect": false`)
- `functions/api/log.js` — Cloudflare Pages Function that stores anonymous game answers in D1 (only used when collection is switched on)
- `schema.sql` — D1 table for those answers
- `tools/` — scripts that regenerate the game data from the research repository

Research code, paper and benchmark: <https://github.com/RaunakDune/galatea-lunar-vpr>

## Deploy on Cloudflare Pages (one-time setup)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choose `RaunakDune/Galatea-web-deploy`.
2. Build settings: Framework preset **None**, Build command *(leave empty)*, Build output directory **`site`**. Save and deploy.
3. In the new project → **Custom domains** → **Set up a custom domain** → `lunarsim.org` (and optionally `www.lunarsim.org`).
   Because the domain is on Cloudflare, the DNS records are created for you.

Every push to `main` then redeploys the site automatically; other branches get preview URLs.

## Switching on research data collection (only after ethics approval)

The game can log anonymous answers (images shown, choice, response time, a random per-visit ID; no names, emails,
IP addresses or cookies) for research on how people and AI recognise places on the Moon. Using these data in
publications is human-subjects research, so get approval (or an exemption) from your institution's IRB first.

1. Create the database: `npx wrangler d1 create lunarsim-answers`, then `npx wrangler d1 execute lunarsim-answers --remote --file=schema.sql`.
2. Pages project → **Settings** → **Bindings** → add a **D1 database** binding named **`DB`** pointing to `lunarsim-answers`. Redeploy.
3. Set `"collect": true` in `site/data/config.json` (edit the consent text if your IRB requires different wording) and push.
4. Export data: `npx wrangler d1 export lunarsim-answers --remote --output=answers.sql` (or query with `wrangler d1 execute`).

Players see an opt-in checkbox (unticked by default); nothing is sent unless they tick it.

## Regenerating the game data

```bash
# from a checkout of galatea-lunar-vpr with extracted features (see its docs/REPRODUCE.md)
python tools/build_trials.py DATA_DIR FEATS_DIR path/to/ft1e-4_netvlad_s0/desc_test.pt site/data --images
cd galatea-lunar-vpr/src && python ../../Galatea-web-deploy/tools/build_sunlab.py ../../Galatea-web-deploy/site/data
```

Each round shows a query image, the correct map image and five distractors chosen by geometry only (other places
more than 25 m away with a similar heading). "Rover AI" is the paper's best global model (fine-tuned NetVLAD head,
seed 0); "Earth AI" is zero-shot DINOv2-SALAD. Both picks are among the same six images the player sees.

## License

MIT (code and LunarSim renders). Apollo photographs on the research page: NASA, public domain.
