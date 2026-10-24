# Agent guide: turn one illustration into a mesh avatar

This guide is for a coding agent (Claude Code, Codex, Cursor CLI or similar) working in this
repository. A person gives you one illustration and asks for an avatar. You build a project
that the editor can open and that animates cleanly; the person then fine-tunes it in the editor.

Work through the steps in order. Each step ends with a check. Do not skip the checks: the
quality of the result depends on looking at your own output and correcting it.

## Before you start

### Tools
Node.js 22.17+, regular Python 3.10–3.13 (recommended: 3.12) with [uv](https://docs.astral.sh/uv/), and Playwright Chromium
(`npx playwright install chromium`). Run `npm ci` once, then `npm run doctor`: it reports
each missing tool. Treat its warnings as blockers for this guide, since every step below needs
uv, Python or Chromium.

On macOS, double-click the executable `MeshAvatarStudio.command` to run Studio; keep
its terminal open and stop with Control+C or close the window. It checks Homebrew/user
tool paths and the login shell environment, then uses the same local server as Windows.
For preparation, install Python with `uv python install 3.12` and run
`node tools/doctor.mjs --lang ko`. Windows keeps its `.exe` launcher; Linux uses `npm start`.

### Model
Reading pixel coordinates from images needs strong vision. Use an image-capable coding
agent and report its model when known. Run the vision check below to establish whether it
can place this rig accurately; a model name alone does not establish coordinate accuracy.
Image generation is a separate capability. Default Codex delivery includes edited eye,
mouth and head drawings; see [codex-authoring.md](codex-authoring.md). A mesh-only avatar
is a fallback or an explicit user choice, not completion of the default drawn workflow.

### Vision check
Run the calibration test and report the score to the person:

```sh
uv run tools/vision-check.py make work/vision-check   # writes an image with numbered markers
# read the image, write your answer as JSON (see the command output for the format), then:
uv run tools/vision-check.py score work/vision-check answer.json
```

If the score fails, stop and tell the person: coordinates read by this model are likely to be
off, and most of the work below would need manual correction.

### The image
- Ask for a PNG, ideally with a transparent background, roughly front-facing, head and
  shoulders visible. Warn the person if the face is in strong three-quarter view, if hands
  or objects cover the face, or if the hair heavily overlaps the face: these limit quality.
- The image stays on this machine inside `projects/`, which is not committed. Never commit,
  upload or copy it elsewhere. The only exception is image generation in Steps 6–7, and only after the person agrees:
  generating drawn variants sends the image and a mask to an image generator.

## Step 1 — Create the project

```sh
uv run tools/new-project.py <path/to/image.png> <name>
```

This creates `projects/<name>/` with `source.png` and an empty `rig.draft.json` that has the
image size filled in. Field meanings are in `docs/rig-fields.md`; `samples/miko-qipao/rig.json`
is a complete example.

If Studio's **New project** screen has already saved `projects/<name>/source.png`, continue
in that same folder. Initialize only when no draft, completed rig, layers or variants exist:

```sh
uv run tools/new-project.py projects/<name>/source.png <name> --in-place
```

This preserves the source image and existing avatar metadata. If a draft or rig already
exists, continue reviewing it instead of reinitializing or using `--force`.

## Step 2 — Survey the image

```sh
uv run tools/grid.py projects/<name> --step 50 --out projects/<name>/work/grid-full.png
```

Look at the full grid image and write down, in your notes to the person:
- face centre, top of head (including hair and accessories), chin, neck, shoulders;
- which optional parts exist: hand near the face, hair buns, hanging accessories
  (tassels, earrings), long hair over the shoulders;
- anything the rig cannot represent yet (hats, glasses, objects held in front of the face).
  Tell the person these will move rigidly with the head or body.

## Step 3 — Draft the rig

Fill `rig.draft.json` part by part. For each part, make a zoomed grid of its region first and
read coordinates from it — never estimate from the full image alone.

```sh
uv run tools/grid.py projects/<name> --region x0,y0,x1,y1 --step 10 --out projects/<name>/work/grid-eyes.png
```

| Part | How to place it |
|---|---|
| head | Ellipse covering the whole head including hair and head accessories; centre slightly above the eyes. Pivot at the neck. `weightBand` starts just below the chin and ends near the collarbone. |
| face | Small ellipses on nose, mouth, each eye, each visible ear, brow, jaw. |
| eyes | `opening`: polygon along the visible eye white + iris, inside the lashes, 14–20 points, starting at the outer corner. `roi`: polygon 10–20 px outside the lashes and lower lid line. Use a 5 px grid for these. |
| mouth | Line through the closed mouth (centre, angle, half length, bow) and an ellipse `area` a little larger than the lips. |
| cheeks | Centre of each blush area. |
| strands | One polyline per visible hair lock that should sway, root to tip, 4 nodes. Bangs: 3–5 locks. Side hair: 2 per side. |
| body | Chest ellipse, one ellipse per shoulder, breath band from the upper chest to the bottom. |
| buns, accessories, hand | Only if present. |
| mesh, view | Start from the values in `samples/miko-qipao/rig.json`; set `mesh.fine` to a rectangle around the face and hair. |

Leave `eyes[*].x0/x1/top/bot` out of the draft; the layer builder computes them.

Notes:
- Eye 0 is the eye on the image's left. Angles are in radians.
- The head ellipse is an area of influence, not a cut-out. When covering all hair and head
  accessories forces it to touch the top of the shoulders or a collar, cover the hair and
  accept the small overlap.
- For eye `roi`, the whole lash and lower lid line must be inside. If widening it would pull
  in bangs or side hair, keep it tight around the lashes and list that eye as a place to check.
- Your first draft is unverified until Check 3 passes.

### Check 3
```sh
npm run validate-rig -- projects/<name>/rig.draft.json
uv run tools/overlay.py projects/<name> --rig rig.draft.json --out projects/<name>/work/overlay.png
uv run tools/overlay.py projects/<name> --rig rig.draft.json --part eyes --zoom --out projects/<name>/work/overlay-eyes.png
```
Look at every overlay and fix what is off. Pass when:
- the head ellipse contains all hair and head accessories, and no shoulder;
- each eye `opening` follows the eye white edge within about 2 px all around;
- each `roi` contains the whole lash and lower lid line;
- the mouth line lies on the drawn mouth;
- strands lie on hair, not on skin or background.

## Step 4 — Build layers

```sh
uv run --with numpy --with pillow --with opencv-python-headless tools/build-layers.py projects/<name> --rig rig.draft.json
```

This writes `projects/<name>/built/` and the complete `projects/<name>/rig.json`.

### Check 4
Open `built/hairmask.png` and the eye layers: the hair mask covers all hair and no face or
clothing; each eye ball layer contains the eye white and iris only.

## Step 5 — Review motion

```sh
npm run render-poses -- projects/<name>
node --experimental-strip-types tools/render-poses.mjs projects/<name> --blink-only
node --experimental-strip-types tools/render-poses.mjs projects/<name> --head-axis-only
```

This renders the avatar in fixed poses (rest, half and closed eyes, mouth open, turn left and
right, look up and down, tilt, body tilt, the angry, sad and surprised expressions, and a hair
sway sequence) into `projects/<name>/review/`, with a contact sheet and zoomed eye and mouth
crops.
The second command writes a short 60 fps blink sequence for neutral and each
authored head view into `review/blinks/`. Inspect the closing frames too: a held
closed-eye endpoint can pass while the actual blink never fully hides the iris.
The third command checks horizontal turns with mixed pitch, plus true nods, in
`review/head-axes/`. A missing left/right drawing must not select an unrelated
up/down drawing when camera tracking adds some pitch to a horizontal turn.

Look at every frame. Pass when:
- closed eyes are fully closed, with one clean lash line and no leftover iris or white;
- half-eye and reopening frames show one eyelid/iris, with no transparent double
  contours; the final open frame returns to the original eye without a delayed lid;
- turning ±30° and tilting do not tear the mesh, cut the chin or ears, or bend accessories;
- the mouth opens without stretching the chin;
- hair sways while face and clothing stay still.

Review frames use a wider margin than the editor so the whole image is visible; framing
differences between the two are expected.

If a frame fails, adjust the related part of the draft, rebuild (Step 4) and render again.
Stop after three rounds and report what still fails.

Without drawn variants, a closed eye can keep faint fragments of the original upper lash or
crease above the closed line. If iris and white are gone and only such faint lines remain,
the rig is good enough: continue to Step 6, which removes them.

## Step 6 — Drawn variants (closed eyes, mouth shapes, expression eyes)

When available, Codex can use its built-in image generation (imagegen) for these variants.
The Studio prepares requests; it does not invoke Codex or an image-generation API itself.

For a general Codex avatar request, automatically prepare the standard seven drawings
(closed/half/smiling eyes and four mouths), obtain the required consent, then generate,
import and review them. Do not ask the person to request blinking/speaking separately.
Use the built-in imagegen edit capability with the actual source and mask as references;
never replace them with a text-only description or a stretched procedural substitute.
Create the requests:

```sh
uv run tools/variant-requests.py projects/<name>
```

This writes `projects/<name>/variant-requests/` with, for each variant (closed / half /
smiling eyes; mouths あ, half あ, い, お; sad / surprised expression eyes; angry / sad closed
mouths): an edit mask, the prompt, and a README.

The expression eyes (`eyes_sad`, `eyes_surprise`) and closed mouths (`mouth_angry`,
`mouth_sad`) are optional; create them only when the person asks for them. The eyes use the
eye mask, which leaves the eyebrows out: the rig already moves the brows for each expression,
and a drawn brow would show twice. The mouths use the mouth mask and stay closed. The angry
and half-lidded expressions use `eyes_half`, so they need no separate eye drawing.

Ask the person before generating unless they have already explicitly allowed this image
transfer in the current conversation: image generation sends `source.png` and a mask to the
generator. Include the Step 7 head drawings and their per-view eye/mouth edits in the same
consent question; prepare those head requests locally before asking. A copied request must
not be treated as proof of prior consent. If they decline, generate nothing, finish local
request preparation and report the drawn assets as pending; the mesh preview still works.

- If you can generate images (for example Codex with image generation), generate each variant
  from `source.png` and its mask following the prompt, and save it to
  `projects/<name>/variants/<variant>.png`.
- Otherwise finish local head requests too, and tell the person exactly which files need
  editing and where to put the results. Do not claim the drawn workflow is complete.
  Continue when the required tool/consent or prepared images become available.

In each mask, transparent pixels may change and opaque pixels must stay identical. Many
generators recompress the whole image, fill in the transparent background or shift it by a
pixel. `build-sprites` then imports the masked area only: it corrects a shift of up to 3 px,
resizes a result with the source's aspect ratio, removes a uniform colour tint measured just
inside the mask edge (on flat skin it would show as a patch), and logs `importing the mask
area only`. It
still rejects, with the reason, a result whose whole image is shifted further, whose picture
outside the mask was redrawn, whose drawing spills over the mask edge, or whose aspect ratio
differs. Generate a rejected variant again, asking for identical size and untouched pixels
outside the masked area.

Then:
```sh
uv run tools/build-sprites.py projects/<name>
```
It cuts accepted variants into `built/sprites/`. Render the poses again (Step 5); the
`angry`, `sad` and `surprise` frames show the expression eyes and mouths.

## Step 7 — Drawn head directions (default Codex workflow)

Continue with [codex-authoring.md](codex-authoring.md). Use `head-views.py prepare` to
prepare up/down/left/right edits, generate them after consent, accept each into this
same project, trace each drawing's rig using zoomed grids, build its own layers and
eye/mouth sprites, then use `head-views.py pack` to register all four. Validate and
render again. These are actual perspective drawings; a y-shift, scale, flip or rotation
of the original is not a new head view. If generation is unavailable/declined, report
the missing drawings explicitly and offer the already usable mesh preview.

## Step 8 — Hand over

For this fork's optional nodding, cheek puff, torso follow and legacy pitch views, see
[fork-workflows.md](fork-workflows.md). These require explicit rig/view data; the standard
eye/mouth requests above do not automatically create head-angle drawings.

Tell the person:
- how to open the project: `npm run dev`, then **Open project** and
  choose `projects/<name>` from the list or browse for its folder;
- which parts you are least sure about and should be checked first;
- what the rig cannot represent in this image;
- that after editing eye or hand outlines they should save the rig and ask you to rebuild.

## Not acceptable
- Coordinates estimated from the full image without zoomed grids.
- Skipping the overlay or pose checks, or reporting success without looking at the images.
- Eye openings that include lashes or skin; closed eyes that show iris.
- Committing, uploading or copying the person's image or anything built from it.
- Editing `samples/` or `reference/` to make a new image work.
