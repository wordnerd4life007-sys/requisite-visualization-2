# Architecture

This document describes the current local architecture for `requisite-visualization` and separates implemented behavior from remaining roadmap work.

## Implemented Data Flow

```text
UCSB Coursedog catalog
  -> scripts/generate_courses_csv.py
  -> backend/data/courses.csv
  -> scripts/import_courses_to_postgres.py --apply
  -> PostgreSQL
  -> C++ API startup snapshot
  -> React/TypeScript visualization
```

The generated CSV remains the reproducible ingestion artifact. PostgreSQL is the default runtime source for the API after import, while `API_DATA_SOURCE=csv` remains available for tests and local fallback work.

## Catalog Layer

`scripts/generate_courses_csv.py` fetches current UCSB Coursedog records and writes:

```text
id,name,credits,college,prereqs,subject,department
```

The first five columns remain compatible with older graph code. `subject` and `department` support API responses and frontend filters. The generator can filter by exact college label with `--college`, and the default output is all current UCSB courses for the chosen effective date.

## Backend API

The API server is implemented in C++ under:

- `backend/include/api/`
- `backend/src/api/`

`backend/src/api/HttpServer.cpp` is a small standalone local HTTP server. It binds to `127.0.0.1`, defaults to `API_PORT=8080`, loads `.env` without overriding existing shell variables, and selects its catalog source with `API_DATA_SOURCE`.

Catalog source behavior:

- `API_DATA_SOURCE=postgres` is the default. It connects with `DatabaseConfig`, reads the imported catalog from PostgreSQL, and snapshots it into the shared in-memory graph/search model at startup.
- `API_DATA_SOURCE=csv` uses `COURSES_CSV_PATH` when set, otherwise `backend/data/courses.csv`, `data/courses.csv`, or `courses.csv`.

Implemented endpoints:

```text
GET /health
GET /courses
GET /courses/:id
GET /courses/:id/prerequisites
GET /courses/:id/dependents
GET /graph?course=CMPSC%2016&direction=both&depth=3
```

The API preserves grouped prerequisite semantics with `groupType` and `groupIndex`, while also returning flattened IDs and graph edges for visualization. External prerequisite references remain visible with `external` flags.

## Frontend

`frontend/` is a Vite React + TypeScript app using Cytoscape for graph visualization. It uses `fetch()` through `frontend/src/api/client.ts`; normal runtime does not import `frontend/src/data/mockCatalog.ts`.

Implemented UI behavior:

- Course search and selected-course detail from backend API data.
- Prerequisite and dependent sections from backend relationship endpoints.
- Graph neighborhoods from `/graph`.
- Multi-select college filters and subject filtering.
- Dark high-contrast workspace.
- Circular course nodes.
- Clickable graph nodes that refetch and display course details.
- Fit, zoom in, zoom out, reset, and fullscreen controls.
- Solid bright colors for `any` prerequisite groups, keyed by `groupIndex`.

## Database Layer

Current database state:

- Docker Compose can start PostgreSQL.
- The migration defines tables for courses and grouped prerequisites, including `subject` and `department` course metadata.
- The seed file contains a small sample dataset.
- `scripts/import_courses_to_postgres.py` supports dry-run validation and exact-mirror import of the expanded CSV.
- External prerequisite ids remain allowed in `course_prerequisite_options`.

Remaining database work:

- Add richer modeling for non-course prerequisite requirements if the product needs to show them outside parser notes.
- Decide whether future imports should preserve raw prerequisite text or parser diagnostics.

## Open Architecture Decisions

- `/paths` endpoint and path reconstruction ownership.
- Long-term HTTP server strategy if the local socket server grows too much.
- Modeling concurrent enrollment, minimum grades, standing requirements, instructor consent, and non-course prerequisites.
- Frontend test strategy for Cytoscape interactions.
