import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_program_module():
    sys.modules.setdefault(
        "requests",
        types.SimpleNamespace(post=lambda *args, **kwargs: None),
    )
    spec = importlib.util.spec_from_file_location(
        "generate_program_requirements",
        REPO_ROOT / "scripts" / "generate_program_requirements.py",
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def load_fixture_records():
    fixture_path = REPO_ROOT / "tests" / "fixtures" / "coursedog_programs_sample.json"
    return json.loads(fixture_path.read_text(encoding="utf-8"))


class GenerateProgramRequirementsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generator = load_program_module()

    def test_normalizes_program_metadata_and_preserves_raw_source(self):
        programs, summary = self.generator.normalize_program_records(load_fixture_records(), "2025-2026")

        by_name = {program["name"]: program for program in programs}
        self.assertEqual(summary.fetched_count, 3)
        self.assertEqual(summary.selected_count, 3)
        self.assertEqual(summary.undergraduate_count, 3)
        self.assertEqual(summary.bachelor_count, 2)
        self.assertEqual(summary.structured_requisite_count, 1)
        self.assertEqual(summary.document_count, 2)

        cmpsc = by_name["Computer Science, B.S."]
        self.assertEqual(cmpsc["programId"], "cmpsc-bs")
        self.assertEqual(cmpsc["catalogYear"], "2025-2026")
        self.assertEqual(cmpsc["college"], "College of Engineering")
        self.assertEqual(cmpsc["department"], "Computer Science")
        self.assertEqual(cmpsc["degreeLevel"], "bachelor")
        self.assertTrue(cmpsc["hasStructuredRequirements"])
        self.assertEqual(cmpsc["structuredRequirementKeys"], ["allOf"])
        self.assertEqual(cmpsc["raw"]["_id"], "program-cmpsc-bs")

        econ = by_name["Economics, B.A."]
        self.assertEqual(econ["department"], "Economics")
        self.assertEqual(econ["documents"][0]["url"], "https://catalog.ucsb.edu/programs/econ-ba.pdf")


if __name__ == "__main__":
    unittest.main()
