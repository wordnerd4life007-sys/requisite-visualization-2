# requisite-visualization

`requisite-visualization` is a local UCSB course prerequisite explorer. It loads the current generated UCSB catalog, serves a read-only C++ API, and renders a Vite React + TypeScript graph UI for searching courses, inspecting grouped prerequisites, viewing dependents, and exploring graph neighborhoods.

## What Is Implemented

- `scripts/generate_courses_csv.py` fetches UCSB Coursedog data and writes `backend/data/courses.csv`.
- `backend/data/courses.csv` currently contains 12,271 UCSB course rows with `college`, `subject`, and `department` metadata. The generation/import/API pipeline also supports course `description`; regenerate and import the CSV to populate descriptions in existing local data.
- PostgreSQL is the default API runtime source after importing the generated CSV.
- The C++ API server defaults to `API_DATA_SOURCE=postgres`, snapshots PostgreSQL data into memory at startup, and serves local read-only endpoints from `backend/src/api/HttpServer.cpp`.
- `API_DATA_SOURCE=csv` remains available for tests and local fallback work.
- `frontend/` is a Vite React + TypeScript app that uses backend `fetch()` calls during normal runtime. It does not use `frontend/src/data/mockCatalog.ts` in normal runtime.
- `backend/src/main.cpp` is still a small demo executable separate from the API server.

## Architecture

```text
UCSB Coursedog catalog
  -> scripts/generate_courses_csv.py
  -> backend/data/courses.csv
  -> scripts/import_courses_to_postgres.py --apply
  -> PostgreSQL
  -> C++ API startup snapshot
  -> React/TypeScript visualization
```

The generated CSV is the reproducible ingestion artifact. PostgreSQL is the default source for local API runtime, and CSV mode is kept for tests and fallback development.

More detail:

- `docs/architecture.md` explains the current local architecture.
- `docs/data-quality.md` records catalog and parser caveats.
- `backend/api/API_STRATEGY.md` documents API contracts and examples.

## Prerequisites

- PowerShell on Windows.
- `mingw32-make` for the C++ build.
- PostgreSQL client headers and libraries for the API build. The Makefile defaults to `C:/PROGRA~1/POSTGR~1/18` on Windows.
- Docker Desktop for the local PostgreSQL container.
- Python for catalog generation and import scripts.
- Node.js and npm for the Vite frontend.

Python dependencies are not pinned yet. `scripts/generate_courses_csv.py` requires `requests` when regenerating the catalog from Coursedog.

## Run Locally

Build the backend demo and API:

```powershell
mingw32-make
mingw32-make api
```

If PostgreSQL is installed somewhere else, override `PG_ROOT`:

```powershell
mingw32-make api PG_ROOT=C:/Path/To/PostgreSQL/18
```

Start local PostgreSQL and apply the schema. The migration command matters for existing Docker volumes because Postgres init scripts only run when the volume is first created.

```powershell
docker compose up -d postgres
.\scripts\apply-db-migration.ps1
```

Import the generated catalog into PostgreSQL:

```powershell
python .\scripts\import_courses_to_postgres.py --apply
```

Start the API server:

```powershell
$env:API_DATA_SOURCE='postgres'
.\build\requisite-api.exe
```

The API binds to `127.0.0.1` and defaults to port `8080`. To use a different port:

```powershell
$env:API_PORT='18080'
.\build\requisite-api.exe
```

Start the frontend in another shell:

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Runtime Options

Use the CSV-backed API runtime when testing without PostgreSQL:

```powershell
$env:API_DATA_SOURCE='csv'
.\build\requisite-api.exe
```

CSV mode reads `COURSES_CSV_PATH` when set. Otherwise it falls back to `backend/data/courses.csv`, `data/courses.csv`, or `courses.csv`.

The API server loads `.env` without overriding variables already set in the shell. Do not print or commit secret values from `.env`.

## Useful Checks

```powershell
mingw32-make test-cpp
python -m unittest discover -s tests/python
mingw32-make test-api-smoke
mingw32-make test-api-smoke-postgres
python .\scripts\import_courses_to_postgres.py --dry-run
```

Check the frontend build:

```powershell
cd frontend
npm run build
```

The Vite build currently reports a large Cytoscape chunk warning. That warning is expected until bundle splitting is addressed.

## API Summary

Implemented read-only endpoints:

```text
GET /health
GET /courses?q=&subjects=&colleges=&limit=
GET /courses/:id
GET /courses/:id/prerequisites
GET /courses/:id/dependents
GET /graph?course=&direction=&depth=&subjects=&colleges=
GET /paths?from=&to=
```

Responses include `id`, `name`, `description`, `credits`, `college`, `department`, `subject`, grouped prerequisites, `groupType`, `groupIndex`, external prerequisite flags, graph neighborhoods, and shortest dependent-chain paths. `/courses?q=` searches descriptions when the loaded catalog provides them.

See `backend/api/API_STRATEGY.md` for example responses, query details, and error contracts.

## Catalog And Database Notes

Regenerate the current all-UCSB catalog:

```powershell
python .\scripts\generate_courses_csv.py --output backend\data\courses.csv
```

Generate only selected college labels:

```powershell
python .\scripts\generate_courses_csv.py --college "College of Engineering" --output $env:TEMP\courses_coe.csv
```

The import script treats `backend/data/courses.csv` as authoritative when applying SQL: courses missing from the latest CSV are removed from PostgreSQL, while external prerequisite ids remain represented in `course_prerequisite_options`.

Database files:

- `backend/db/migrations/001_initial_schema.sql`
- `backend/db/seeds/001_sample_data.sql`

Local database helpers:

```powershell
.\scripts\test-db-connection.ps1
.\scripts\apply-db-migration.ps1
```

Do not run `docker compose down -v` unless you intentionally want to delete the local `postgres_data` volume.

## Prerequisite Semantics

Prerequisites are represented as grouped requirements:

```text
AND course, AND course | OR option, OR option; OR option, OR option
```

Every `all` group must be completed. Every `any` group requires one option from that group. Flattened prerequisite-to-course edges are useful for traversal and graph display, but grouped data remains the source for prerequisite semantics.

External prerequisite references are preserved with `external` flags instead of being silently dropped.

## Current Limitations

- Parser handling still needs improvement for concurrent enrollment, minimum grades, standing, instructor consent, and non-course requirements.
- Frontend tests are still limited beyond the current build and browser smoke workflow.
- The Cytoscape bundle has not been split for production bundle-size optimization.
- Python dependencies are not pinned yet.
