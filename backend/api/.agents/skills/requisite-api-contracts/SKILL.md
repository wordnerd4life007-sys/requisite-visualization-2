---
name: requisite-api-contracts
description: Work on requisite-visualization backend API contracts, handlers, JSON models, CORS behavior, catalog source selection, and smoke tests. Use when tasks touch backend API files, backend/api/API_STRATEGY.md, DatabaseConfig, API response fields, endpoint behavior, or frontend-facing contract changes.
---

# Requisite API Contracts

## Workflow

Use the API And Integration Boundary lane. State reasoning tier, risk level, expected files, and whether escalation is needed. Use high reasoning for API framework choices, JSON contract design, source-of-truth boundaries, CORS/error policy, and dependency changes.

Read `backend/api/API_STRATEGY.md`, handler/model files, catalog implementations, tests, and frontend API consumers before changing contracts.

Primary files:

- `backend/include/api/ApiModels.h`
- `backend/include/api/ApiHandlers.h`
- `backend/include/api/ApiJson.h`
- `backend/include/api/Catalog.h`
- `backend/include/api/InMemoryCatalog.h`
- `backend/src/api/`
- `backend/src/DatabaseConfig.cpp`
- `backend/include/DatabaseConfig.h`
- build files needed for API dependencies

## Contract Rules

Keep read-only JSON contracts stable and small. When a breaking change is unavoidable, update docs, tests, and frontend consumers together.

Include `college`, `department`, `subject`, `description` when available, grouped prerequisites, `groupType`, `groupIndex`, and external prerequisite fields needed by the frontend.

Validate DB configuration instead of silently accepting invalid values. Redact passwords and secret values in logs and errors.

Keep CORS behavior compatible with the Vite frontend.

The implemented endpoint family is:

```text
GET /health
GET /courses?q=&subjects=&colleges=&limit=
GET /courses/:id
GET /courses/:id/prerequisites
GET /courses/:id/dependents
GET /graph?course=&direction=&depth=&subjects=&colleges=
GET /paths?from=&to=
```

## Source Boundary

The API defaults to `API_DATA_SOURCE=postgres`, snapshots PostgreSQL into memory at startup, and keeps `API_DATA_SOURCE=csv` for tests and fallback work.

Do not change the runtime source of truth without a migration strategy covering old behavior, new behavior, compatibility, tests, and rollback or handoff.

## Verification

Use the smallest relevant checks first:

```powershell
mingw32-make api
mingw32-make test-api-smoke
mingw32-make test-api-smoke-postgres
```

For contract changes, also run focused C++/Python tests and inspect frontend API client compatibility.
