# Alps to Bricks

Turn your Alp into a brick bust you can really build → **[bricks.alps.wtf](https://bricks.alps.wtf)**

Free · runs in your browser · no server, no AI, no tracking

## How to use

1. **Type your Alp number**, tap one of the examples, or hit **Surprise me**. A link like `bricks.alps.wtf/?alp=277` builds that Alp straight away.
   Or **design your own**: pick any head, glasses, body, accessory and background (or shuffle), then build it. Building an Alp by number loads its traits into the designer, ready to tweak. Designs get links too: `?seed=background-body-accessory-head-glasses`, the contract's seed order. The [Playground](https://alps.wtf/playground) on alps.wtf links every Alp it generates here.
2. **① Your bust**: watch it build in 3D, pick **Mini** (about 700 pieces, some 25 cm tall) or **XL** (about 2,000 pieces, some 50 cm tall), turn it with your finger or mouse. "More info" shows every check. Download a video of the build (square or 9:16).
3. **② Instructions**: flip through the step-by-step booklet on the page, then download it as a PDF or as a full kit (PDF + parts list).
4. **③ Buy the bricks**: see your shopping list, then **Buy at LEGO** (a Pick a Brick upload file) or **Buy on BrickLink** (a wanted list to paste). "Only parts LEGO sells" rebuilds your bust with parts LEGO sells and runs every check again.

## How it works

- **Exact pixels.** Each Alp's traits (background, body, accessory, head, glasses) live on Ethereum. The site reads them from the Alps token contract (`seeds(id)`, through a public RPC) and draws the 32×32 Alp with the same run-length-encoded artwork the contract uses (`src/alps/image-data.json`). No image detection involved. Seeds of the Alps minted so far ship with the site (`src/alps/seeds.json`), so they build instantly; newer Alps are read on demand.
- **Two sizes, square pixels, fewest pieces.** Mini: 1 pixel = 1 stud wide and 2.5 plates tall on average (rows alternate 3 and 2 plates: 8 mm, a stud's width). XL: 1 pixel = 2×2 studs and exactly 5 plates (16 mm). Every row keeps its exact height, but bricks aren't tied to rows: they're stacked every 3 plates through the whole height, and a stud cell takes a brick wherever the three plate levels it spans show one colour (or can't be seen). Plates only go where the colour changes mid-brick, mostly on the front, and where a detail needs to reach sideways to what holds it. Where to start each brick level is chosen for the fewest pieces. XL is hollow with 2-stud walls. The base takes the Alp's background colour.
- **All the way round.** The front is always the Alp, pixel for pixel, on one flat plane; everything else is interpretation, set per trait in `src/alps/traits3d.json`:
  - heads are `box` (full depth, square edges: TVs, consoles, cartons), `round` (the back curves in towards the outline: creatures, fruit, helmets), `flat` (half depth: signs, cards, slices) or `cylinder` (upright and round all the way round, front included, with their pattern carried round the back: the wine barrel, mugs, the cake, the trash can);
  - a head can have `rods` (its thin bits are one pixel deep, not slabs: handles, taps, candles) and `clear` colours shown in see-through bricks (the wine pouring from the barrel's tap, in trans-red);
  - accessories `around` carry on round the sides and back (stripes, checks, camo, jackets); `front` ones are printed on the chest, with the body's colour round the back (text, logos, ties, held objects);
  - goggles (every glasses trait with the pixel A on the strap clip) wrap the head with their strap, the A on both sides; noggles-style frames ("gnargles") have arms to the ears that hook down behind them. Symbols drawn in a near shade (the A, the 🤘 in a gnargles bridge) always keep their own brick colour.
- **Honest checks.** Every model is checked on its final piece list: studs connected, 0 floating pieces, 0 collisions, centre of mass over the base, weak joints. A failed check is shown, never hidden. **Every Alp minted so far builds solid in both sizes** (and with "only parts LEGO sells"). Trying every trait combination isn't possible (about 2 billion), so `scripts/alps-traits.ts` pairs every trait with every trait it can touch: each head with each pair of glasses, body and accessory, and each body with each accessory, the other traits varied: 108,496 Alps per size, **all solid in both Mini and XL** (about 610 pieces on average in Mini, 1,580 in XL; at most about 1,200 and 2,950). The test suite builds every trait at least once, in both sizes, on every deploy.
- **Order the bricks.** A Pick a Brick upload file in LEGO's own CSV format and a BrickLink wanted list. Element IDs come from [Rebrickable](https://rebrickable.com)'s free exports, built into `src/data/elements.json` by `scripts/build-elements.ts`. Nothing is sold here: you order and pay on LEGO or BrickLink.

The model builder (`src/core`) is John Karp's, from [Punk to Bricks](https://github.com/hs7j4yk4sz-boop/punk-to-bricks). For Alps it works on a 32×32 grid, treats the character as front-facing (thin parts sit in the middle of the depth, the back matches the front), matches solid brick colours only, and adds one repair: a detail hanging beside a part of another colour gets a set-back piece in its own colour reaching across.

## Modelling a head by hand

All 248 heads now have explicit models. [Review and modelling notes](MODEL_REVIEW.md) explain the object-specific recipes, fitted eyewear, offline 3D reviewer, and remaining physical-assembly limits. The automatic styles described above remain as a fallback; the main builder and trait gallery load the authored models.

Any head can be modelled properly, as what it really is, one voxel per pixel: **[HEADS.md](HEADS.md)** is the full brief (for people and AI models alike). In short: a head is `src/alps/heads/<head name>.json`, slices from the front to the back, each a 32×32 grid of characters with a palette (or a MagicaVoxel `.vox`). `npx tsx scripts/head-kit.ts <head>` gives you everything about a head to start from, `npx tsx scripts/head-check.ts <head>` checks a model and builds it on test Alps with drawings to look at, and the tests build every hand-made head with every family of glasses. The site's "More info" panel also downloads any head's current model.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests, including every Alp in both sizes
npm run build      # static site in dist/
npx tsx scripts/alps-all.ts            # build every Alp and report the checks
npx tsx scripts/alps-random.ts 1000 xl # random trait combinations
npx tsx scripts/alps-traits.ts mini 0 8 # one of 8 shards of the pairwise trait run (writes out/)
npx tsx scripts/alps-debug.ts 154 mini # where a model's loose pieces are
```

To refresh the bundled seeds after new Alps are minted, re-fetch `seeds(0…totalSupply-1)` from the token contract (`0xf59eB3e1957F120f7C135792830F900685536f52`) into `src/alps/seeds.json` as `{ "id": [background, body, accessory, head, glasses] }`. Not required: newer Alps are read from the chain anyway.

Deployed to Cloudflare Pages (`alps-bricks`) on every push to `main` by `.github/workflows/deploy.yml`.

## Notes

Fan project by [Alps](https://alps.wtf) · Not affiliated with, sponsored or endorsed by the LEGO Group or BrickLink. LEGO® is a trademark of the LEGO Group. Parts data: Rebrickable. No purchases, payments or personal data go through this site. Models are computer-checked, not physically build-tested.

Adapted from [Punk to Bricks](https://github.com/hs7j4yk4sz-boop/punk-to-bricks) by John Karp · NFT Morning, inspired by [@victormustar](https://x.com/victormustar)'s Microduck.

## License

[MIT](LICENSE). See also the [disclaimer](DISCLAIMER.md). Alps artwork is in the public domain.

The [interactive head workshop](./head-workshop.html) is included in production builds: inspect all 248 sculptures, fit any of the 200 glasses, compare source artwork and Mini/XL assemblies, and download editable head JSON. The workshop now includes a review queue with per head/eyewear decisions, pinned areas, notes and tags, a 32×32 depth-slice painter, 3D head and eyewear block editing, undo/redo, local autosave, and a portable review JSON export/import. Eyewear corrections are stored per head and style and rendered in both Mini and XL builds. On phones, the 3D view stays above the controls: choose Add, Remove, Recolour or Sample, then tap a block; the dark button switches between editing and rotation. Painting a depth slice highlights that layer in the 3D model while the rest remains faint. Edited heads export as valid recipe JSON; upload an exported review to integrate edits and feedback into the repository.
