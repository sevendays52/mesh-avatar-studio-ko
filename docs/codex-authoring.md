# Codex automatic drawn-avatar authoring

## 기본 목표 / default scope

사용자가 아바타 제작을 맡기면 Codex는 좌표 교정·리그·레이어에서 멈추지 않고,
눈 감기와 발화 모양, 고개를 상하좌우로 돌린 **실제 편집 원화**를 제작·적용합니다.
사용자가 그림마다 프롬프트를 작성하거나 JSON을 수동으로 연결할 필요가 없습니다.
Studio는 요청을 전달하고 결과를 재생합니다. Studio 자체가 생성 API를 호출하지는 않습니다.

Follow `agent-guide.md` in order. The default drawing set is seven neutral eye/mouth
edits plus four head directions. Each head direction needs its own seven eye/mouth
edits: normally **39 full-size edited PNGs**, before retries. Sad/surprised expression
eyes and angry/sad mouths remain optional unless requested. Do not overwrite existing
accepted art; resume missing work. A mesh-only or local-only request overrides this default.

## Consent and generation

Prepare masks and prompts locally first. Explain that the project's source, accepted
head drawings and masks will be sent to **Codex's built-in image generation** to create
this set. Ask once for that set when the current conversation has no explicit consent.
A copied handoff request or a request to edit this repository is not image-transfer consent.
Consent for a set also covers correcting rejected results within that set; a new service
or materially expanded set requires new consent. Do not invoke an API/CLI fallback or
another provider on your own. Follow the available imagegen skill for actual tool calls.

Use edit mode and inspect each source locally before editing it. Supply the source and
mask as image references, and the request's prompt. Keep the character's identity,
costume, hair parting, accessories, palette, linework and transparent background.
Inspect generated pixels, not just success messages. Process one full-size output per
variant; a contact sheet is not an importable variant. Keep source.png unchanged.
All persistent local inputs, drawings and derivatives belong inside the original project.
If the generator saves first in a managed location outside it, do not silently violate a
user's stricter storage rule: disclose that requirement and obtain an exception before
generation, or leave generation pending. Include this in the SAME initial consent question,
not a second approval after permission was already granted for it. Immediately import authorized results into the
project; never make an extra external copy of the user's source for convenience.

For example: “눈·입·상하좌우 고개와 각 고개의 눈·입을 포함해 기본 39장을 편집합니다.
원본·각 고개 그림·마스크를 Codex 이미지 생성에 전송해도 될까요? 도구가 프로젝트 밖의
관리 출력 위치를 사용하면 결과를 즉시 이 프로젝트로 옮기는 예외도 함께 허용해 주세요.”
Only include the managed-output exception when the available tool actually requires it.

If the tool is unavailable or consent is declined/pending, finish masks/prompts and the
neutral mesh, list the missing drawings, and identify the result as a **mesh preview**.
Do not claim drawn-avatar completion. If generation is available and authorized, execute
it and continue through import and visual review instead of handing the requests back.

## 1. Neutral rig and eye/mouth drawings

Complete calibration, survey, zoomed grids, rig, overlays and the first layer/pose checks
from Steps 1–5. Then:

```sh
uv run tools/variant-requests.py projects/<name>
# Codex imagegen edits source.png + each selected mask; save full-size PNGs in variants/.
uv run tools/build-sprites.py projects/<name>
npm run render-poses -- projects/<name>
```

Generate `eyes_closed`, `eyes_half`, `eyes_smile`, `mouth_a`, `mouth_a_half`, `mouth_i`
and `mouth_o`. Review full closures, partial blinks and all vowel shapes. Remove all iris
and sclera in closed eyes. Mouth interiors must be drawn, with clean skin boundaries and
no displaced chin. Reject identity changes, a repainted body, missing alpha or seams.

## 2. Prepare and edit the four head drawings

```sh
uv run tools/head-views.py prepare projects/<name>
```

This writes `head-views/plan.json` and `head-views/requests/{left,right,up,down}/`
with `mask.png` and `prompt.md`. It sends nothing. Angles use avatar coordinates:
left = `angleX:-30` (nose toward image-left), right = `angleX:30`, up = `angleY:30`,
down = `angleY:-30`. Neutral (0,0) is implicit. Do not mirror asymmetric designs.
The default mask protects the neck attachment and the complete lower body. Review the
mask on the source before generation; locally refine it if the drawing needs a different
boundary. Preserve protected pixels and alpha, including long hair below the boundary.

