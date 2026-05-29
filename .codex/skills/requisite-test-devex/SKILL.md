---
name: requisite-test-devex
description: Work on requisite-visualization tests, Makefile targets, CI, Windows developer commands, parser fixtures, API smoke checks, frontend checks, and local development workflow. Use when tasks add or modify tests, build targets, helper scripts, requirements, workflows, or developer-experience documentation.
---

# Requisite Test Devex

## Workflow

Use the Testing And Dev Experience lane. State reasoning tier, risk level, expected files, and whether escalation is needed. Escalate reasoning when test infrastructure affects multiple lanes or changes the expected verification path.

Read the current Makefile, relevant tests, touched implementation files, and docs before changing commands or test surfaces.

Primary files:

- `Makefile`
- `tests/`
- `.github/workflows/`
- Python dependency files such as `requirements.txt` or `pyproject.toml`
- helper scripts under `scripts/`
- developer workflow docs

## Test Strategy

Move hardcoded checks out of `backend/src/main.cpp` into tests when working on that area.

Keep the first C++ test framework lightweight. `doctest` or Catch2 is reasonable if a framework decision is needed.

Add focused tests for behavior changes whenever a test surface exists. If no test surface exists, create the smallest useful harness for the lane.

Avoid requiring network access for parser unit tests. Use fixtures.

Prioritize tricky prerequisite cases: OR groups, semicolon groups, W courses, course ranges, concurrent enrollment text, non-course requirements, and group index preservation.

Test frontend API-client and graph interaction behavior when practical, especially fetch error states and multi-college filtering.

## Command Rules

Use PowerShell-compatible commands on Windows. Prefer `mingw32-make`; do not assume plain `make` exists.

Useful checks:

```powershell
mingw32-make
mingw32-make test-cpp
mingw32-make test-api-smoke
mingw32-make test-api-smoke-postgres
python -m unittest discover -s tests/python
python .\scripts\import_courses_to_postgres.py --dry-run
cd frontend
npm run build
```

Document reliable Windows build/test commands when adding or changing workflows.
