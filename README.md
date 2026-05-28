# requisite-visualization

`requisite-visualization` is a local UCSB course prerequisite explorer. It loads the current generated UCSB catalog, serves a read-only C++ API, and renders a Vite React + TypeScript graph UI for searching courses, inspecting prerequisite groups, viewing dependents, and exploring graph neighborhoods.

## Current Behavior

- `scripts/generate_courses_csv.py` fetches UCSB Coursedog data and writes `backend/data/courses.csv`.
- `backend/data/courses.csv` currently contains 12,271 UCSB course rows with `college`, `subject`, and `department` metadata.
- The C++ API server defaults to `API_DATA_SOURCE=postgres`, loads a PostgreSQL snapshot into memory at startup, and serves course, prerequisite, dependent, and graph responses from `backend/src/api/HttpServer.cpp`.
- `API_DATA_SOURCE=csv` keeps the previous CSV runtime available for tests and local fallback work.
- `frontend/` is a Vite React + TypeScript app using `fetch()` calls against the backend API. Normal runtime does not use `frontend/src/data/mockCatalog.ts`.
- PostgreSQL is now the default runtime source after importing the generated CSV.
- `backend/src/main.cpp` remains a small demo executable separate from the API server.

## Run Locally

Build the backend demo and API:

```powershell
mingw32-make
mingw32-make api
```

On Windows with PostgreSQL installed outside MSYS2, the Makefile defaults to `C:/PROGRA~1/POSTGR~1/18`. Override these if needed:

```powershell
mingw32-make api PG_ROOT=C:/Path/To/PostgreSQL/18
```

Start local PostgreSQL and apply the schema to existing volumes:

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

The API binds to `127.0.0.1` and defaults to port `8080`. Override with:

```powershell
$env:API_PORT='18080'
.\build\requisite-api.exe
```

Use the CSV-backed runtime explicitly when testing without PostgreSQL:

```powershell
$env:API_DATA_SOURCE='csv'
.\build\requisite-api.exe
```

Start the frontend:

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`.

## Useful Checks

```powershell
mingw32-make test-cpp
python -m unittest discover -s tests/python
mingw32-make test-api-smoke
mingw32-make test-api-smoke-postgres
python .\scripts\import_courses_to_postgres.py --dry-run
cd frontend
npm run build
```

The Vite build currently reports a large Cytoscape chunk warning. That warning is expected until bundle splitting is addressed.

## API

Implemented read-only endpoints:

```text
GET /health
GET /courses?q=&subjects=&colleges=&limit=
GET /courses/:id
GET /courses/:id/prerequisites
GET /courses/:id/dependents
GET /graph?course=&direction=&depth=&subjects=&colleges=
```

Responses include `id`, `name`, `credits`, `college`, `department`, `subject`, grouped prerequisites, `groupType`, `groupIndex`, and external prerequisite flags. See `backend/api/API_STRATEGY.md` for examples and current contract details.

## Catalog Generation

Regenerate the current all-UCSB catalog:

```powershell
python .\scripts\generate_courses_csv.py --output backend\data\courses.csv
```

Generate only selected college labels:

```powershell
python .\scripts\generate_courses_csv.py --college "College of Engineering" --output $env:TEMP\courses_coe.csv
```

`scripts/generate_courses_csv.py` requires `requests`. Python dependencies are not pinned yet.

## PostgreSQL

PostgreSQL is the default API runtime source. Docker Compose and schema files are available for local development:

- `backend/db/migrations/001_initial_schema.sql`
- `backend/db/seeds/001_sample_data.sql`

Start local PostgreSQL:

```powershell
docker compose up -d postgres
```

Check connectivity:

```powershell
.\scripts\test-db-connection.ps1
```

Docker only runs init scripts when the `postgres_data` volume is first created. For an existing volume, apply the migration manually:

```powershell
.\scripts\apply-db-migration.ps1
```

The import script treats `backend/data/courses.csv` as authoritative when applying SQL: courses missing from the latest CSV are removed from PostgreSQL, while external prerequisite ids remain represented in `course_prerequisite_options`.

Do not run `docker compose down -v` unless you intentionally want to delete the local `postgres_data` volume.

## Prerequisite Semantics

Prerequisites are represented as grouped requirements:

```text
AND course, AND course | OR option, OR option; OR option, OR option
```

Every `all` group must be completed. Every `any` group requires one option from that group. Flattened prerequisite-to-course edges are useful for traversal and graph display, but the grouped data remains the source for prerequisite semantics.

## Remaining Work

- Add `/paths` and path reconstruction to the API.
- Improve parser handling for concurrent enrollment, minimum grades, standing, instructor consent, and non-course requirements.
- Add frontend tests beyond the current build and browser smoke workflow.
- Split the Cytoscape bundle if production bundle size becomes important.