After consent, use imagegen to redraw each perspective from the ORIGINAL neutral source
and that direction's mask. Do not generate a direction from another generated direction;
this compounds identity drift. Save the result within this project, for example
`head-views/results/left.png`, inspect it, then:

```sh
uv run tools/head-views.py accept projects/<name> left projects/<name>/head-views/results/left.png
```

Repeat for right/up/down. Accept rejects wrong dimensions, missing alpha and changes
to the protected body/background. It restores protected pixels exactly, keeps the
generated head alpha, and seeds `head-views/<id>/rig.draft.json` with EMPTY eye polygons.
As with expression imports, minor codec noise is judged on protected opaque pixels
(mean at most 16/255), with a stricter 12 px neck-edge band (mean at most 20/255 and
at most 12% over 48/255). It rejects body displacement over 3 px and new opaque
background coverage over 1%. These checks do not establish visual seam quality:
inspect the accepted drawing at the mask boundary too.
It refuses to replace an already accepted view. Existing neutral metadata is preserved.
Rejections require a corrected edit, not bypassing the check.

## 3. Rig and animate EVERY head drawing

Each `head-views/<id>/` is an authoring workspace INSIDE the same avatar project, not a
separate project in the Studio list. Repeat agent-guide Steps 2–6 there. Make fresh zoomed
grids and overlays, trace eyes and mouth, adjust the head/face/neck/hair regions and
validate before building. Never reuse the neutral eye polygons or stretch neutral
eye/mouth sprites onto the turned face. Preserve the neutral body rig and viewport margins
to avoid body/framing jumps. Generate all seven eye/mouth edits from THAT
view's accepted source and masks. The initial batch consent covers those edits.

```sh
npm run validate-rig -- projects/<name>/head-views/left/rig.draft.json
uv run --with numpy --with pillow --with opencv-python-headless tools/build-layers.py projects/<name>/head-views/left --rig rig.draft.json
uv run tools/variant-requests.py projects/<name>/head-views/left
# Codex imagegen creates the seven edits using this view's source and masks.
uv run tools/build-sprites.py projects/<name>/head-views/left
npm run render-poses -- projects/<name>/head-views/left
```

Repeat for each view. Inspect all layers, hair masks, closures, mouth forms and poses.
Keep any project-specific mask correction scripts in this same tree and reapply them
after rebuilding. Source perspective is already in the drawing: review at its own
neutral rig pose before packing, not by applying its anchor angle twice.

## 4. Register, validate and review the complete avatar

```sh
uv run tools/head-views.py pack projects/<name>
npm run validate-avatar -- projects/<name>
npm run render-poses -- projects/<name>
```

Pack requires all planned views and the standard eye/mouth sprites in the neutral and
every view. It embeds complete rigs, aliases and PNGs into the root `built/sprites/`,
registers `head.views` in both root rig files, and validates a complete staged candidate
before publishing. Ordinary `build-sprites.py` rebuilds preserve this data. Existing
legacy `head.pitch.views` must be migrated explicitly, not overwritten by this command.

Review every frame, including intermediate angles, switching boundaries on BOTH sides,
combined yaw/pitch, all four directions with eyes closed and speaking, and vowel shapes.
The runtime selects the nearest authored pose within 45° of the requested direction,
with 1° hysteresis and an 80ms transition. Unpainted sectors fall back to neutral,
so a horizontal turn with some tracked pitch cannot select an unrelated nod;
at its anchor it applies no second yaw/pitch deformation. Small residual motion between
anchors, roll, gaze, breathing and hair physics still use the mesh. This is a 2D painted
avatar, not a generated 3D model or a native Live2D Cubism `.moc3` export.

Do not mistake validation for visual quality. Four drawings can still pop at transitions
or lack a good diagonal. If needed, add individually authored intermediate/diagonal
poses to the plan (up to eight non-neutral poses), with their own masks, rigs and sprites,
then repack. Do not use persistent angle-based crossfades that leave double contours as
a substitute for aligned drawings. Stop after three repair rounds and report remaining
seams, silhouette changes, shading jumps, thin lashes or other defects honestly.

Open the SAME root project in Studio and confirm Engine ready. Report what was actually
generated/installed, what remains pending, reviewed poses, and where to rebuild. Do not
upload, commit or stage any private project assets.
