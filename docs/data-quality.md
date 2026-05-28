# Data Quality

This document records current catalog and parser caveats for `requisite-visualization`.

## Current Data Source

Course data comes from UCSB Coursedog through `scripts/generate_courses_csv.py`. The script writes `backend/data/courses.csv`, which is imported into PostgreSQL for the default C++ API runtime. `API_DATA_SOURCE=csv` can still consume the generated CSV directly for tests and local fallback work.

The generated CSV is treated as generated data. Rewrite it only for catalog generation/import work.

## Current Catalog Facts

The current generated catalog was produced for effective date `2026-05-18` and contains:

- 12,271 course rows.
- 6 college/school labels.
- 139 subject labels.
- 60 department labels.
- 2,156 courses with prerequisites.
- 2,461 prerequisite groups: 1,229 `all` groups and 1,232 `any` groups.
- 5,463 prerequisite options.
- 569 external prerequisite option references across 198 distinct prerequisite IDs.
- 9 blank credit values.
- 11 nonstandard nonblank credit values.

These facts should be rechecked after regenerating the CSV because the upstream catalog can change.

## Prerequisite Groups

Prerequisites are modeled as grouped requirements:

```text
AND course, AND course | OR option, OR option; OR option, OR option
```

An `all` group means every option is required. An `any` group means one option is required. Flattened graph edges are useful for traversal, but they are lossy if displayed as the only prerequisite model.

For example, if a course accepts `CMPSC 8` or `CMPSC 16`, both may appear as graph edges, but the product must still show that they are alternatives.

## External References

Even after expanding to all current UCSB courses, some prerequisite references remain external. These may be inactive courses, parser artifacts, cross-catalog references, or non-course requirements that look course-like.

The API preserves these references with `external` flags. The product should continue to show them rather than silently dropping them.

## Credits

The catalog includes blank, variable, and nonstandard credit values. The API serializes blank credits as `null`; the frontend displays those as variable/unknown units.

Possible future representation:

- `credits_min`
- `credits_max`
- `credits_label`
- raw source credit text

Documentation and UI should not assume every course has a single fixed integer credit value.

## Parser Limitations To Track

The prerequisite parser should continue to be tested against:

- OR groups.
- Semicolon-separated groups.
- Course ranges.
- W course variants.
- Concurrent enrollment language.
- Minimum grade requirements.
- Class standing requirements.
- Instructor consent.
- Non-course requirements.

Some of these requirements may not be representable as course nodes. The product should preserve raw prerequisite text or parser notes so students can see requirements the graph cannot model.

## Verification Checks

Current lightweight checks:

```powershell
python .\scripts\import_courses_to_postgres.py --dry-run
python -m unittest discover -s tests/python
mingw32-make test-cpp
```

Database integration checks should cover imported course count, group count, option count, sample OR-group courses, external prerequisite references, and blank/nonstandard credits.
