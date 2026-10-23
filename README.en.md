# Mesh Avatar Studio KO

[한국어](README.md) · **English** · [日本語](README.ja.md)

An unofficial fork of [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio), originally created by **Yuki Shindo (shinshin86)**. This fork is maintained separately at [sevendays52/mesh-avatar-studio-ko](https://github.com/sevendays52/mesh-avatar-studio-ko), with Korean localization, additional avatar motion and a Codex-assisted authoring and review workflow.

Turn a single illustration into a 2D mesh avatar that blinks, talks, turns its head, breathes and sways its hair. Fine-tune it in a local editor with a live preview.

![Editor showing the Miko sample — upstream English UI example](docs/images/en/01-overview.png)

## What this fork adds

The editor, WebGL engine, expressions, lip sync, camera tracking, lighting and `.mavatar` sharing come from upstream.

| Area | Fork changes |
|---|---|
| Korean | Editor, Live, lighting, import/export, agent requests and environment diagnostics. English, Japanese and the existing Chinese UI remain available. |
| Head and torso | Optional rig data enables neck-centered nodding, face proportion preservation and torso follow. |
| Drawn head views | Codex authors yaw/pitch drawings with per-view rigs and eye/mouth sprites, then packages them automatically. Legacy pitch drawings and correspondence grids remain supported. |
| Tracking | Rotation relative to calibration, nod direction/sensitivity/inversion, mouth opening and mouth shape sensitivity. |
| Cheeks and preview | Cheek puff, mouth shape and upper body nod controls. Cheek deformation requires rig data. |
| Streaming | Avatar zoom and position, synchronized from Live to the OBS stream. |
| Authoring tools | Validation of new rig/view data, preservation of view assets during sprite rebuilds, pose review and regression coverage. |

New rig and sprite data is optional. Existing avatars without it retain their deformation, public runtime APIs and existing format meanings. Older runtimes may omit new effects. Drawings with different linework or shading can produce soft or overlapping lines at intermediate angles.

Korean localization covers local Studio and Live. Detailed technical documentation and the separate landing site/Player still include English and Japanese material. The [upstream landing site](https://shinshin86.github.io/mesh-avatar-studio/) and [upstream Player](https://shinshin86.github.io/mesh-avatar-studio/play/) are upstream services and do not include this fork's additions.

## Install and run

### Windows launcher

After cloning, open Codex in the repository and ask **“Prepare this project to run.”**
Following `AGENTS.md`, Codex checks prerequisites, installs missing packages and builds
the launcher with its runtime. Afterwards, start it by double-clicking the executable.

Double-click **`MeshAvatarStudio.exe`** in this working folder to start the local server and
open your browser. Keep it inside the repository together with `tools/launcher-runtime/`.
The bundled Node.js/npm are used; missing packages are installed on first launch (internet
required). Keep the launcher window open during editing or streaming. Closing it or choosing
**Stop Studio** stops the server. Launching it again reopens the browser for the running instance.

Choose **Projects → New project → Choose illustration → Create project**. Studio saves the
image and shows a Codex handoff. Copy the repository folder and request into Codex. Keep the
page open; when rig and layers appear, choose **Open avatar**. Unfinished projects remain in
the list. PNG bytes are preserved; JPEG/WebP images are converted to PNG locally.

The launcher and runtime are local build outputs excluded from Git. To build them in a fresh
clone, run once on Windows with Node.js/npm installed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-launcher.ps1
```

This uses the Windows C# compiler and copies your installed Node.js/npm into the local runtime.
`-WithoutRuntime` builds only the launcher and requires Node.js on the destination PC.
Codex still prepares the rig; Python, uv and Chromium remain separate authoring prerequisites.

### Terminal setup

Requires **Node.js 22.17+** and Git. Creating/rebuilding layers also requires **Python 3.10+ and uv**. Pose rendering requires **Playwright Chromium**.

```sh
git clone https://github.com/sevendays52/mesh-avatar-studio-ko.git
cd mesh-avatar-studio-ko
npm ci
node tools/doctor.mjs --lang en
npm run dev
```

Open the printed URL, such as `http://127.0.0.1:5173/`. Choose English, 한국어 or 日本語 in the header; the browser remembers your choice. Studio initially opens Miko. Use **Copy and continue editing** to work on a copy under `projects/`.

After installing uv, install missing authoring tools and run the diagnostics again:

```sh
uv python install 3.12
npx playwright install chromium
```

`npx create-mesh-avatar-studio` installs the **upstream repository**. Use the clone command above for this fork. On Windows, prefer Git over ZIP downloads and create `projects/` under your own account before asking an agent to work there. For access errors, check folder **Properties → Security**, including permission inheritance for files and subfolders.

## Create an avatar with Codex

**Ask your agent** prepares a message for you to copy. Studio does not launch Codex or invoke an image-generation API. An image-capable coding agent running in this repository uses the local authoring tools. This fork does not provide a separate Codex Skill installation or a trained model.

1. Use **New project** to choose an illustration and copy its Codex request. For manual setup, keep the illustration under `projects/<name>/`, open Codex in this repository and request:

   > Follow docs/agent-guide.md in order to create an avatar from projects/my-avatar/source.png. Include coordinate calibration, zoomed grids, rig overlays, validation, layer building and visual pose review. Report any remaining defects.

2. Choose the result in **Open project**. Check **Pose test** and **Lip sync**, then drag the part handles to fix placement. After changing layer-dependent outlines, use **Save and rebuild layers**.
3. Default Codex delivery includes edited blinking/speaking images and up/down/left/right head drawings. After explaining the set and obtaining image-transfer consent once, Codex generates, rigs, imports and visually reviews it. Unavailable generation is reported as pending artwork. Use **Drawn variants** for subsequent edits or optional expressions.
4. Each head drawing receives its own rig and eye/mouth sprites inside the SAME project, registered by `head-views.py pack`. Follow [automatic authoring](docs/codex-authoring.md); the [fork workflow guide](docs/fork-workflows.md) retains the legacy manual pitch-only path.

A roughly front-facing, head-and-shoulders PNG with transparency works best. Each illustration needs rig, mask and alignment adjustments; quality is not automatically guaranteed. Follow the [agent guide](docs/agent-guide.md) and [rig field reference](docs/rig-fields.md).

The text-driven mouth preview currently accepts Japanese hiragana and katakana and plays no audio. Vowel buttons and camera/microphone-driven mouth motion remain available in the Korean UI.

## Live and OBS

Open **Live** from your project, start the camera and calibrate while facing forward with relaxed eyes and a closed mouth. Adjust mirroring, sensitivity, smoothing, mouth controls, framing and lighting. Microphone-only use combines idle motion with voice-driven mouth movement.

Use **Copy OBS URL** and add it as an OBS Browser Source, for example at 1080 × 1080. Keep Live and the development server running. Transparent backgrounds are supported. Camera video and microphone audio are processed locally; the stream receives numeric motion and display settings. Keep Live in a separate window and bring it forward if tracking slows. See the [streaming reference](docs/reference.md#live-and-streaming).

## Save, share and protect your images

**Save rig** saves settings. **Export .mavatar** bundles saved rig, layers, expressions and metadata. Include the source to allow editing; excluding it still leaves built images in the archive. Import requires the development server and accepts up to 128 MiB.

Keep user images and all derivatives in ignored `projects/`; never commit or upload them. Ask before sending images to an external generator. Keep `samples/` and `reference/` unchanged. The code's MIT license does not grant rights to individual avatar images.

## Development and verification

```sh
npm run lint
npm test
npm run build
npm run build:runtime
npm run build:element
npm run build:react
npm run build:site
npm run e2e
uv run --with numpy --with pillow --with opencv-python-headless tools/test_build_layers.py
uv run tools/test_agent_tools.py
```

Existing deformation regression must remain **0 px**, with floating-point tolerance for physics. Before building an avatar, run `npm run validate-rig -- projects/<name>/rig.draft.json`. Afterwards, run `npm run render-poses -- projects/<name>` and inspect the images. Also review new effects with a project that supplies their optional data.

Changes under `packages/` need a changeset: minor for features, patch for fixes. Studio-only changes do not. Package names still match upstream; publishing this fork requires separate names and configuration. Automatic upstream npm releases are restricted to the upstream repository.

- [Fork workflow guide](docs/fork-workflows.md)
- [Agent guide](docs/agent-guide.md)
- [Reference](docs/reference.md)
- [Rig fields](docs/rig-fields.md)
- [Avatar format](docs/format.md)

## License and credits

Code: [MIT](LICENSE), original Copyright (c) 2026 Yuki Shindo. Retain the original copyright and permission notice when redistributing.

The sample Miko (`samples/miko-qipao/`) is not MIT-licensed: © Yuki Shindo (AITuber OnAir). Follow the [Miko guidelines](https://miko.aituberonair.com/#terms) and [sample asset terms](samples/miko-qipao/MIKO_ASSET_TERMS.md). Do not redistribute images alone or as an asset collection. This project is not an official AITuber OnAir product.

MediaPipe and Face Landmarker: © The MediaPipe Authors, Apache License 2.0. See the [MediaPipe license](vendor/mediapipe/LICENSE).
