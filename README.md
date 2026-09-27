# Alps to Bricks

Turn your Alp into a brick bust you can really build → **[bricks.alps.wtf](https://bricks.alps.wtf)**

Free · runs in your browser · no server, no AI, no tracking

## How to use

1. **Type your Alp number**, tap one of the examples, or hit **Surprise me**. A link like `bricks.alps.wtf/?alp=277` builds that Alp straight away.
2. **① Your bust**: watch it build in 3D, pick **Mini** (about 700 pieces, some 25 cm tall) or **XL** (about 2,000 pieces, some 50 cm tall), turn it with your finger or mouse. "More info" shows every check. Download a video of the build (square or 9:16).
3. **② Instructions**: flip through the step-by-step booklet on the page, then download it as a PDF or as a full kit (PDF + parts list).
4. **③ Buy the bricks**: see your shopping list, then **Buy at LEGO** (a Pick a Brick upload file) or **Buy on BrickLink** (a wanted list to paste). "Only parts LEGO sells" rebuilds your bust with parts LEGO sells and runs every check again.

## How it works

- **Exact pixels.** Each Alp's traits (background, body, accessory, head, glasses) live on Ethereum. The site reads them from the Alps token contract (`seeds(id)`, through a public RPC) and draws the 32×32 Alp with the same run-length-encoded artwork the contract uses (`src/alps/image-data.json`). No image detection involved. Seeds of the Alps minted so far ship with the site (`src/alps/seeds.json`), so they build instantly; newer Alps are read on demand.
- **Two sizes.** Mini: 1 pixel = 1 stud, rows alternate one brick and two plates so pixels stay square. XL: 1 pixel = 2×2 studs, 5 plates tall, hollow with 2-stud walls. The base takes the Alp's background colour.
- **Honest checks.** Every model is checked on its final piece list: studs connected, 0 floating pieces, 0 collisions, centre of mass over the base, weak joints. A failed check is shown, never hidden. **Every Alp minted so far builds solid in both sizes** (and with "only parts LEGO sells"), and so did 4,500 random trait combinations.
- **Order the bricks.** A Pick a Brick upload file in LEGO's own CSV format and a BrickLink wanted list. Element IDs come from [Rebrickable](https://rebrickable.com)'s free exports, built into `src/data/elements.json` by `scripts/build-elements.ts`. Nothing is sold here: you order and pay on LEGO or BrickLink.

The model builder (`src/core`) is John Karp's, from [Punk to Bricks](https://github.com/hs7j4yk4sz-boop/punk-to-bricks). For Alps it works on a 32×32 grid, treats the character as front-facing (thin parts sit in the middle of the depth, the back matches the front), matches solid brick colours only, and adds one repair: a detail hanging beside a part of another colour gets a set-back piece in its own colour reaching across.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests, including every Alp in both sizes
npm run build      # static site in dist/
npx tsx scripts/alps-all.ts            # build every Alp and report the checks
npx tsx scripts/alps-random.ts 1000 xl # random trait combinations
npx tsx scripts/alps-debug.ts 154 mini # where a model's loose pieces are
```

To refresh the bundled seeds after new Alps are minted, re-fetch `seeds(0…totalSupply-1)` from the token contract (`0xf59eB3e1957F120f7C135792830F900685536f52`) into `src/alps/seeds.json` as `{ "id": [background, body, accessory, head, glasses] }`. Not required: newer Alps are read from the chain anyway.

Deployed to Cloudflare Pages (`alps-bricks`) on every push to `main` by `.github/workflows/deploy.yml`.

## Notes

Fan project by [Alps](https://alps.wtf) · Not affiliated with, sponsored or endorsed by the LEGO Group or BrickLink. LEGO® is a trademark of the LEGO Group. Parts data: Rebrickable. No purchases, payments or personal data go through this site. Models are computer-checked, not physically build-tested.

Adapted from [Punk to Bricks](https://github.com/hs7j4yk4sz-boop/punk-to-bricks) by John Karp · NFT Morning, inspired by [@victormustar](https://x.com/victormustar)'s Microduck.

## License

[MIT](LICENSE). See also the [disclaimer](DISCLAIMER.md). Alps artwork is in the public domain.
