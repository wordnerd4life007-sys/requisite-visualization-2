# Contributing

This project is a local UCSB prerequisite explorer. Optimize changes for a new contributor who needs to understand, run, test, and safely improve the repo.

## Setup

```powershell
python -m pip install -r requirements.txt
cd frontend
npm install
cd ..
Copy-Item .env.example .env
```

Edit `.env` for local PostgreSQL values before starting Docker. Do not commit `.env`.

## Run

```powershell
mingw32-make
mingw32-make api
docker compose up -d postgres
.\scripts\apply-db-migration.ps1
python .\scripts\import_courses_to_postgres.py --apply
$env:API_DATA_SOURCE='postgres'
.\build\requisite-api.exe
```

In another shell:

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

## Checks

Quick checks:

```powershell
mingw32-make test-cpp
python -m unittest discover -s tests/python
python .\scripts\import_courses_to_postgres.py --dry-run
cd frontend
npm run build
cd ..
```

Integration checks:

```powershell
mingw32-make test-api-smoke
mingw32-make test-api-smoke-postgres
```

The PostgreSQL smoke check assumes Docker Postgres is running, migrations have been applied, and the generated catalog has been imported.

## Frontend Smoke

When frontend behavior changes, run the app against the API and manually verify search, selected course details, prerequisite/dependent sections, graph rendering, node click selection, college filters, zoom/fit/reset controls, fullscreen enter/exit, and the backend-unavailable error state.

## Generated Files

- `backend/data/courses.csv` is generated but intentionally tracked as the reproducible catalog artifact. Regenerate it only for approved catalog/import work.
- `backend/data/programs.json` is generated exploratory program metadata and is ignored by default.
- `frontend/node_modules/`, `frontend/dist/`, `frontend/.vite/`, `build/`, and Python `__pycache__/` are build artifacts.
- `.env` and local environment files must not be committed.

## Safe First Tasks

- Documentation wording that makes implemented behavior clearer.
- Focused tests for parser fixtures, import dry-run behavior, or API smoke expectations.
- Small frontend states that preserve normal backend `fetch()` runtime.
- Cleanup of generated-file hygiene that does not rewrite `backend/data/courses.csv`.

Avoid broad architecture changes, generated catalog refreshes, database resets, API contract changes, or frontend runtime-source changes unless the task explicitly approves them.
