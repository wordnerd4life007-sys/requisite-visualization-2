import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_import_module():
    spec = importlib.util.spec_from_file_location(
        "import_courses_to_postgres",
        REPO_ROOT / "scripts" / "import_courses_to_postgres.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class ImportCoursesToPostgresTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.importer = load_import_module()

    def write_temp_csv(self, content: str) -> Path:
        temp_file = tempfile.NamedTemporaryFile("w", newline="", encoding="utf-8", suffix=".csv", delete=False)
        with temp_file:
            temp_file.write(content)
        return Path(temp_file.name)

    def test_optional_metadata_columns_are_read_and_reported(self):
        csv_path = self.write_temp_csv(
            "id,name,credits,college,prereqs,subject,department,description\n"
            "CMPSC 16,Problem Solving,4,College of Engineering,\"CMPSC 8 | ECE 15, ENGR 3\",CMPSC,Computer Science,Programming foundations\n"
            "CMPSC 8,Intro CS,4,College of Engineering,,,Computer Science,\n"
        )
        self.addCleanup(lambda: csv_path.unlink(missing_ok=True))

        plan = self.importer.read_csv(csv_path)

        self.assertEqual(plan.errors, [])
        self.assertEqual(
            plan.headers,
            ["id", "name", "credits", "college", "prereqs", "subject", "department", "description"],
        )
        self.assertEqual(plan.courses[0].subject, "CMPSC")
        self.assertEqual(plan.courses[0].department, "Computer Science")
        self.assertEqual(plan.courses[0].description, "Programming foundations")
        self.assertEqual(
            [(group.course_id, group.group_position, group.group_kind) for group in plan.groups],
            [("CMPSC 16", 1, "all"), ("CMPSC 16", 2, "any")],
        )
        self.assertEqual(
            [(option.group_position, option.option_position, option.prerequisite_id) for option in plan.options],
            [(1, 1, "CMPSC 8"), (2, 1, "ECE 15"), (2, 2, "ENGR 3")],
        )

        summary = "\n".join(self.importer.build_summary(plan, csv_path))
        self.assertIn("Subject coverage: 1 values, blank rows: 1; CMPSC=1", summary)
        self.assertIn("Department coverage: 1 values, blank rows: 0; Computer Science=2", summary)
        self.assertIn("Description coverage: 1 rows, blank rows: 1", summary)

        sql = self.importer.generate_sql(plan)
        self.assertIn("subject TEXT NOT NULL", sql)
        self.assertIn("department TEXT NOT NULL", sql)
        self.assertIn("description TEXT NOT NULL", sql)
        self.assertIn("DELETE FROM courses AS existing", sql)
        self.assertIn("WHERE imported.id = existing.id", sql)
        self.assertIn("UPDATE courses SET subject = imported.subject", sql)
        self.assertIn("UPDATE courses SET department = imported.department", sql)
        self.assertIn("UPDATE courses SET description = imported.description", sql)

    def test_legacy_csv_without_metadata_columns_remains_valid(self):
        csv_path = self.write_temp_csv(
            "id,name,credits,college,prereqs\n"
            "CMPSC 8,Intro CS,4,College of Engineering,\n"
        )
        self.addCleanup(lambda: csv_path.unlink(missing_ok=True))

        plan = self.importer.read_csv(csv_path)

        self.assertEqual(plan.errors, [])
        self.assertEqual(plan.courses[0].subject, "")
        self.assertEqual(plan.courses[0].department, "")
        self.assertEqual(plan.courses[0].description, "")

        summary = "\n".join(self.importer.build_summary(plan, csv_path))
        self.assertIn("Subject coverage: not available (CSV column not present)", summary)
        self.assertIn("Department coverage: not available (CSV column not present)", summary)
        self.assertIn("Description coverage: not available (CSV column not present)", summary)


if __name__ == "__main__":
    unittest.main()
