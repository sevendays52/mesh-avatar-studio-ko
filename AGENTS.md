# Mesh Avatar Studio

This repository contains a local editor and a data-driven WebGL mesh avatar engine.

## Avatar authoring

Start with `npm run authoring -- status projects/<name>` for an existing project,
then read [docs/authoring-workflow.md](docs/authoring-workflow.md). Read only the
relevant sections of [docs/agent-guide.md](docs/agent-guide.md) and
[docs/codex-authoring.md](docs/codex-authoring.md) as the work advances. Keep their
order: calibration, source-coordinate zoomed grids, rig, overlays, layers, motion
review, drawn variants and head views. Field meanings: [docs/rig-fields.md](docs/rig-fields.md).

A general avatar request includes the complete **39-drawing** workflow: neutral
closed/half/smiling eyes and four speaking mouths, four up/down/image-left/image-right
head drawings, and each head's own seven eye/mouth edits. Use Codex imagegen EDIT
when available and authorized. Do not silently reduce the set, substitute procedural
features, stretch frontal sprites onto turned faces, or call a mesh preview complete.
An explicit mesh-only/local-only request overrides the default.

Before external image transfer, prepare requests locally, explain the source/masks,
Codex image generation and complete planned drawing set, and obtain consent ONCE
for that set unless already granted in this conversation. Copying Studio's request
or an authoring receipt is NOT consent. Never switch service or use a paid API without
consent. If consent/capability is missing, finish local preparation and report drawings
as pending. Read codex-authoring's managed-output-path rule before generation.

Preserve source.png, accepted drawings, existing rigs and custom masks. Resume them;
never reinitialize an existing rig. Keep each head workspace in the SAME
`projects/<name>/head-views/<id>/` tree. Check head geometry/boundaries before making
its seven expression drawings. Record actual visual findings with `authoring reviewed`;
validation is not visual approval. Review endpoints, intermediate angles, blinks and
combined expressions, then report remaining defects. Receipts skip only unchanged
local work; they do not replace required calibration or visual review.

Keep user images and ALL derived files in ignored `projects/`. Never commit, stage,
upload or copy them outside the repository; ask before any external image transfer.
Keep `samples/` and `reference/` unchanged. Do not bypass ignore rules for `projects/`
or scratch `work/`.

## Setup and source changes

For prepare/setup/run requests (including 준비해줘/실행 준비해줘), follow
[docs/setup.md](docs/setup.md), including launcher verification for the current OS.
Preparing a launcher does not authorize image generation or transfer.

Before editing source, read [docs/development.md](docs/development.md) and run its
full required checks. Preserve runtime compatibility and 0 px deformation regression;
new avatar fields must be optional. Add a changeset only for changes under `packages/`
(minor feature, patch fix); ask before any breaking major change.
