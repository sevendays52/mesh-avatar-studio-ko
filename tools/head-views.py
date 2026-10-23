# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10.4", "numpy", "opencv-python-headless"]
# ///
"""Prepare, accept and package locally authored yaw/pitch drawings. Uploads nothing."""

import argparse
import copy
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import cv2
from PIL import Image, ImageDraw
from agent_common import ROOT, inside_repo, project_image, read_rig, save_json

POSES = [("left", -30, 0), ("right", 30, 0), ("up", 0, 30), ("down", 0, -30)]
REQUIRED_SPRITES = [f"eyes_{mood}_{i}" for mood in ("closed", "half", "smile") for i in (0, 1)] + ["mouth_a", "mouth_a_half", "mouth_i", "mouth_o"]


def scoped(project, path):
    result = inside_repo(path)
    if not result.is_relative_to(project):
        raise ValueError("all inputs and outputs must stay inside this project")
    return result


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def source_hash(project):
    return hashlib.sha256(scoped(project, project / "source.png").read_bytes()).hexdigest()


def plan_for(project):
    plan = read_json(scoped(project, project / "head-views/plan.json"))
    if not isinstance(plan, dict):
        raise ValueError("head-view plan must be an object")
    if plan.get("sourceHash") != source_hash(project):
        raise ValueError("source.png changed; review and prepare a new head-view plan")
    entries = plan.get("views", [])
    ids, poses = set(), set()
    if not isinstance(entries, list) or not 1 <= len(entries) <= 8:
        raise ValueError("head-view plan must contain 1 to 8 views")
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("each head view must be an object")
        name, x, y = entry["id"], entry["angleX"], entry["angleY"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name) or name == "neutral" or name in ids:
            raise ValueError("use safe unique view identifiers; neutral is reserved")
        if any(type(n) not in (int, float) or not math.isfinite(n) or abs(n) > 30 for n in (x, y)) or (x, y) == (0, 0) or (x, y) in poses:
            raise ValueError("use unique non-neutral poses within -30..30 degrees")
        ids.add(name)
        poses.add((x, y))
    return plan


def prepare(project):
    image, rig = project_image(project), read_rig(project)
    plan_path = scoped(project, project / "head-views/plan.json")
    if plan_path.exists():
        plan_for(project)
        print("Existing plan retained. Review its requests; no drawings or rigs were overwritten.")
        return
    # Leave the neck attachment and the entire lower body unchanged. Include empty
    # alpha around the head so a different silhouette can be painted inside it.
    h = rig["head"]
    lock_y = max(1, min(image.height - 1, int(h["pivotY"])))
    x0, x1 = max(0, int(h["cx"] - h["rx"] * 1.5)), min(image.width, math.ceil(h["cx"] + h["rx"] * 1.5))
    if x0 >= x1:
        raise ValueError("invalid head edit rectangle; validate the neutral rig first")
    mask = Image.new("RGBA", image.size, (255, 255, 255, 255))
    ImageDraw.Draw(mask).rectangle((x0, 0, x1 - 1, lock_y - 1), fill=(0, 0, 0, 0))
    entries = []
    for name, x, y in POSES:
        folder = scoped(project, project / "head-views/requests" / name)
        folder.mkdir(parents=True, exist_ok=True)
        mask.save(scoped(project, folder / "mask.png"))
        direction = {"left": "toward the IMAGE LEFT (nose moves left)", "right": "toward the IMAGE RIGHT (nose moves right)", "up": "upward, revealing the under-chin plane", "down": "downward, revealing the crown plane"}[name]
        scoped(project, folder / "prompt.md").write_text(
            f"Edit source.png as a full-size {image.width} x {image.height} RGBA PNG. "
            f"Redraw the same character's head {direction} at yaw {x}, pitch {y} degrees. "
            "Create actual new drawn perspective and contours, not a stretched/rotated frontal image. "
            "Keep identity, hair parting, accessories, ink weight, colours, neutral open eyes, closed mouth, scale and neck attachment. "
            "Transparent mask pixels may change, including the head silhouette and its alpha; opaque pixels are protected. "
            "Preserve ALL pixels below the mask, including body, clothing, long hair and alpha. "
            "Keep the last 4 pixels inside the mask unchanged for a clean neck seam. "
            "Do not mirror the image, move the whole figure, flatten transparency, add a background or crop it.\n", encoding="utf-8")
        entries.append(dict(id=name, angleX=x, angleY=y))
    save_json(dict(version=1, sourceHash=source_hash(project), editRect=[x0, 0, x1, lock_y], views=entries), plan_path)
    print("Prepared four head-view requests locally. Obtain image-transfer consent before imagegen.")


