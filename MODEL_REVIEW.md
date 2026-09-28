# Object-specific Alps heads

This revision supplies an explicit voxel model for all 248 head traits, plus eyewear fitted to those models. The front-most voxel of every occupied head pixel has the original artwork's RGB value, and no source-model voxel projects outside that artwork. Actual brick builds necessarily use the available brick palette.

## Review the models

```sh
npm ci
npm run heads:review
# Open out/review/alps-head-workshop.html in a desktop browser.
```

The production build includes [the head workshop](./head-workshop.html); the trait gallery links to it. The single HTML file also works offline. Search all 248 heads; select any of the 200 glasses; switch between head sculpture, fitted eyewear, and complete Mini/XL brick assemblies. Drag to rotate, choose fixed front/back/side/top views, download a head JSON, or save a PNG. Mini/XL mode runs the real builder and displays its structural checks. The original head artwork remains beside the model.

The reviewer has now been smoke-tested in headless Chromium with WebGL: all 248 head choices and 200 glasses choices load, source/fitted/Mini/XL modes work, and search, navigation, camera presets and JSON download respond without JavaScript errors. Source geometry was also inspected using independently rendered front/right/back/left/top and two isometric views. This browser smoke test samples combinations; it is not exhaustive visual approval of every pairing.

## Where to edit

- `src/alps/heads/*.json`: the 248 runtime models, loaded by the existing custom-head loader.
- `scripts/heads/recipes.ts`: explicit named decisions for every head: depth, materials, secondary forms, thin details and rear patterns.
- `scripts/heads/generate.ts`: deterministic geometry construction constrained to the original RLE artwork. It does not use the old automatic head models as input.
- `src/core/eyewear.ts`: frame placement, head-dependent straps/arms, clip glyphs and concealed mounting rails.

```sh
npm run heads:generate -- wine-barrel   # regenerate one named model
npm run heads:generate                # regenerate all 248
node --import tsx scripts/head-check.ts wine-barrel
node --import tsx scripts/head-check.ts wine-barrel --strict
npm run heads:render                  # seven-view drawings for every head
npm test
npm run build
```

The shared geometry primitives are modelling tools, not a claim that these are official 3D Alps assets. Unseen surfaces are interpretations. Each name has an explicit recipe; there is no generic default for an unrecognised head.

## Modelling decisions

- Round objects receive volume on their front as well as their back. Barrels have circumferential staves and hoops; the barrel lid is wood. Planets, balls, fruit and eggs have distinct depth profiles.
- Electronics have casing material behind recessed displays and rear service details. Front faces and screen graphics are not stamped onto the back.
- Signs, cards, boards, blades and leaves stay shallow. Stems, fuses, wires, streams and rigging are individually shallow components.
- Heads representing whole animals or vehicles are treated as whole objects: torso, limbs, ears, tails, fuselage, cabin, wings and undercarriage get separate depth decisions.
- Cup interiors are open behind the visible rim. Saturn's thin ring is separated from the planet's volume. The pyramid has square horizontal sections.
- The front artwork remains authoritative even where it contains disconnected sparks, steam, fibres or dots.

## Visual refinement after the portable handoff

A second front/rear catalogue review refined 55 of the 248 generated heads:

- Animal skulls have fuller depth. Facial relief sits on a complete skull, so a muzzle no longer paints the back of the head. Explicit skull bounds stop broad ear rectangles from flattening the cranium.
- The owl has a cream facial disc and tawny back. The whole fox has separate head, torso, bushy tail and legs, with its white fur carried around the sculpture. Cow and whale markings also continue around their forms.
- The bomb has a fuller spherical shell. The paper roll has a cylindrical cross-section and recessed axial core.
- Rear electronics details use a subtle casing shade instead of borrowing bright or dark display colours. Car glazing and trim continue onto its other flank.

`Detail.surface`, `Recipe.bodyBounds` and `Recipe.wrapColors` in the editable recipes distinguish facial relief, skull volume and wrapping materials. Regression tests check recipe/model agreement, front-only muzzle material and the hollow paper-roll cross-section.

## Eyewear and build integration

The frame sits in front of the authored wearing surface instead of consuming its first two depth layers. Goggles follow the actual head cross-section and wrap behind it; gnargles arms terminate in proportion to head depth and hook down. Side rails and concealed rim tabs provide stud connections. These mounting features replace small portions of the head skin at contact points; they do not carve a two-voxel sheet out of every head.

The base expands to cover authored geometry and fitted eyewear, so automatic supports have somewhere to land. This can increase the footprint and piece count. The main builder, exports, and trait gallery now use the same head models. Exposed top tiles retain head/glasses ownership for meaningful independent-assembly checks. The geometry cache includes height so voxel previews cannot contaminate real-brick geometry.

## Validation and practical limits

The head suite checks the exact silhouette AND original RGB at the nearest voxel, depth no greater than width, and 24 builds per head: six glasses families, two body/accessory/background combinations, both Mini and XL. The full 248-head matrix is 5,952 builds. It checks floating pieces, collisions and centre of mass.

The full head suite can be split across processes without omitting cases:

```sh
HEAD_SHARD=0/4 npx vitest run test/heads.test.ts
HEAD_SHARD=1/4 npx vitest run test/heads.test.ts
HEAD_SHARD=2/4 npx vitest run test/heads.test.ts
HEAD_SHARD=3/4 npx vitest run test/heads.test.ts
```

A solid complete bust is not the same as a separately self-supporting head or pair of glasses. Several models still use multiple subassemblies and automatic supports. `head-check` now says so rather than printing an unconditional “good to go”; `--strict` returns a failure for separate assemblies that do not hold together. No physical assembly has been performed, and the 49,600 head/glasses pairings have not all been exhaustively tested. In particular, the dotted void and genuinely disconnected artwork cannot be a single connected exact-silhouette head without extra support geometry.

## Applying the handoff

The changes ZIP contains `changes/` with only added/modified repository files, a binary-safe Git patch and rendered previews. Copy the contents of `changes/` into the repository, or use `git apply --check alps-head-models.patch` followed by `git apply alps-head-models.patch`. Use one route only. The patch records the base revision in the handoff notes. Run `npm ci`, `npm test`, and `npm run build` before merging. The ZIP describes the original portable handoff; subsequent visual refinements are recorded above. Repository and deployment status are tracked in GitHub.
