# Stateful local authoring for Codex

The drawing set stays **39 images**: seven neutral eye/mouth drawings, four head
drawings and seven eye/mouth drawings for each head. No reduced-production selector
is provided. These commands orchestrate existing local tools; Studio does not call
Codex or an image API. Image transfer still needs explicit current-conversation consent.

## Start or resume

```sh
npm run authoring -- status projects/<name>
```

Status is read-only. It reports the next action, affected view, relevant guide and a
command, without source pixels, full logs or the entire rig. `.authoring/state.json`
inside the root project stores input/output SHA-256 receipts and visual review notes.
An absent receipt is **pending**, even if files exist; input or output changes make
it **stale**. Never regenerate accepted artwork merely because a receipt is missing.
The state is authoring-only: no runtime rig fields, sprite names or public APIs change.

Read agent-guide's **Before you start** on a new setup/model: check the environment
and perform the coordinate calibration before initializing/tracing a rig. A receipt
does not certify a different model's coordinate accuracy. Follow Steps 1–3 in order;
initialize in place only when neither rig nor other authoring assets exist. Keep all
calibration artifacts inside this project, for example `projects/<name>/work/vision-check`.

For an image-only project, `prepare` writes the full grid without creating or replacing
a rig. Use `tools/new-project.py ... --in-place` only under agent-guide's initialization
conditions. Templates supply field structure/defaults; **trace every view's actual
eyes and mouth from its own zoomed grids**, never transfer neutral eye polygons blindly.

## Coordinates, local build and head approval

Commands default to `--view neutral`; the four other workspaces use `--view left`,
`right`, `up`, `down`. They always remain beneath the same root project.

```sh
npm run authoring -- prepare projects/<name> --view left
# Inspect grids, trace that view's rig.draft.json (agent-guide Steps 2–3).
# Optional: apply only changed fields from a project-local JSON object:
npm run authoring -- rig projects/<name> --view left --patch head-views/left/work/rig-patch.json
npm run authoring -- build projects/<name> --view left
npm run authoring -- render projects/<name> --view left
```

`prepare` creates full/5px eye/mouth grids under the selected workspace's
`.authoring/geometry/`. Once traced, it includes full and zoomed overlays. `build`
validates the draft, builds layers, validates playback files and refreshes these
review materials. `render` runs the full pose, blink and head-axis renderers and
creates bounded review pages. Both commands skip current work; `--force` reruns
local calculations and never bypasses a review gate.

`rig --patch` merges changed object fields into the existing draft (arrays are replaced
in full), validates a temporary candidate and saves a backup before replacing the draft.
For example `{"mouth":{"cx":320,"area":{"cx":320}}}` preserves all other fields.
It never changes source dimensions/version or registers views. Trace coordinates from
the zoomed grids first; this helper automates JSON handling, not visual interpretation.

Inspect source grids, all overlays, hair/eye layers and every mesh pose. For each
head, also inspect `.authoring/geometry/head-comparison.png`: neutral and accepted
head use matching source coordinates, with the protected-mask boundary marked red.
Check identity, near/far eye widths, crown/chin perspective, scale, neck seams and
space for speaking mouths. This comparison is not a simulation of intermediate
angles; inspect actual packed transitions during final review.

After that actual visual check, record findings, including any defects:

```sh
npm run authoring -- reviewed projects/<name> --view left --scope geometry --note "Checked grids, overlays, mask boundary and mesh poses; ..."
```

This is the **head drawing/geometry checkpoint before seven eye/mouth drawings**.
The orchestrator refuses requests/imports with missing or stale geometry approval.
A source, rig, layer, comparison or root head-mask change invalidates it. Rendering
or successful validation alone never creates approval. The note records what the
agent saw, not a claim that the artwork is flawless. No extra user approval is needed
for this local checkpoint; the agent performs and records the visual review.

## Requests, image generation and import

```sh
npm run authoring -- requests projects/<name>
npm run authoring -- heads projects/<name>
```

