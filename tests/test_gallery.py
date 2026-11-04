"""Regression checks for number reuse and the public gallery format."""

import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location(
    "gallery_validator", Path(__file__).resolve().parents[1] / "scripts" / "validate_gallery.py"
)
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


class GalleryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.original_root = validator.ROOT
        self.addCleanup(setattr, validator, "ROOT", self.original_root)
        validator.ROOT = Path(self.temp.name)
        self.work = {"id": "002", "title": "새 작품", "description": "가상 자료로 만든 도구"}

    def write(self, entries):
        (validator.ROOT / "gallery.json").write_text(json.dumps(entries), encoding="utf-8")

    def check(self):
        with contextlib.redirect_stdout(io.StringIO()):
            validator.validate()

    def test_deleted_number_can_be_created_again(self):
        folder = validator.ROOT / "works" / "002"
        folder.mkdir(parents=True)
        target = folder / "index.html"
        target.write_text("<!doctype html><title>old</title>")
        self.write([self.work])
        self.check()
        target.unlink()
        folder.rmdir()
        self.write([])
        self.check()
        folder.mkdir()
        target.write_text("<!doctype html><title>new</title>")
        self.write([self.work])
        self.check()

    def test_person_fields_are_not_collected(self):
        for field in ("school", "creator", "name", "email"):
            with self.subTest(field=field):
                self.write([{**self.work, field: "fixture"}])
                with self.assertRaisesRegex(ValueError, "허용되지 않은 필드"):
                    self.check()

    def test_duplicate_number_is_rejected(self):
        folder = validator.ROOT / "works" / "002"
        folder.mkdir(parents=True)
        (folder / "index.html").write_text("<!doctype html><title>fixture</title>")
        self.write([self.work, self.work])
        with self.assertRaisesRegex(ValueError, "중복"):
            self.check()

    def test_missing_entry_file_is_rejected(self):
        self.write([self.work])
        with self.assertRaisesRegex(ValueError, "index.html"):
            self.check()

    def test_unsafe_or_noncanonical_ids_are_rejected(self):
        for work_id in ("../002", "002/..", "0002", "000", "2", 2):
            with self.subTest(work_id=work_id):
                self.write([{**self.work, "id": work_id}])
                with self.assertRaises(ValueError):
                    self.check()


if __name__ == "__main__":
    unittest.main()
