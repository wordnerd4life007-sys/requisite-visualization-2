---
name: requisite-catalog-import
description: Work on requisite-visualization catalog generation, PostgreSQL import, database schema, seed data, external prerequisite modeling, and data-quality checks. Use when tasks touch scripts/generate_courses_csv.py, scripts/import_courses_to_postgres.py, backend/db migrations or seeds, generated course CSV assumptions, credits modeling, or Coursedog metadata.
---

# Requisite Catalog Import

## Workflow

Use the Database And Import Pipeline lane. State reasoning tier, risk level, expected files, and whether escalation is needed. Use high reasoning for schema evolution, external prerequisite modeling, credits modeling, generated catalog format changes, and all-UCSB catalog expansion.

Read the generator/import scripts, schema, relevant tests, and docs before changing data contracts.

Primary files:

- `scripts/generate_courses_csv.py`
- `scripts/import_courses_to_postgres.py`
- `backend/db/migrations/`
- `backend/db/seeds/`
- DB-related README or docs sections when needed

## Guardrails

Treat `backend/db/seeds/001_sample_data.sql` as sample data, not the production catalog.

Do not rewrite `backend/data/courses.csv` or other generated/data-heavy files unless the task is specifically about data generation or import and regeneration is authorized.

Do not run destructive database commands such as `docker compose down -v` unless the user explicitly asks for a reset.

Do not force `prerequisite_id` to reference `courses(id)` until external prerequisite handling is intentionally changed.

Preserve group order and option order during import.

Prefer idempotent imports for local development. Avoid hardcoding a single UCSB college list if Coursedog exposes academic-unit metadata.

## Target Behavior

Preserve college, department, subject, description, catalog metadata, grouped prerequisites, external prerequisite flags, and nonstandard or blank credit cases.

Separate sample seed behavior from real catalog import behavior.

Document any changes to external prerequisites, credits, or generated CSV fields before handing work to API/frontend lanes.

## Verification

Use the smallest relevant checks first:

```powershell
python .\scripts\import_courses_to_postgres.py --dry-run
python -m unittest discover -s tests/python
docker compose up -d postgres
.\scripts\test-db-connection.ps1
```

For DB changes, add focused SQL checks for total course count, college/department/subject coverage, prerequisite group count, option count, OR groups, and external prerequisite references.
