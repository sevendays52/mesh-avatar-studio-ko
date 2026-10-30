# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["pillow>=10.4", "numpy", "opencv-python-headless"]
# ///
"""Verify review coverage, source coordinates and private output boundaries."""
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from PIL import Image
import numpy as np
from agent_common import ROOT, save_json

spec = importlib.util.spec_from_file_location("authoring_review", ROOT / "tools/authoring-review.py")
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class AuthoringReviewTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="authoring-review-test-", dir=ROOT / "projects")
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name).resolve()
        Image.new("RGBA", (100, 100), (210, 190, 175, 255)).save(self.project / "source.png")

    def frames(self):
        for folder in ("review", "review/blinks", "review/head-axes"):
            path = self.project / folder
            path.mkdir(parents=True, exist_ok=True)
            files = []
            for i in range(9):
                for suffix in ("", "-eyes", "-mouth"):
                    name = f"frame-{i}{suffix}.png"
                    Image.new("RGBA", (100, 70), (i * 20, 50, 90, 255)).save(path / name)
                    files.append(name)
            save_json({"files": files}, path / "poses.json")

    def test_review_pages_cover_every_frame_and_link_original_crops(self):
        self.frames()
        review.sheets(self.project, self.project)
        output = self.project / ".authoring/review"
        index = json.loads((output / "index.json").read_text())
        self.assertEqual(len(index["groups"]), 3)
        for group in index["groups"]:
            self.assertEqual(group["frames"], 9)
            self.assertEqual(len(group["pages"]), 6)
            self.assertEqual(len(group["details"]), 9)
            for page in group["pages"]:
                with Image.open(output / page) as image:
                    self.assertEqual(image.size, (1200, 1440))
            for detail in group["details"]:
                for part in ("full", "eyes", "mouth"):
                    self.assertTrue((output / detail[part]).resolve().is_file())
        self.assertIn("frame-8", (output / "index.html").read_text())

    def test_sheets_reject_traversal_and_missing_fine_detail(self):
        self.frames()
        save_json({"files": ["../../source.png"]}, self.project / "review/poses.json")
        with self.assertRaisesRegex(ValueError, "filenames"):
            review.sheets(self.project, self.project)
        self.frames()
        (self.project / "review/frame-8-eyes.png").unlink()
        with self.assertRaises(FileNotFoundError):
            review.sheets(self.project, self.project)

    def test_image_only_prepare_preserves_source_and_does_not_create_a_rig(self):
        before = (self.project / "source.png").read_bytes()
        review.geometry(self.project, self.project, "neutral")
        self.assertTrue((self.project / ".authoring/geometry/grid-full.png").exists())
        self.assertFalse((self.project / "rig.draft.json").exists())
        self.assertEqual(before, (self.project / "source.png").read_bytes())

    def test_zoom_grids_use_each_views_source_coordinates(self):
        rig = {"image": {"width": 100, "height": 100},
               "eyes": [{"roi": [[10, 20], [30, 20], [30, 40], [10, 40]]},
                        {"roi": [[60, 20], [80, 20], [80, 40], [60, 40]]}],
               "mouth": {"area": {"cx": 50, "cy": 65, "rx": 15, "ry": 8}}}
        save_json(rig, self.project / "rig.draft.json")
        review.geometry(self.project, self.project, "neutral")
        output = self.project / ".authoring/geometry"
        self.assertTrue((output / "grid-eye-0.png").exists())
        self.assertTrue((output / "grid-eye-1.png").exists())
        self.assertTrue((output / "grid-mouth.png").exists())
        index = json.loads((output / "index.json").read_text())
        self.assertEqual(index["coordinateSpace"], "source pixels")
        self.assertEqual(review.region([[60, 20], [80, 40]], (100, 100)), (45, 5, 95, 55))

    def test_head_comparison_marks_the_boundary_and_preserves_both_sources(self):
        view = self.project / "head-views/left"
        view.mkdir(parents=True)
        Image.new("RGBA", (100, 100), (210, 190, 175, 255)).save(view / "source.png")
        save_json({"image": {"width": 100, "height": 100}, "eyes": [{"roi": []}, {"roi": []}]}, view / "rig.draft.json")
        mask = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
        mask.paste((255, 255, 255, 255), (0, 80, 100, 100))
        mask_path = self.project / "head-views/requests/left/mask.png"
        mask_path.parent.mkdir(parents=True)
        mask.save(mask_path)
        before = [(path, path.read_bytes()) for path in (self.project / "source.png", view / "source.png")]
        review.geometry(self.project, view, "left")
        with Image.open(view / ".authoring/geometry/head-comparison.png") as image:
            self.assertEqual(image.size, (1200, 780))
            pixels = np.asarray(image)
            self.assertTrue(np.any((pixels[..., 0] > 240) & (pixels[..., 1] < 60) & (pixels[..., 2] < 100)))
        for path, data in before:
            self.assertEqual(path.read_bytes(), data)

    def test_output_symlink_cannot_write_to_another_project(self):
        other = self.project / "other"
        other.mkdir()
        (self.project / ".authoring").symlink_to(other, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "redirected"):
            review.geometry(self.project, self.project, "neutral")
        self.assertEqual(list(other.iterdir()), [])

    def test_real_cli_build_installs_legacy_tool_dependencies_and_reuses_unchanged_outputs(self):
        rig = json.loads((ROOT / "samples/miko-qipao/rig.json").read_text())
        # The synthetic source has no hand, tassels, buns or hair strands.
        for key in ("hand", "accessories", "buns", "strands"):
            rig.pop(key, None)
        Image.new("RGBA", (rig["image"]["width"], rig["image"]["height"]), (210, 190, 175, 255)).save(self.project / "source.png")
        save_json(rig, self.project / "rig.draft.json")
        before = (self.project / "source.png").read_bytes()
        command = ["node", str(ROOT / "tools/authoring.mjs"), "build", str(self.project)]
        built = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
        logs = self.project / ".authoring/logs"
        details = "\n".join(path.read_text() for path in logs.glob("*.log"))
        self.assertEqual(built.returncode, 0, built.stderr + details)
        self.assertFalse(json.loads(built.stdout)["skipped"])
        log_count = len(list(logs.glob("*.log")))
        repeated = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(repeated.returncode, 0, repeated.stderr)
        self.assertTrue(json.loads(repeated.stdout)["skipped"])
        self.assertEqual(len(list(logs.glob("*.log"))), log_count)
        self.assertEqual(before, (self.project / "source.png").read_bytes())


if __name__ == "__main__":
    unittest.main()