def accept(project, name, drawing):
    plan = plan_for(project)
    if name not in {v["id"] for v in plan["views"]}:
        raise ValueError("unknown view identifier")
    drawing = scoped(project, drawing)
    source = project_image(project)
    with Image.open(drawing) as opened:
        if opened.format != "PNG" or opened.size != source.size or "A" not in opened.getbands():
            raise ValueError("return an unshifted full-size RGBA PNG with transparent background")
        result = np.array(opened.convert("RGBA"))
    mask_path = scoped(project, project / "head-views/requests" / name / "mask.png")
    with Image.open(mask_path) as mask:
        if mask.size != source.size:
            raise ValueError("head mask size must match source.png")
        editable = np.array(mask.convert("RGBA"))[..., 3] == 0
    original = np.array(source)
    # Judge visible pixels including alpha. Never silently accept a repainted body.
    def visible(a):
        a = a.astype(np.float32)
        a[..., :3] *= a[..., 3, None] / 255
        return a
    # Like the expression importer, tolerate codec noise, but never a new body or
    # a broken attachment. Compare only protected pixels: the head is NEW art and
    # must not bias alignment. Unlike expression sprites, head alpha is retained.
    def edges(a):
        v = visible(a)
        g = v[..., :3].mean(axis=-1) + 128 * (1 - v[..., 3] / 255)
        e = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
        e[cv2.dilate(editable.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0] = 0
        return e
    (dx, dy), response = cv2.phaseCorrelate(edges(original), edges(result))
    if response >= .05 and max(abs(dx), abs(dy)) > 3:
        raise ValueError("protected body shifted more than 3 px; return an unshifted drawing")
    delta = np.abs(visible(result) - visible(original)).max(axis=-1)
    rest = ~editable & (original[..., 3] >= 240)
    ring = rest & (cv2.distanceTransform((~editable).astype(np.uint8), cv2.DIST_L2, 5) <= 12)
    mean = float(delta[rest].mean()) if rest.any() else 0
    edge_mean = float(delta[ring].mean()) if ring.any() else 0
    edge_share = float((delta[ring] > 48).mean()) if ring.any() else 0
    # Large new opaque areas in originally empty space are not codec noise.
    background = ~editable & (original[..., 3] < 8)
    added = float((result[..., 3][background] > 48).mean()) if background.any() else 0
    print(f"{name}: protected opaque mean {mean:.2f}/255, neck-edge mean {edge_mean:.2f}/255, {edge_share:.1%} over 48, new background {added:.1%}")
    if mean > 16 or added > .01:
        raise ValueError("protected body/background changed; regenerate preserving outside-mask pixels and alpha")
    if edge_mean > 20 or edge_share > .12:
        raise ValueError("drawing spills across the protected neck edge; regenerate preserving the neck attachment")
    result[~editable] = original[~editable]
    folder = scoped(project, project / "head-views" / name)
    if any((folder / file).exists() for file in ("source.png", "rig.json", "rig.draft.json", "built", "variants")):
        raise ValueError("view already exists; review it in place instead of replacing its source/rig")
    folder.mkdir(parents=True, exist_ok=True)
    draft = copy.deepcopy(read_rig(project))
    draft["head"].pop("views", None)
    if "pitch" in draft["head"]:
        draft["head"]["pitch"].pop("views", None)
    draft["eyes"] = [{"opening": [], "roi": []} for _ in range(2)]
    Image.fromarray(result).save(folder / "source.png")
    save_json(draft, folder / "rig.draft.json")
    print(f"Accepted {name}; trace its empty eye polygons and review ALL geometry before building.")


def node_check(project, tool):
    result = subprocess.run(["node", "--experimental-strip-types", str(ROOT / "tools" / tool), str(project)], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        raise ValueError(result.stderr or result.stdout)


def pack(project):
    plan = plan_for(project)
    node_check(project, "validate-avatar.mjs")
    rig = read_rig(project)
    draft_path = scoped(project, project / "rig.draft.json")
    draft = read_json(draft_path) if draft_path.exists() else None
    if rig["head"].get("pitch", {}).get("views"):
        raise ValueError("existing pitch views retained: migrate them explicitly before adding head.views")
    sheet_path = scoped(project, project / "built/sprites/sprites.json")
    sheet = read_json(sheet_path) if sheet_path.exists() else {"version": 1, "layers": {}}
    missing = [n for n in REQUIRED_SPRITES if n not in sheet["layers"]]
    if missing:
        raise ValueError(f"neutral drawn eye/mouth sprites missing: {', '.join(missing)}")
    images, views = {}, {}
    for definition in plan["views"]:
        name = definition["id"]
        folder = scoped(project, project / "head-views" / name)
        node_check(folder, "validate-avatar.mjs")
        posed = read_rig(folder)
        if posed["image"] != rig["image"] or posed["head"].get("views") or posed["head"].get("pitch", {}).get("views"):
            raise ValueError(f"{name}: dimensions must match neutral; nested views are forbidden")
        if posed["body"] != rig["body"]:
            raise ValueError(f"{name}: preserve the neutral body rig to avoid a body jump between views")
        meta = read_json(scoped(project, folder / "built/layers.json"))
        sprites = read_json(scoped(project, folder / "built/sprites/sprites.json"))
        missing = [n for n in REQUIRED_SPRITES if n not in sprites["layers"]]
        if missing:
            raise ValueError(f"{name}: drawn eye/mouth sprites missing: {', '.join(missing)}")
        aliases, sprite_aliases = {}, {}
        size = [rig["image"]["width"], rig["image"]["height"]]
        rects = {"base": [0, 0, *size], "hairmask": [0, 0, *size], **meta["layers"]}
        for source, mapping, rectangles in [(folder / "built", aliases, rects), (folder / "built/sprites", sprite_aliases, sprites["layers"])]:
            for layer, rect in rectangles.items():
                if not re.fullmatch(r"[A-Za-z0-9_-]+", layer) or layer.startswith(("head_view_", "pitch_view_")):
                    raise ValueError(f"{name}: invalid/nested layer {layer}")
                key = f"head_view_{name}_{'sprite_' if mapping is sprite_aliases else ''}{layer}"
                path = scoped(project, source / f"{layer}.png")
                with Image.open(path) as image:
                    if image.format != "PNG" or list(image.size) != rect[2:]:
                        raise ValueError(f"{name}/{layer}: PNG dimensions do not match its rectangle")
                images[key] = path.read_bytes()
                sheet["layers"][key] = rect
                mapping[layer] = key
        views[name] = dict(rig=posed, layers=aliases, sprites=sprite_aliases)
    rig["head"]["views"] = plan["views"]
    if draft is not None:
        draft["head"]["views"] = plan["views"]
    sheet["headViews"] = views
    sheet.pop("build", None)
    digest = hashlib.sha256(json.dumps(sheet, sort_keys=True).encode())
    for name in sorted(sheet["layers"]):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", name):
            raise ValueError("unsafe sprite key")
        digest.update(images[name] if name in images else scoped(project, project / "built/sprites" / f"{name}.png").read_bytes())
    sheet["build"] = digest.hexdigest()[:12]
    # Validate the complete candidate inside this project before publishing it.
    with tempfile.TemporaryDirectory(prefix=".head-view-pack-", dir=project) as temporary:
        stage = Path(temporary)
        shutil.copytree(project / "built", stage / "built")
        if (project / "avatar.json").exists():
            shutil.copyfile(project / "avatar.json", stage / "avatar.json")
        for name, data in images.items():
            (stage / "built/sprites" / f"{name}.png").write_bytes(data)
        save_json(rig, stage / "rig.json")
        save_json(sheet, stage / "built/sprites/sprites.json")
        node_check(stage, "validate-avatar.mjs")
        if draft is not None:
            save_json(draft, stage / "rig.draft.json")
            node_check(stage / "rig.draft.json", "validate-rig.mjs")
        for name in images:
            (stage / "built/sprites" / f"{name}.png").replace(scoped(project, project / "built/sprites" / f"{name}.png"))
        (stage / "built/sprites/sprites.json").replace(sheet_path)
        (stage / "rig.json").replace(project / "rig.json")
        if draft is not None:
            (stage / "rig.draft.json").replace(draft_path)
    print(f"Packaged {len(views)} drawn head views with per-view eye/mouth sprites. Render and visually review all poses.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("prepare", "accept", "pack"))
    parser.add_argument("project", type=Path)
    parser.add_argument("id", nargs="?")
    parser.add_argument("drawing", nargs="?", type=Path)
    args = parser.parse_args()
    try:
        project = inside_repo(args.project)
        if not project.is_relative_to((ROOT / "projects").resolve()):
            raise ValueError("use a project inside projects/; samples and reference are read-only")
        scoped(project, project / "source.png")
        if args.command == "prepare":
            prepare(project)
        elif args.command == "accept":
            if not args.id or not args.drawing:
                raise ValueError("accept requires a view identifier and project-local drawing path")
            accept(project, args.id, args.drawing)
        else:
            pack(project)
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"head-views: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
