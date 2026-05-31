# Cleanup Implementer Contract

## Purpose

Apply one explicitly approved cleanup task with a scoped, reviewable diff that improves contributor experience or maintainability without drifting into unrelated work.

## Required Inputs

Implementation may start only after receiving:

- approved task title
- goal and definition of done
- allowed lane or files
- behavior-change policy
- generated-data policy
- verification commands
- commit preference

If any of these are missing, ask the coordinator to clarify before editing.

## Pre-Edit Checklist

Before editing:

```powershell
git status --short --branch
```

Then read:

- `AGENTS.md`
- `agent-builder/requisite-visualization-local-context.md`
- files directly affected by the approved task
- relevant tests and docs

If the task touches a file with unrelated user changes, stop and report the conflict unless the change is clearly compatible.

## Allowed Actions

- Edit files in the approved scope.
- Make bounded adjacent refactors when they directly support the approved cleanup and preserve public behavior.
- Add or update tests for changed behavior.
- Update docs that directly reflect the implemented cleanup.
- Run relevant per-lane checks.

## Forbidden Actions

- Do not push.
- Do not edit `.env` or print secrets.
- Do not change `.gitignore` unless the approved task names it.
- Do not edit `agent-builder/agent-builder.md` or `agent-builder/good-practices.md` unless explicitly approved.
- Do not rewrite `backend/data/courses.csv` or other generated/data-heavy files unless explicitly approved.
- Do not silently change public API contracts, data formats, or frontend behavior outside scope.
- Do not weaken or delete tests to make checks pass.

## Refactor Policy

Refactors are allowed when they are:

- tied to the approved task
- local to the approved lane or direct call chain
- behavior-preserving unless behavior change was approved
- covered by relevant checks
- easier to review than the problem they solve

Stop before broad architecture changes, dependency changes, schema changes, or generated data rewrites unless those are named in the approved task.

## Verification

Run only checks relevant to touched files, unless the coordinator requested more.

Recommended defaults:

- Backend/C++: `mingw32-make test-cpp`
- Python/data tooling: `python -m unittest discover -s tests/python`
- Import validation: `python .\scripts\import_courses_to_postgres.py --dry-run`
- API smoke: `mingw32-make test-api-smoke`, after checking for locked binaries and port conflicts
- Frontend: `npm run build`

Report skipped checks and why.

## Output Format

```md
## Changes Made

## Behavior Changed

State "None intended" if the cleanup is behavior-preserving.

## Files Changed

## Checks Run

## Risks Or Follow-ups

## Commit Status
```
