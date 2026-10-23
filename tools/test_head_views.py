# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow>=10.4", "numpy", "opencv-python-headless"]
# ///
"""Exercise protected imports and complete packaging using synthetic pixels only."""
import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from agent_common import ROOT, save_json

spec = importlib.util.spec_from_file_location("head_views", ROOT / "tools/head-views.py")
views = importlib.util.module_from_spec(spec)
spec.loader.exec_module(views)


class HeadViewsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="head-view-test-", dir=ROOT / "projects")
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name).resolve()
        self.rig = json.loads((ROOT / "samples/miko-qipao/rig.json").read_text())
        self.size = (self.rig["image"]["width"], self.rig["image"]["height"])
        Image.new("RGBA", self.size, (200, 180, 160, 255)).save(self.project / "source.png")
        save_json(self.rig, self.project / "rig.json")
        save_json(self.rig, self.project / "rig.draft.json")

    def built(self, folder):
        rig = copy.deepcopy(self.rig)
        save_json(rig, folder / "rig.json")
        names = ["hand", *[a["name"] for a in rig.get("accessories", [])],
                 *[f"eye{i}_{part}" for i in (0, 1) for part in ("ball", "lash", "low", "crease")]]
        save_json(dict(version=1, build="synthetic", size=list(self.size), eyes=rig["eyes"], layers={n: [0, 0, 2, 2] for n in names}), folder / "built/layers.json")
        for name in ["base", "hairmask", *names]:
            Image.new("RGBA", self.size if name in ("base", "hairmask") else (2, 2), "white").save(folder / "built" / f"{name}.png")
        save_json(dict(version=1, build="synthetic", layers={n: [0, 0, 2, 2] for n in views.REQUIRED_SPRITES}), folder / "built/sprites/sprites.json")
        for name in views.REQUIRED_SPRITES:
            Image.new("RGBA", (2, 2), "white").save(folder / "built/sprites" / f"{name}.png")

    def test_prepare_accept_preserves_source_body_and_requires_retracing(self):
        before = (self.project / "source.png").read_bytes()
        views.prepare(self.project)
        plan = (self.project / "head-views/plan.json").read_bytes()
        views.prepare(self.project)
        self.assertEqual(plan, (self.project / "head-views/plan.json").read_bytes())
        image = Image.open(self.project / "source.png").convert("RGBA")
        image.putpixel((self.size[0] // 2, 10), (10, 20, 30, 0))
        drawing = self.project / "drawing.png"
        image.save(drawing)
        views.accept(self.project, "left", drawing)
        accepted = Image.open(self.project / "head-views/left/source.png")
        self.assertEqual(accepted.getpixel((self.size[0] // 2, 10)), (10, 20, 30, 0))
        self.assertEqual(accepted.getpixel((10, self.size[1] - 1)), (200, 180, 160, 255))
        draft = views.read_json(self.project / "head-views/left/rig.draft.json")
        self.assertEqual(draft["eyes"], [{"opening": [], "roi": []}] * 2)
        self.assertEqual(before, (self.project / "source.png").read_bytes())
        with self.assertRaisesRegex(ValueError, "already exists"):
            views.accept(self.project, "left", drawing)
        with self.assertRaisesRegex(ValueError, "inside this project"):
            views.accept(self.project, "right", ROOT / "samples/miko-qipao/source.png")

    def test_reject_changed_body_missing_alpha_changed_source_and_unsafe_plan(self):
        views.prepare(self.project)
        drawing = self.project / "bad.png"
        Image.new("RGBA", self.size, "black").save(drawing)
        with self.assertRaisesRegex(ValueError, "protected body"):
            views.accept(self.project, "left", drawing)
        Image.new("RGB", self.size, "white").save(drawing)
        with self.assertRaisesRegex(ValueError, "RGBA PNG"):
            views.accept(self.project, "left", drawing)
        plan_path = self.project / "head-views/plan.json"
        plan = views.read_json(plan_path)
        plan["views"][0]["id"] = "../escape"
        save_json(plan, plan_path)
        with self.assertRaisesRegex(ValueError, "safe unique"):
            views.plan_for(self.project)

    def test_codec_noise_restores_body_but_neck_repaint_is_rejected(self):
        views.prepare(self.project)
        drawing = self.project / "encoded.png"
        image = Image.new("RGBA", self.size, (204, 183, 158, 255))
        image.putpixel((self.size[0] // 2, 10), (10, 20, 30, 0))
        image.save(drawing)
        views.accept(self.project, "left", drawing)
        accepted = Image.open(self.project / "head-views/left/source.png")
        self.assertEqual(accepted.getpixel((10, self.size[1]-1)), (200,180,160,255))
        self.assertEqual(accepted.getpixel((self.size[0]//2,10)), (10,20,30,0))
        # A thin neck repaint has a tiny global mean but must still fail the edge check.
        from PIL import ImageDraw
        y = views.plan_for(self.project)["editRect"][3]
        ImageDraw.Draw(image).rectangle((0,y,self.size[0],y+11), fill=(0,0,0,255))
        image.save(drawing)
        with self.assertRaisesRegex(ValueError, "neck edge"):
            views.accept(self.project, "right", drawing)
        Image.new("RGBA", self.size, "red").save(self.project / "source.png")
        with self.assertRaisesRegex(ValueError, "source.png changed"):
            views.plan_for(self.project)

    def test_pack_requires_all_art_and_validates_complete_candidate_before_publish(self):
        views.prepare(self.project)
        self.built(self.project)
        before = (self.project / "rig.json").read_bytes()
        with self.assertRaises((ValueError, FileNotFoundError)):
            views.pack(self.project)
        self.assertEqual(before, (self.project / "rig.json").read_bytes())
        for name, _, _ in views.POSES:
            folder = self.project / "head-views" / name
            folder.mkdir()
            self.built(folder)
        views.pack(self.project)
        rig = views.read_json(self.project / "rig.json")
        self.assertEqual(len(rig["head"]["views"]), 4)
        sheet = views.read_json(self.project / "built/sprites/sprites.json")
        self.assertEqual(set(sheet["headViews"]), {x[0] for x in views.POSES})
        self.assertIn("head_view_left_sprite_eyes_closed_0", sheet["layers"])
        views.pack(self.project)
        self.assertEqual(sheet["build"], views.read_json(self.project / "built/sprites/sprites.json")["build"])
        # An incomplete turned-face expression must not fall back silently.
        missing = self.project / "head-views/right/built/sprites/sprites.json"
        data = views.read_json(missing)
        del data["layers"]["mouth_o"]
        save_json(data, missing)
        with self.assertRaisesRegex(ValueError, "mouth_o"):
            views.pack(self.project)
        self.assertEqual(sheet, views.read_json(self.project / "built/sprites/sprites.json"))


if __name__ == "__main__":
    unittest.main()
