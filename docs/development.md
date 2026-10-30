# Source development and compatibility

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
uv run tools/test_authoring_review.py
```

The numerical deformation regression must remain 0 px (physics has floating-point tolerance).


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
