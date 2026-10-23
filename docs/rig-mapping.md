# Rig v1 mapping

Optional `cheekPuff.regions` drive compact cheek inflation through the `cheekPuff`
parameter (0…1). Each region has a zero-slope boundary; image-left moves left and
image-right moves right before the common head transform. Blush locations retain
their existing meaning. Optional `body.motion` adds torso turn and nod travel,
including shoulder influence, fading to zero at the lower `body.rollBand` edge.
Live tracking maps camera pitch to negative avatar `angleY` for downward nods,
normalizes `cheekPuff` against the calibrated neutral expression, and lets body
angles follow the face with a slower response. This torso response is secondary
motion inferred from the face; it does not track the user's shoulders independently.
Calibration now removes the neutral rotation matrix before extracting the head
angles. Pitch noise is suppressed inside a smooth 2–5° camera-angle onset zone;
horizontal rotation expands its lower threshold by up to 3°. Deliberate nods
beyond the onset zone retain full sensitivity, including while turned sideways.
Optional `sprites.json.pitchMorphs` aligns painted features in neutral coordinates
and replaces discrete view switching with continuous geometric/texture blending.

Coordinates use source-image pixels. Rotation angles use radians. Parameter ranges and
spring/motion tuning remain engine behavior constants.

| Rig fields | Reference source |
| --- | --- |
| image | rig.js IMG |
| head | HEAD, headWeight, turnWeight |
| head.pitch (optional) | applyHead neck-centred vertical projection and smooth face depth, shared by base, eye/mouth sprites and physics anchors; omitted data retains exact legacy deformation |
| head.pitch.views (optional) | independently rigged drawings; monotone crown/eyes/mouth/jaw/neck alignment, nearest-view selection with 1° hysteresis, and an 80ms premultiplied transition. Held angles use one drawing to avoid persistent contour ghosts. |
| head.pitch.facePreservation (optional) | downward nod blends eye/brow-to-jaw regions into shared face translation, fading toward crown, head sides and neck; suppresses local vertical feature compression within that region |
| body.motion (optional) | applyBody secondary turn/nod and shoulder travel, pinned by rollBand |
| cheekPuff (optional) | compact cubic cheek weights, deformBase outward inflation before head/body transforms |
| body | BODY, breath/roll fade bands, chest and shoulder Gaussians |
| face, buns | baseWeights Gaussians and brow/jaw bands |
| eyes.opening, eyes.roi | build_layers.py EYES |
| eyes.x0/x1/top/bot | built/layers.json eyes (24 samples, authoritative pre-cut curves) |
| mouth | rig.js MOUTH and sprites.js MOUTH_AREA |
| cheeks | rig.js CHEEKS |
| strands | rig.js STRANDS |
| accessories | rig.js TASSELS, build_layers.py search boxes and redness thresholds |
| hand | rig.js bones, FOREARM_SHARE and weight bands; build_layers.py HAND_POLY, JAW_VISIBLE, JAW_X, BG_BEHIND_HAND |
| mesh | createMeshAvatar.js layer cell sizes and fine rectangle; sprites.js sprite cell |
| view | createMeshAvatar.js padTop/padSide defaults |
| view.gazeCenter (optional) | motion.js pointer-follow origin; defaults to head center when omitted |

The anatomical centers used by the deformation formulas (brow, eyes and chest) also come
from the matching rig Gaussian centers. Bun spring anchors use their Gaussian centers.
Optional groups are omitted or empty; no replacement miko-qipao coordinates are supplied.

Changes to eye polygons, hand cut-out geometry and accessory boxes mark layers stale.
Pre-cut eye curves and image rectangles are preserved until the planned layer builder runs;
editing a cut-out polygon alone cannot regenerate the missing image pixels by editing coordinates alone.

Strand polylines may have two or more nodes in the editor. Physics resamples their rest
positions to four nodes so the reference four-node spring algorithm remains unchanged.
The fixture's original four-node strands are used verbatim to preserve exact regression.

The image-specific deformation constants are mapped above. Image-processing kernel sizes and
color blending/inpainting algorithms belong to the planned layer builder.
