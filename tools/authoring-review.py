# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["pillow>=10.4", "numpy", "opencv-python-headless"]
# ///
"""Prepare local coordinate grids and bounded review sheets. Never uploads images."""
import argparse
import hashlib
import html
import importlib.util
import json
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from agent_common import ROOT, font, grid_image, project_image, read_rig, save_json


def safe(project, path):
    path = Path(path)
    if not path.is_absolute():
        path = project / path
    if not path.is_relative_to(project):
        raise ValueError("review files must stay inside this project")
    current = project
    for part in path.relative_to(project).parts:
        if part in ("..", "."):
            raise ValueError("invalid review path")
        current = current / part
        if current.is_symlink():
            raise ValueError("review files cannot use redirected paths")
    return path


def region(points, size, margin=15):
    xs, ys = zip(*points)
    if not all(math.isfinite(n) for n in (*xs, *ys)):
        raise ValueError("grid coordinates must be finite")
    return (max(0, math.floor(min(xs) - margin)), max(0, math.floor(min(ys) - margin)),
            min(size[0], math.ceil(max(xs) + margin)), min(size[1], math.ceil(max(ys) + margin)))


def save(project, image, path):
    path = safe(project, path)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def geometry(project, workspace, view):
    image = project_image(workspace)
    output = safe(project, workspace / ".authoring/geometry")
    output.mkdir(parents=True, exist_ok=True)
    # Remove only our generated grids/overlays; never retain a previous rig's
    # geometry picture as evidence for the current source.
    for path in output.glob("*.png"):
        if re.fullmatch(r"(?:grid-[A-Za-z0-9_-]+|overlay(?:-eyes|-mouth)?|head-comparison)\.png", path.name):
            safe(project, path).unlink()
    def index():
        save_json({"sourceHash": hashlib.sha256((workspace / "source.png").read_bytes()).hexdigest(),
                   "coordinateSpace": "source pixels", "view": view,
                   "files": sorted(path.name for path in output.glob("*.png"))}, safe(project, output / "index.json"))
    save(project, grid_image(image, step=50)[0], output / "grid-full.png")
    rig_path = workspace / ("rig.draft.json" if (workspace / "rig.draft.json").exists() else "rig.json")
    if not safe(project, rig_path).exists():
        index()
        return
    rig = read_rig(workspace, rig_path.name)
    if rig["image"] != {"width": image.width, "height": image.height}:
        raise ValueError("rig.image must match source.png")
    for i, eye in enumerate(rig.get("eyes", [])):
        points = eye.get("roi", []) + eye.get("opening", [])
        if points:
            save(project, grid_image(image, region(points, image.size), step=5)[0], output / f"grid-eye-{i}.png")
    if "mouth" in rig:
        m = rig["mouth"]["area"]
        # Rotation-safe bounds, labelled in original source pixels.
        radius = max(m["rx"], m["ry"])
        save(project, grid_image(image, region([[m["cx"] - radius, m["cy"] - radius], [m["cx"] + radius, m["cy"] + radius]], image.size), step=5)[0], output / "grid-mouth.png")
    if all(eye.get("opening") and eye.get("roi") for eye in rig.get("eyes", [])):
        spec = importlib.util.spec_from_file_location("authoring_overlay", ROOT / "tools/overlay.py")
        overlay = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(overlay)
        overlay.overlay(workspace, rig_path.name, None, False, output / "overlay.png")
        overlay.overlay(workspace, rig_path.name, "eyes", True, output / "overlay-eyes.png")
        overlay.overlay(workspace, rig_path.name, "mouth", True, output / "overlay-mouth.png")
        grouped = {}
        for group, _, points, _ in overlay.geometry(rig):
            if group not in ("eyes", "mouth", "mesh", "view"):
                grouped.setdefault(group, []).extend(points)
        for group, points in grouped.items():
            save(project, grid_image(image, region(points, image.size), step=10)[0], output / f"grid-{group}.png")
    if view != "neutral":
        neutral = project_image(project)
        mask_path = safe(project, f"head-views/requests/{view}/mask.png")
        with Image.open(mask_path) as opened:
            mask = opened.convert("RGBA")
        if neutral.size != image.size or mask.size != image.size:
            raise ValueError("head drawing and mask must match neutral source dimensions")
        import cv2
        import numpy as np
        alpha = np.array(mask)[..., 3]
        if np.any((alpha != 0) & (alpha != 255)):
            raise ValueError("head mask must use binary alpha")
        edge = cv2.morphologyEx((alpha == 0).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8)) > 0
        frames = []
        for title, original in (("NEUTRAL / same source coordinates", neutral), (f"{view.upper()} / red = mask boundary", image)):
            pixels = np.array(original)
            pixels[edge] = [255, 30, 70, 255]
            tile = Image.new("RGB", (600, 780), "#dedfe5")
            preview = Image.fromarray(pixels)
            preview.thumbnail((580, 740))
            tile.paste(preview, ((600 - preview.width) // 2, 34), preview)
            ImageDraw.Draw(tile).text((10, 8), title, font=font(15), fill="#171b23")
            frames.append(tile)
        sheet = Image.new("RGB", (1200, 780))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (i * 600, 0))
        save(project, sheet, output / "head-comparison.png")
    index()


def sheets(project, workspace):
    output = safe(project, workspace / ".authoring/review")
    output.mkdir(parents=True, exist_ok=True)
    for path in output.glob("*.png"):
        if re.fullmatch(r"(?:poses|blinks|head-axes)-(?:full|eyes|mouth)-[0-9]+\.png", path.name):
            safe(project, path).unlink()
    groups = []
    for group, folder in (("poses", "review"), ("blinks", "review/blinks"), ("head-axes", "review/head-axes")):
        review = safe(project, workspace / folder)
        metadata = json.loads(safe(project, review / "poses.json").read_text())
        names = metadata["files"]
        if not isinstance(names, list) or any(not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+\.png", name) for name in names):
            raise ValueError("review index must list local PNG filenames")
        frames = [name for name in names if name != "contact-sheet.png" and not name.endswith(("-eyes.png", "-mouth.png"))]
        if not frames:
            raise ValueError("review index contains no frames")
        pages, details = [], []
        for part in ("full", "eyes", "mouth"):
            for start in range(0, len(frames), 8):
                page = Image.new("RGB", (1200, 1440), "#dedfe5")
                draw = ImageDraw.Draw(page)
                for index, frame in enumerate(frames[start:start + 8]):
                    filename = frame if part == "full" else frame[:-4] + f"-{part}.png"
                    path = safe(project, review / filename)
                    with Image.open(path) as image:
                        preview = image.convert("RGBA")
                    preview.thumbnail((580, 310))
                    x, y = (index % 2) * 600, (index // 2) * 360
                    page.paste(preview, (x + (600 - preview.width) // 2, y + 40), preview)
                    draw.text((x + 10, y + 8), f"{frame[:-4]} / {part}", font=font(15), fill="#171b23")
                name = f"{group}-{part}-{start // 8 + 1:02d}.png"
                save(project, page, output / name)
                pages.append(name)
        for frame in frames:
            details.append({"name": frame[:-4], **{part: f"../../{folder}/{frame if part == 'full' else frame[:-4] + '-' + part + '.png'}" for part in ("full", "eyes", "mouth")}})
        groups.append({"id": group, "frames": len(frames), "pages": pages, "details": details})
    save_json({"version": 1, "groups": groups, "note": "Review every page. Use original crops for fine defects; sheets are navigation, not proof of visual acceptance."}, safe(project, output / "index.json"))
    body = ["<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width'><title>Avatar review</title>",
            "<style>body{font:16px system-ui;max-width:1200px;margin:auto;padding:16px}img{max-width:100%;height:auto}a{margin-right:12px}details{margin:12px 0}</style>",
            "<h1>Avatar review</h1><p>Inspect all pages, then open original crops where needed. Record remaining defects.</p>"]
    for group in groups:
        body.append(f"<h2>{group['id']} ({group['frames']} frames)</h2>")
        for page in group["pages"]:
            body.append(f"<p>{page}</p><a href='{page}'><img loading='lazy' src='{page}' alt='{page}'></a>")
        for detail in group["details"]:
            body.append(f"<details><summary>{html.escape(detail['name'])}</summary>" + "".join(f"<a href='{html.escape(detail[part])}'>{part}</a>" for part in ("full", "eyes", "mouth")) + "</details>")
    safe(project, output / "index.html").write_text("\n".join(body) + "\n</html>\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("geometry", "sheets"))
    parser.add_argument("project", type=Path)
    parser.add_argument("--view", default="neutral")
    args = parser.parse_args()
    try:
        project = args.project.absolute()
        if project.parent != ROOT / "projects" or project.is_symlink() or project.resolve() != project:
            raise ValueError("use a regular root project inside projects/")
        if not re.fullmatch(r"[A-Za-z0-9_-]+", args.view):
            raise ValueError("use a safe view identifier")
        workspace = safe(project, project if args.view == "neutral" else project / "head-views" / args.view)
        safe(project, workspace / "source.png")
        if args.command == "geometry":
            geometry(project, workspace, args.view)
        else:
            sheets(project, workspace)
        print(f"Local review prepared in {workspace.relative_to(ROOT)}/.authoring/")
        return 0
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"authoring-review: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
