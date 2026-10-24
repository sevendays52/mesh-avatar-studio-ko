---
"mesh-avatar": minor
---

Add optional head.perspective data for a depth-aware yaw/pitch pinhole projection
shared by the head, eye and mouth meshes. Existing avatars retain exact legacy
deformation when the new data is absent or its yaw and pitch are zero.
