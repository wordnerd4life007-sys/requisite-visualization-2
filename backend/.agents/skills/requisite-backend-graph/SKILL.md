---
name: requisite-backend-graph
description: Work on requisite-visualization C++ backend graph and catalog behavior. Use when tasks touch backend/include/Graph.h, backend/src/Graph.cpp, prerequisite parsing, recursive traversal, dependent/prerequisite queries, shortest paths, cycles, grouped prerequisite semantics, CountPaths naming, or in-memory graph query interfaces.
---

# Requisite Backend Graph

## Workflow

Use the Backend Graph And Catalog lane. Start by stating reasoning tier, risk level, expected files, and whether escalation is needed. Use high reasoning for graph architecture, recursive traversal, cycle/path logic, grouped prerequisite semantics, and catalog abstractions.

Read the touched files before editing. Include call sites and tests when changing behavior exposed to the API or frontend.

Primary files:

- `backend/include/Graph.h`
- `backend/src/Graph.cpp`
- `backend/include/PrerequisiteParser.h`
- `backend/src/PrerequisiteParser.cpp`
- new backend catalog/parser files under `backend/include/` and `backend/src/`

## Implementation Rules

Keep flattened graph edges for traversal, but preserve grouped prerequisite semantics separately. Do not collapse `all` and `any` groups into behavior that loses meaning.

Preserve `groupIndex`; frontend edge coloring depends on stable alternative-group indexes.

Prefer const references for string inputs and keep heavy includes out of headers when practical.

Do not make PostgreSQL mandatory in this lane unless the user task explicitly crosses into the DB/API source-of-truth boundary.

Continue replacing `CountPaths` call sites with correctly named shortest-path APIs when working nearby. Keep public names honest.

Provide clean in-memory query interfaces for API consumers, including graph neighborhoods with `groupType` and `groupIndex`.

## Target Capabilities

Support direct prerequisites, recursive prerequisites, direct dependents, recursive dependents, shortest path with path reconstruction, and cycle detection.

When adding traversal behavior, cover grouped prerequisites and external prerequisite references when a test surface exists.

## Verification

Use the smallest relevant checks first:

```powershell
mingw32-make
mingw32-make test-cpp
```

If API-facing graph output changes, also run the API smoke checks that exercise the changed contract.
