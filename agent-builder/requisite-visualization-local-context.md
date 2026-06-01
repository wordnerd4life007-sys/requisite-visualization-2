# Requisite Visualization Local Context

## Purpose

This appendix makes the cleanup contracts specific to this repository while keeping the role contracts reusable.

Use it with:

- `cleanup-coordinator.md`
- `cleanup-audit-planner.md`
- `cleanup-implementer.md`
- `cleanup-verifier.md`
- `cleanup-reviewer.md`
- `cleanup-docs-curator.md`

## Current Project Shape

`requisite-visualization` is a local UCSB course prerequisite explorer.

Implemented flow:

```text
UCSB Coursedog catalog
  -> scripts/generate_courses_csv.py
  -> backend/data/courses.csv
  -> scripts/import_courses_to_postgres.py --apply
  -> PostgreSQL
  -> C++ API startup snapshot
  -> React/TypeScript visualization
```

PostgreSQL is the default local API runtime source after importing the generated CSV. `API_DATA_SOURCE=csv` remains available for tests and local fallback work.

## Contributor-Facing Cleanup Goal

Optimize first for a new outside developer who wants to:

- understand what the project does
- install the right tools
- run backend and frontend locally
- run meaningful checks
- know which files are generated, ignored, or high risk
- find a safe first task

## Lanes

Use these owner lanes when ranking or assigning cleanup tasks:

- Backend/C++ graph and catalog
- API and integration boundary
- Frontend visualization
- Database and import pipeline
- Testing and developer experience
- Documentation and product decisions
- Local agent workflow

## High-Risk Or Special Files

Be careful with:

- `.env` and local environment files
- `backend/data/courses.csv`
- database migrations and seeds
- `docker-compose.yml`
- `Makefile`
- frontend lockfiles
- API contract docs
- generated build files under `build/`
- ignored scratch reports such as `feedback.md` and `review.md`

## Generated And Ignored File Policy

- `agent-builder/` is a tracked workflow pack for local and OpenAI-style agent orchestration.
- `backend/data/courses.csv` is generated and data-heavy. Do not rewrite it unless the approved task explicitly names it.
- `build/`, `frontend/dist/`, `frontend/node_modules/`, Python `__pycache__/`, and object/dependency files are build artifacts.
- `.env` must not be read, printed, summarized, committed, or rewritten.

## Useful Commands

Backend:

```powershell
mingw32-make
mingw32-make api
mingw32-make test-cpp
mingw32-make test-api-smoke
```

Python/data:

```powershell
python -m unittest discover -s tests/python
python .\scripts\import_courses_to_postgres.py --dry-run
```

Frontend:

```powershell
cd frontend
npm run build
```

Run frontend locally:

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

Run API locally:

```powershell
.\build\requisite-api.exe
```

Override API port:

```powershell
$env:API_PORT='18080'
.\build\requisite-api.exe
```

## Known Baseline From Planning

These were observed during the contract-pack planning pass:

- `mingw32-make test-cpp` passed.
- `python -m unittest discover -s tests/python` passed.
- `python .\scripts\import_courses_to_postgres.py --dry-run` passed.
- Frontend build passed when Vite output was redirected outside the repo.
- The Vite build reported the known large Cytoscape chunk warning.
- `mingw32-make test-api-smoke` was blocked because `build/requisite-api.exe` was locked by a running process.
- Port `8080` was occupied by `httpd`, not the C++ API.
- Current API source compiled to an alternate ignored binary and served `/health` successfully from `tests\fixtures\courses_graph.csv`.

Treat these as local observations, not permanent repo truth. Recheck when using the contracts.

## API Smoke Diagnostic Commands

Check for locked local API binaries:

```powershell
Get-Process | Where-Object { $_.ProcessName -like '*requisite*' } | Select-Object Id,ProcessName,Path
```

Check common ports:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 8080,5173,18080 } | Select-Object LocalAddress,LocalPort,OwningProcess
```

Compile an alternate ignored API binary when the default binary is locked:

```powershell
mingw32-make API_TARGET=build/requisite-api-plan-check.exe api
```

## Open Decisions To Defer

Do not decide these during routine cleanup:

- when, or whether, to retire the CSV fallback runtime source
- future path variants beyond the implemented shortest dependent-chain path
- long-term HTTP server strategy
- external prerequisite modeling
- blank, variable, and nonstandard credits modeling
- parser support for concurrent enrollment, minimum grades, standing, instructor consent, and non-course requirements
- frontend test strategy for Cytoscape graph interactions
- deployment target and audience beyond local development

## Local Git Policy

- Check status before editing.
- Ignore unrelated user changes.
- Push only when the user explicitly requests it in the current task.
- A focused commit is allowed only when the user requested or approved it for the completed cleanup task.
- Before any local commit, review `git status --short --branch` and the staged diff.
