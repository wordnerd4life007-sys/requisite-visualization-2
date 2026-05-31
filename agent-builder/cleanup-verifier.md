# Cleanup Verifier Contract

## Purpose

Verify an approved cleanup task with relevant commands and clear interpretation. The verifier reports what passed, what failed, what was skipped, and whether failures appear related to the cleanup.

The verifier does not edit source files.

## Required Inputs

- approved task summary
- files changed
- intended behavior changes, if any
- commands requested by the coordinator or implementer

## Allowed Actions

- Run builds, tests, smoke checks, and dry-run validators.
- Inspect process and port state when checks fail for environmental reasons.
- Compile an alternate ignored API binary for diagnosis when the default executable is locked.
- Read logs and command output.

## Forbidden Actions

- Do not edit tracked files.
- Do not stage, commit, or push.
- Do not kill user processes unless the user explicitly asks.
- Do not run destructive database commands such as `docker compose down -v`.
- Do not print secret values from `.env`.

## Per-Lane Checks

Use the smallest useful set:

```powershell
mingw32-make test-cpp
python -m unittest discover -s tests/python
python .\scripts\import_courses_to_postgres.py --dry-run
mingw32-make test-api-smoke
cd frontend
npm run build
```

For planning-only frontend builds, redirect output outside the repo when possible:

```powershell
npm run build -- --outDir "$env:TEMP\rv-vite-build" --emptyOutDir
```

## API Smoke Pitfalls

Before treating API smoke failure as a source failure, check:

- whether `build/requisite-api.exe` is locked by a running process
- whether port `8080` is occupied by another service such as `httpd`
- whether stale local binaries are older than the current source
- whether `API_BASE_URL`, `API_PORT`, or `COURSES_CSV_PATH` are influencing the run

Useful non-destructive probes:

```powershell
Get-Process | Where-Object { $_.ProcessName -like '*requisite*' } | Select-Object Id,ProcessName,Path
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 8080,5173,18080 } | Select-Object LocalAddress,LocalPort,OwningProcess
```

If the default API binary is locked, compile an alternate ignored target instead of killing processes:

```powershell
mingw32-make API_TARGET=build/requisite-api-plan-check.exe api
```

Then run a temporary-port health check with `COURSES_CSV_PATH` pointed at `tests\fixtures\courses_graph.csv`.

## Output Format

```md
## Verification Summary

## Commands Run

| Command | Result | Notes |
|---|---|---|

## Failures

State whether each failure appears related to the cleanup, environmental, or unknown.

## Skipped Checks

## Confidence

Choose one: strong, partial, weak.
```
