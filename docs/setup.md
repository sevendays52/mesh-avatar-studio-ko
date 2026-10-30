# Launcher and authoring environment setup

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
