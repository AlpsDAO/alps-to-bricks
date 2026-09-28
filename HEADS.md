# Modelling Alps heads in 3D

> Current implementation: all 248 heads now have explicit models. See [MODEL_REVIEW.md](MODEL_REVIEW.md) for the offline reviewer, generator, validation, and revised eyewear fitting. The original brief below describes the starting constraints; external frames, mounting rails and honest independent-assembly reporting supersede its frame-replacement and unconditional “good to go” assumptions.

A brief for whoever models the heads: a person, or an AI model with access to this repo.

## The job

[Alps to Bricks](https://bricks.alps.wtf) turns any Alp (a 32×32 pixel character; see [alps.wtf](https://alps.wtf)) into a LEGO bust you can really build. The front of every bust is the Alp's pixel art. Everything behind it (depth, sides, back, top) is 3D modelling.

Today each head's 3D shape is generated from its 2D art by rules: boxy, round, flat or cylindrical, sorted in `src/alps/traits3d.json`. Rules can't know what a thing really is, so many heads look wrong from the side and back. The wine barrel shows the problem: its iron hoops should circle it completely, but the automatic model can't get them right.

**Your job: model each head properly, as what it actually is, one file per head.** There are 248 heads. Start with the ones minted Alps wear most (`npx tsx scripts/head-kit.ts list`).

## What an Alp is made of

An Alp is 32×32 pixels in four layers, drawn in this order:

- **Body:** rows 21–31, columns 9–22.
- **Accessory:** drawn over the body.
- **Head:** roughly rows 0–20, though some go lower, like the barrel's stream of wine.
- **Glasses:** always rows 11–16, columns 7–22.

Every trait combines with every other: 248 heads × 200 glasses × 32 bodies × 182 accessories × 7 backgrounds.

The finished bust is three objects stacked:
- **The body:** one fixed shape for every Alp, with its colours and accessory on its surface.
- **The head:** yours to model, standing alone, resting on the body.
- **The glasses:** the builder's, standing alone, sitting on the head's front.

**Model the head only, not the glasses.** The builder makes the glasses: they're their own object, like real glasses or goggles on the character.

- **Always flat:** one plane across the front, level with your head's most forward point behind them.
- **Two voxels deep:** the front voxel is the pixel art; the back voxel is the frame's colour.
- **Their own pieces:** never shared with the head, and nothing fills in behind them. Where your head curves away behind the frame, like a barrel's sides, there's simply a gap.
- **The strap or arms come straight out of the frame's ends and run round your head's surface on the glasses' rows.** Where your head reaches past the frame, the strap also covers the head's front there, so it always meets the frame:
  - **Goggles** (165 of them) have a strap at rows 12–14 with a pixel "A" on the clip.
  - **Gnargles** (35) have arms at row 13 that hook down behind the ears.

So:

- **Model the whole face, including under the glasses.** `pixels.txt` shows the head without glasses. Whatever glasses an Alp wears replace your head's front two voxels where they sit, and your head shows everywhere else.
- **Give the head a surface at rows 11–16** that a strap can run round, with no deep notches there.
- **Keep loose details (drips, rings, sparks) off the glasses.** They must hang from the head itself.

## The model: one voxel per pixel

A head is a file named after it: `src/alps/heads/<head name>.json`. The name is the trait's filename without `head-`, e.g. `wine-barrel.json` for `head-wine-barrel`.

```json
{
  "head": "wine-barrel",
  "about": "An upright oak barrel: staves all round, three iron hoops circling it, a lid, a tap on the right pouring a stream of wine to the ground.",
  "front": 0,
  "palette": { "a": "#aaa6a4", "b": "#6b3f39", "e": "#b92b3c" },
  "clear": ["e"],
  "slices": [
    ["................................", "… 32 rows, top to bottom …"],
    ["… the next slice back …"]
  ]
}
```

- **`slices`:** the head from front to back. Slice 0 is the front layer. Each slice is 32 rows (top to bottom) of 32 characters (columns left to right, as you look at the Alp's front). `.` is empty. At most 32 slices.
- **`palette`:** maps each character to a colour in hex. Any colour works: the builder uses the nearest of the brick colours below. Use the art's own colours (listed in the kit) unless you have a reason not to.
- **`clear`:** characters to build in see-through bricks, for liquids and glass (e.g. the wine).
- **`front`:** how many voxels the head sits ahead of the torso's front. Optional, default 0.
- **`about`:** one or two sentences on what it is and how you modelled it.

**Scale.** One voxel is one pixel of the art, the same shape in both sizes the site builds:

| Size | One voxel in bricks | Torso depth |
|---|---|---|
| Mini | 1 stud wide, one pixel-row tall (8 mm cubes) | 8 voxels |
| XL | 2×2 studs, 5 plates tall (16 mm cubes) | 8 voxels |

The torso takes the first 8 slices (0–7). A head may be deeper when its design needs it, up to its own width: a barrel is as deep as it is wide. Use `front` to sit a deep head forward so it stays centred over the torso. For example, a 16-deep barrel with `"front": 4` spans 4 voxels in front of the torso to 4 behind it.

`.vox` files from [MagicaVoxel](https://ephtracy.github.io/) work too: x = column, y = depth (0 = front), z = height (0 = the bottom row). `.json` is preferred: it's readable, easy to review, and diffs cleanly.

## The rules

1. **From the front, it's exactly the art.**
   - Every pixel of the head's art needs a voxel at its (row, column).
   - No voxel may sit at a (row, column) where the art is empty.
   - The front-most voxel at each position always shows the art's pixel: the builder paints it with the art's colour whatever you put there.
   - The front doesn't have to be flat. Push parts forward or back for relief: raised buttons, a recessed screen, a bulging belly, a curved barrel. It just has to project to the art.
2. **The head stands alone.** The head is built from its own pieces, never shared with the body or the glasses: you could build the head by itself, like the glasses, then set it on the body.
   - Give it a solid core, and have its details (drips, antennae, arms, leaves) hang from the head itself, never from the body.
   - `head-check` reports whether the head holds together on its own in each build. Aim for one piece in both sizes. XL (2×2 studs a voxel) makes that easy; Mini (1 stud a voxel) needs thought, because one-stud details in different colours only bond through a solid core behind them.
   - The body is the same shape on every Alp, with its designs on its surface. It isn't yours to model.
3. **Model what it is.** Read the name and look at the art (the kit draws both). Then shape the sides, back, top and depth as the real object would be, in the blocky, clean style of the art:
   - Patterns that go all the way round should go all the way round: staves, hoops, stripes, fur, bark.
   - Things with a back should have a proper back: the back of a TV, the far side of a fruit.
   - Thin things should be thin: handles, stems, straps and streams can be one voxel.
4. **It has to hold together as real bricks.**
   - Every voxel needs something under it, or beside it on the same row, that bricks can connect to. Thin overhangs and loose bits get clear support bricks added, which look worse.
   - Keep a solid core that rests on the torso: rows 18–20, above columns 9–22.
   - `head-check` must end with **✓ good to go**. It builds your head on 12 Alps, covering every glasses family and different bodies, in both sizes.
5. **Only as deep as the design needs.**
   - A barrel is round from above, as deep as it is wide. A planet is a ball.
   - Most heads don't need that. The bomb reads well at the torso's depth, and so do boxes, faces and signs.
   - Never deeper than wide. Keep the head centred over the torso, using `front` when it's deeper than the torso.
6. **Thin things are thin.** A fuse, a string, a stem or a stream of liquid is one voxel: a rod, not a slab.

## Working on a head

```bash
npm install
npx tsx scripts/head-kit.ts list                  # every head, most worn first; ✓ = hand-made already
npx tsx scripts/head-kit.ts wine-barrel           # everything about one head → out/heads/wine-barrel/
cp out/heads/wine-barrel/current.json src/alps/heads/wine-barrel.json   # start from its current model
# …edit the slices, or write a script that generates them…
npx tsx scripts/head-check.ts wine-barrel         # problems, 24 test builds, drawings
npm test                                          # the full suite, hand-made heads included
```

`head-kit` writes these files to `out/heads/<name>/`:

| File | What it is |
|---|---|
| `art.png` | The head's art, big, without glasses |
| `alp.png` | The head on a whole Alp |
| `pixels.txt` | The art as text: one character per pixel, with its palette, the head's current style, and which minted Alps wear it |
| `current.json` | The head's current model in the format above. A starting point: usually wrong at the sides and back |
| `current.png` | That model drawn straight on from the front, right, back, left and top, plus two 3D views |

`head-check` writes these files to `out/heads/<name>/`:

| File | What it is |
|---|---|
| `model.png` | Your model from every side |
| `mini.png`, `xl.png` | Your model built in bricks on an Alp, at plate resolution |

**Look at the drawings after every change.** That's how you'll see that a hoop doesn't meet round the back, or that a stream stands off its tap. Each test build also prints a link that opens that Alp on the live site in 3D, but it shows the deployed head, not your local file.

**Generating is fine, and often better** for round and regular things: barrels, cans, fruit. Put the generator in `scripts/heads/<name>.ts` (it writes the JSON) and commit both, so the model can be tweaked and regenerated.

## Handing it in

- Work on a branch and open a pull request to `main` with a batch of heads (five to ten per pull request is easy to review).
- For each head, the pull request description gives:
  - its name;
  - one line on what it is and your main modelling decisions;
  - its `model.png`.
- The tests run on every pull request: every hand-made head must read cleanly, match its art from the front, and build solid on every glasses family in both sizes. Merging to `main` deploys to bricks.alps.wtf.

## Brick colours

Your colours are matched to the nearest of these. Use the hex values directly if you want to know exactly what you'll get.

Solid: `#f4f4f4` White · `#1b1b1b` Black · `#a0a5a9` Light Bluish Gray · `#6c6e68` Dark Bluish Gray · `#c91a09` Red · `#720e0f` Dark Red · `#fe8a18` Orange · `#f2cd37` Yellow · `#fff03a` Bright Light Yellow · `#e4cd9e` Tan · `#958a73` Dark Tan · `#f6d7b3` Light Nougat · `#d09168` Nougat · `#aa7d55` Medium Nougat · `#a95500` Dark Orange · `#582a12` Reddish Brown · `#352100` Dark Brown · `#bbe90b` Lime · `#4b9f4a` Bright Green · `#237841` Green · `#184632` Dark Green · `#9b9a5a` Olive Green · `#a0bcac` Sand Green · `#adc3c0` Light Aqua · `#36aebf` Medium Azure · `#9fc3e9` Bright Light Blue · `#0055bf` Blue · `#0a3463` Dark Blue · `#6074a1` Sand Blue · `#e4adc8` Bright Pink · `#c870a0` Dark Pink · `#923978` Magenta · `#4b2e8c` Dark Purple · `#ac78ba` Medium Lavender · `#e1d5ed` Lavender

See-through (for `clear`): `#eeeeee` Trans-Clear · `#aeefec` Trans-Light Blue · `#c91a09` Trans-Red

## What the builder does with your model

So you can predict the result:

- Each voxel becomes stud cells: one per voxel in Mini, 2×2 in XL. Within a row, cells sit at their depth; front-most voxels take the art's colours.
- The Alp's glasses are their own object: a flat frame two voxels deep, on one plane level with your head's most forward point behind them, made of their own pieces. They replace your head's voxels where they sit, and nothing fills in behind them. Their strap or arms are painted round your head's surface on the glasses' rows.
- Bricks are stacked through the whole model for the fewest pieces, with plates wherever colours change within a brick's height. Pixel rows keep their exact height, so the proportions are always right.
- Anything that can't be held gets a clear support column, or a hidden bridge piece at the back. The checks (floating pieces, collisions, balance) run on the final list of bricks.

The code is in `src/core/build.ts` (`useHeadModel`, `wearGlasses`) and `src/alps/headModel.ts` (the file format). You shouldn't need to change them. If a head needs something the format can't express, say so in the pull request.
