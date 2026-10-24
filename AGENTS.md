# Mesh Avatar Studio

This repository contains a local editor and a data-driven WebGL mesh avatar engine.
To create an avatar from an illustration, follow [docs/agent-guide.md](docs/agent-guide.md)
in order, including coordinate calibration, zoomed grids, overlays and pose review.
Field meanings are in [docs/rig-fields.md](docs/rig-fields.md).

## Default Codex avatar delivery

A general request to make an avatar includes drawn animation assets, not just a mesh
stretched from the neutral picture. Follow [docs/codex-authoring.md](docs/codex-authoring.md):
prepare and, after consent, use Codex imagegen to EDIT closed/half/smiling eyes,
speaking mouths, and up/down/image-left/image-right head drawings. Calibrate each
head drawing's own rig and eye/mouth sprites, package it with `tools/head-views.py`,
and visually review endpoints, intermediate angles and combined expressions.
Do not stop at masks/prompts when generation is available and authorized. Do not
silently substitute procedural eyes/mouths or stretch the frontal face and call the
drawn avatar complete. Respect an explicit request for mesh-only/local-only work.

Before any external image transfer, explain the source/masks, Codex image generation,
and the planned drawing set, and obtain consent once for that set unless it has already
been granted in this conversation. Copying Studio's request is not consent. If consent
or the generation capability is missing, finish all local preparation and report the
drawn assets as pending. Do not switch to another service or a paid API without consent.
Keep each view under the SAME `projects/<name>/head-views/<id>/` project tree; do not
create sibling avatar projects or overwrite the neutral source. Existing rigs and
already accepted drawings must be resumed rather than reinitialized.

- Keep user images and all derived files in `projects/`. Never commit, upload or copy them
  outside this repository. Ask the user before sending an image to any external service.
- `projects/` and scratch `work/` are ignored. Do not stage them or bypass their ignore rules.
- Keep `samples/` and `reference/` unchanged when preparing another illustration.
- Visually inspect generated images before reporting success; report remaining defects.

Use Node.js 22.17+ and regular Python 3.10–3.13 with `uv` (recommended: 3.12). Run:

```sh
npm run lint
npm test
npm run build
npm run build:runtime
npm run build:element
npm run build:react
npm run e2e
uv run --with numpy --with pillow --with opencv-python-headless tools/test_build_layers.py
uv run tools/test_agent_tools.py
uv run tools/test_head_views.py
```

The numerical deformation regression must remain 0 px (physics has floating-point tolerance).

## Prepare a cloned checkout for use

When the user asks to prepare, set up or make this project runnable (including
"준비해줘" or "실행 준비해줘"), prepare the launcher as part of that request on Windows:

1. Check Node.js 22.17+ and npm. If either is unavailable, explain the missing prerequisite
   and help set it up before building; do not report readiness while it is missing.
2. Run `npm ci` when dependencies are not installed, then
   `powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-launcher.ps1`.
   Use the default bundled-runtime build, so the user does not need Node.js on PATH later.
3. Verify `MeshAvatarStudio.exe`, `tools/launcher-runtime/node.exe` and
   `tools/launcher-runtime/node_modules/npm/bin/npm-cli.js` exist. Run the launcher with
   `--smoke-test` and verify it reports a ready local URL and stops its server on exit.
4. Tell the user to double-click `MeshAvatarStudio.exe` in this repository folder.
   Explain the browser flow: project selection, new project, illustration selection,
   copying the Codex request, then opening the avatar after rig/layer preparation.

The executable and bundled runtime are intentionally ignored local build outputs. Keep
them ignored; do not stage them or publish a release unless the user requests it.
Preparing the launcher does not authorize generating or sending any user image.
On macOS, keep the Windows launcher intact and prepare `MeshAvatarStudio.command`:

1. Check Node.js 22.17+ with npm. The `.command` uses the Mac's installed runtime;
   the bundled Windows `node.exe` is not usable on macOS.
2. Run `npm ci` if dependencies are missing. For avatar authoring, check uv, a regular
   Python 3.10–3.13 (recommended: `uv python install 3.12`) and Playwright Chromium
   (`npx playwright install chromium`). Run `node tools/doctor.mjs --lang ko`.
3. Verify the executable `.command` starts from outside the repository, opens the local
   project-selection page, and stops its server on Control+C and terminal close/SIGHUP.
   If download/extraction lost its executable bit, run `chmod +x MeshAvatarStudio.command`.
4. Tell the user to double-click `MeshAvatarStudio.command` in this folder. Keep its
   terminal open while editing/streaming; stop with Control+C or close that window.
   The browser's project/image/Codex handoff is the same as on Windows.

On Linux, use `npm start`. The `.exe` launcher remains Windows-only. Preparing any
launcher does not authorize external image transfer or image generation.

## Runtime compatibility

The `mesh-avatar` runtime has existing users. Add features without breaking them:

- Make new avatar features optional data, such as new sprite names or optional rig fields.
  An avatar without that data must render exactly as before; the regression stays 0 px.
- Older runtimes must keep working with avatars made for newer ones. They ignore sprite
  names and rig fields they do not know, so add new ones instead of changing the meaning or
  format of existing fields, sprite names and files.
- Keep the public API compatible: exports of `packages/runtime/src/index.ts`, its types,
  `createMeshAvatar` options and methods such as `setExpression` and `setEmotion`. Add
  optional parameters or new methods instead of changing existing ones.
- Add a changeset only when a package under `packages/` changes: `minor` for a new feature,
  `patch` for a fix. Studio-only changes (the private root package) do not need one. Ask
  the person before any breaking (`major`) change.
Use `npm run validate-rig -- projects/<name>/rig.draft.json` before building and
`npm run render-poses -- projects/<name>` to produce local review images.
