# mesh-avatar

A WebGL runtime for 2D mesh avatars created with [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio). Load a `.mavatar` archive or an avatar folder into a canvas, then control its motion, voice level and expressions.

Optional rig data enables cheek inflation (`cheekPuff: { regions: [leftEllipse,
rightEllipse], displacement }`) via the `cheekPuff` parameter (0–1). Optional
`body.motion: { turn, nod, shoulder }` adds secondary torso travel in source pixels;
`bodyAngleY` (−10–10, positive up) controls its nod. Existing avatars without these
fields render as before. See [rig fields](../../docs/rig-fields.md) for placement
and validation constraints.

For React and Next.js, use [mesh-avatar-react](https://github.com/shinshin86/mesh-avatar-studio/tree/main/packages/react).

Optional `head.views: [{ id, angleX, angleY }]` selects independently rigged yaw/pitch
drawings with their own blinking and speaking sprites. Angle pairs are unique within
−30…30 degrees; neutral (0,0) is implicit. The selected drawing's anchor is subtracted
before residual animation, preserving its painted perspective. This is additive data;
avatars that omit it and existing `head.pitch.views` retain their rendering path.
See [Codex authoring](../../docs/codex-authoring.md) and [format](../../docs/format.md#drawn-head-views-yaw-and-pitch).

<p align="center">
  <img src="https://raw.githubusercontent.com/shinshin86/mesh-avatar-studio/main/docs/images/face-tracking.gif" width="400" alt="A Mesh Avatar Studio avatar following a face through a webcam">
</p>

To move an avatar with your own face and voice without installing anything, open the
[Player](https://shinshin86.github.io/mesh-avatar-studio/play/) in Chrome or Edge.

To embed an avatar with HTML, use [mesh-avatar-element](https://github.com/shinshin86/mesh-avatar-studio/tree/main/packages/element). It provides a `<mesh-avatar>` custom element and a standalone CDN script.

## Install

```sh
npm install mesh-avatar
```

The package is ESM and includes TypeScript declarations. Rendering requires a browser with WebGL. It has no React dependency; the animation loop starts automatically after loading.

## Get a `.mavatar` file

Open your project in Mesh Avatar Studio and choose **Export .mavatar** in the editor header.
The file holds the rig, the built layers, any drawn eye and mouth variants and a manifest,
so it is all the runtime needs. You can also pack a project folder from the command line
with `npm run pack-avatar -- projects/<name>` in the Studio repository.

## Load an avatar

Place an exported `.mavatar` file in your app's public assets and provide a canvas:

```html
<canvas id="avatar" width="720" height="960"></canvas>
```

```js
import { loadMeshAvatar } from 'mesh-avatar';

const canvas = document.querySelector('#avatar');
const avatar = await loadMeshAvatar(canvas, '/avatars/character.mavatar');
```

To load the unpacked folder instead, serve its `rig.json`, `built/` assets and optional `avatar.json` under a folder URL:

```js
import { loadMeshAvatar } from 'mesh-avatar';

const canvas = document.querySelector('#avatar');
const avatar = await loadMeshAvatar(canvas, '/avatars/character/');
```

Use one loading example per canvas. Asset URLs must be reachable by the browser; cross-origin hosting needs the appropriate CORS headers. You can also pass a `URL`, `Blob`, `ArrayBuffer` or `Uint8Array` to `loadMeshAvatar` for an archive.

## Drive the avatar

```js
// Idle motion and blinking are enabled by default.
avatar.setAutoIdle(true);

// While your app plays voice audio, feed its normalized loudness (0–1).
avatar.setSpeaking(true);
avatar.setVoiceLevel(0.6);

// Set an emotion for the spoken line, or a persistent expression overlay.
avatar.setEmotion('happy', { playMotion: false });
avatar.setExpression('smile');

// Apply tracked or posed parameters. Each call replaces the supplied overrides.
avatar.setParameters({ angleX: 10, gazeX: 0.25 }, 1);

// Optional framing: zoom about the canvas centre, then move right/down in canvas units.
avatar.setViewport({ zoom: 2, x: 0, y: 0.3 });
avatar.setViewport({ zoom: 1, x: 0, y: 0 }); // reset

// When the line finishes, return to idle and clear overrides.
avatar.setVoiceLevel(0);
avatar.setSpeaking(false);
avatar.setEmotion(null);
avatar.setExpression('neutral');
avatar.setParameters({});

// When removing the canvas or replacing the avatar:
avatar.destroy();
```

Emotion tags are `happy`, `sad`, `angry`, `surprised`, `relaxed` and `neutral` (or `null` to reset). Expressions are `neutral`, `smile`, `shy`, `surprise`, `halfLidded`, `angry`, `sad` and `wink`; `LIVE_EXPRESSIONS` exports that list. `PARAMS` exports the parameter IDs, ranges and defaults. Voice methods animate the avatar; your app handles audio playback.

`createMeshAvatar` and `loadMeshAvatar` also accept an optional `viewport` setting.
`setViewport` merges partial updates; `zoom` is clamped to 0.25–8 and `x`/`y` to −4–4.
Offsets use canvas widths/heights, positive right/down. Framing changes the projection
without increasing the framebuffer dimensions or modifying the rig. Omitted viewport
settings preserve the existing rendering. The `AvatarViewport` type is exported.

Avatars can opt into neck-centred nodding with `head.pitch: { maxAngle: 0.5, depth: 45 }`
in their rig. `angleY` (−30 to +30 degrees; positive looks up) drives the projection;
`maxAngle` is in radians (0–π/3) and `depth` is nonnegative source pixels. This adds
head foreshortening and face depth to the existing vertical travel. Eye and mouth
sprites follow the same transform. Omit `head.pitch` to keep legacy deformation;
older runtimes ignore this optional data. See the [rig field reference](https://github.com/shinshin86/mesh-avatar-studio/blob/main/docs/rig-fields.md).

Set `head.pitch.facePreservation` to `1` to preserve facial proportions on deep downward
nods. The face moves together while the crown and neck blend into the pose. Values
between `0` and `1` blend the effect; omission or `0` preserves previous pitch behavior.

For newly visible surfaces such as the crown of a bowed head, use optional drawn views:
`head.pitch.views: [{ id: 'down_half', angleY: -15 }, { id: 'down_full', angleY: -30 }]`.
Optional `sprites.json.pitchMorphs` correspondence grids let these drawings morph
continuously, aligning hair contours and facial details before blending. Without
the grids, the existing nearest-view transition remains unchanged. See the
[drawn view format](../../docs/format.md#drawn-pitch-views) for grid fields and validation.
Each view supplies its own rig and layer aliases in `sprites.json.pitchViews`, so eyes
and mouths remain animated at the new angle. Facial landmarks align between views;
held angles use one drawing, and changes dissolve over 80ms with 1° selection hysteresis.
All images remain ordinary sprite-manifest entries and are included in `.mavatar`
exports. Existing avatars and older runtimes retain their previous behavior. See
the [drawn view format](https://github.com/shinshin86/mesh-avatar-studio/blob/main/docs/format.md#drawn-pitch-views).

`loadMeshAvatar` releases archives it opens on `destroy()` or load failure; when passed an existing `AvatarPackage` from `openAvatar`, the caller owns it and must call `release()` after its last user is destroyed.

For custom loading or tooling, the package also exports `createMeshAvatar`, `openAvatar`, `packAvatar`, `unpackAvatar`, `validateAvatarFiles`, `parseManifest`, `parseRig`, `validateRig` and lighting settings. See the [avatar format reference](https://github.com/shinshin86/mesh-avatar-studio/blob/main/docs/format.md) for archive contents, validation and compatibility rules.

## License

The runtime is MIT licensed; see [LICENSE](./LICENSE). The browser bundle includes [fflate](https://github.com/101arrowz/fflate), with its MIT notice retained in the bundle.

Avatar artwork has its own license. Miko images and other sample artwork are **not included** in this npm package, and the runtime license does not grant rights to that artwork.