Read codex-authoring's **Consent and generation** before asking once for the complete
set. `heads` prepares four head masks/prompts from the neutral source and retains an
existing plan. Existing head accept/revision operations remain in `tools/head-views.py`.
Prepare/inspect masks locally before transmission. A copied request, receipt, or a
previous conversation's review note is not current-conversation transfer consent.

`requests` never silently overwrites existing masks/prompts. If they exist without a
current receipt, inspect them against the current source/rig, then explicitly use
`requests --adopt` to retain reviewed custom requests. If they need regeneration,
preserve custom corrections and use `requests --refresh` deliberately; it invokes the
existing generator and replaces requests. If geometry changed, retrace/rebuild/review
first. Do not adopt old masks without checking the changed regions.

Use imagegen EDIT as described in codex-authoring, generating only missing/rejected
drawings from the correct accepted source. First finalize each head's perspective,
mask boundary and rig checkpoint; then make its seven eye/mouth drawings. Existing
drawings and revised sources stay preserved in their project/revision folders.

```sh
npm run authoring -- requests projects/<name> --view left
# With consent, imagegen edits head-views/left/source.png + masks into its variants/.
npm run authoring -- sprites projects/<name> --view left
npm run authoring -- render projects/<name> --view left
# Inspect all pages and original crops, then record actual findings:
npm run authoring -- reviewed projects/<name> --view left --scope final --note "Closures, speaking mouths, mesh poses checked; ..."
```

`sprites` requires all seven standard drawings, valid geometry and current requests;
it imports and validates them without generating substitutes. Optional expression
art is also fingerprinted so adding/editing it invalidates the import. A changed
variant requires import and motion review again; it does not require rebuilding an
unchanged base rig or regenerating the other six drawings.

## Register and review the complete avatar

```sh
npm run authoring -- pack projects/<name>
npm run authoring -- render projects/<name>
npm run authoring -- reviewed projects/<name> --scope final --note "All directions, intermediate angles, combined expressions and blinks checked; ..."
npm run authoring -- status projects/<name>
```

`pack` requires current build/geometry/request/import receipts for all five views
and final visual review of each non-neutral view. It uses the existing staged
`head-views.py pack` validation. Root final review must happen **after** pack. Changes
to any view or packed output invalidate the applicable receipts and the final status.
Registering `head.views` does not unnecessarily invalidate neutral geometry/builds.

Render outputs remain in `review/`, `review/blinks/`, `review/head-axes/`. Their
`.authoring/review/index.html` and `index.json` group **every frame** into separate
full/eye/mouth pages of at most eight images (1200×1440 each), with original-resolution
links. Inspect all pages; open original crops for lashes, seams and fine details.
Full-frame review and intermediate/combined poses remain mandatory. Sheets provide
navigation, not automatic acceptance or importable generated variants.

Open the same root project in Studio, check Engine ready and report pending work
and remaining defects. The Studio production panel reads the same fresh status and
copies a continuation request. Playback readiness is separate from drawn completion.

## Logs, failures and existing projects

Commands return compact JSON. Full subprocess output stays under the root project's
`.authoring/logs/`; read the named log only when a command fails. A failed subprocess
does not receive a success receipt. An exclusive `.authoring/lock` prevents overlapping
orchestrator commands; if the process was terminated, confirm it ended before removing
the abandoned lock. Do not run legacy writes or editor saves concurrently with a command.
Inputs are checked again after subprocesses: a concurrent edit prevents the command
from recording its result as current, even if the subprocess itself exited successfully.

Existing projects/legacy tools remain usable. On first adoption, rebuild/validate local
derived files and perform the required visual checkpoints without recreating sources,
rigs or accepted drawings. Preserve and adopt custom masks explicitly. Nothing uploads
images, calls another provider, changes runtime output formats or automatically grants
consent. To compare efficiency, record cached/uncached input, output, generation/retry
counts and visual defects separately; no fixed subscription saving is promised.
