import csv
import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_generator_module():
    sys.modules.setdefault(
        "requests",
        types.SimpleNamespace(post=lambda *args, **kwargs: None),
    )
    spec = importlib.util.spec_from_file_location(
        "generate_courses_csv",
        REPO_ROOT / "scripts" / "generate_courses_csv.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_fixture_records():
    fixture_path = REPO_ROOT / "tests" / "fixtures" / "coursedog_catalog_sample.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


class GenerateCoursesCsvTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generator = load_generator_module()

    def test_generate_rows_preserves_catalog_metadata_and_uses_all_colleges(self):
        rows, summary = self.generator.generate_rows(load_fixture_records())

        rows_by_id = {row[0]: row for row in rows}
        self.assertEqual(summary.fetched_count, 6)
        self.assertEqual(summary.selected_count, 5)
        self.assertEqual(summary.duplicate_ids, ["CMPSC 16"])
        self.assertEqual(summary.college_counts["College of Engineering"], 4)
        self.assertEqual(summary.college_counts["College of Letters and Science"], 1)
        self.assertEqual(summary.subject_counts["CMPSC"], 2)
        self.assertEqual(summary.department_counts["Computer Science"], 2)
        self.assertEqual(summary.blank_credit_count, 1)
        self.assertEqual(summary.blank_name_fallbacks, 1)

        self.assertEqual(
            rows_by_id["CMPSC 16"],
            [
                "CMPSC 16",
                "Problem Solving With Computers I",
                "4",
                "College of Engineering",
                "| CMPSC 8, ECE 15",
                "CMPSC",
                "Computer Science",
            ],
        )
        self.assertEqual(rows_by_id["PSTAT 120A"][3], "College of Letters and Science")
        self.assertEqual(rows_by_id["PSTAT 120A"][6], "Statistics and Applied Probability")
        self.assertEqual(rows_by_id["TMP 492"][1], "Special Topics")
        self.assertEqual(rows_by_id["TMP 492"][2], "")
        self.assertEqual(rows_by_id["TMP 492"][6], "Technology Management")

    def test_generate_rows_can_filter_to_selected_colleges(self):
        rows, summary = self.generator.generate_rows(
            load_fixture_records(),
            {"College of Engineering"},
        )

        self.assertEqual(summary.selected_count, 4)
        self.assertNotIn("PSTAT 120A", {row[0] for row in rows})
        self.assertEqual(set(summary.college_counts), {"College of Engineering"})

    def test_write_courses_csv_includes_metadata_headers(self):
        rows, _ = self.generator.generate_rows(load_fixture_records())

        with tempfile.TemporaryDirectory() as directory:
            output_path = Path(directory) / "courses.csv"
            self.generator.write_courses_csv(rows, output_path)

            with output_path.open(newline="", encoding="utf-8") as input_file:
                reader = csv.reader(input_file)
                self.assertEqual(
                    next(reader),
                    ["id", "name", "credits", "college", "prereqs", "subject", "department"],
                )

    def test_course_id_normalizes_w_subjects(self):
        self.assertEqual(self.generator.course_id("CMPSCW", "8"), "CMPSC W8")


if __name__ == "__main__":
    unittest.main()
