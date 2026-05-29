---
name: requisite-docs-sync
description: Work on requisite-visualization documentation, README alignment, architecture notes, data-quality docs, product decisions, roadmap wording, and repo agent instructions. Use when tasks touch README.md, feedback.md, docs/, AGENTS.md, or documentation that must distinguish implemented behavior from planned behavior.
---

# Requisite Docs Sync

## Workflow

Use the Documentation And Product Decisions lane. State reasoning tier, risk level, expected files, and whether escalation is needed. Use low reasoning for wording cleanup and medium or high reasoning when docs encode architecture, source-of-truth, schema, API, or cross-lane decisions.

Read the implementation or authoritative docs before changing claims. Documentation must reflect actual behavior unless explicitly labeled as roadmap or open decision.

Primary files:

- `README.md`
- `feedback.md`
- `docs/`
- `AGENTS.md`
- lane-specific docs such as `backend/api/API_STRATEGY.md`

## Documentation Rules

Keep README, architecture docs, data-quality docs, and API docs aligned with current implementation.

Keep wording aligned with the implemented Vite frontend and API integration.

Document setup commands, runtime options, current limitations, backend API startup, frontend API configuration, all-UCSB catalog scope, and parser caveats when those areas change.

Do not describe planned behavior as implemented. Mark roadmap, limitations, and open decisions clearly.

Avoid duplicating long lane procedures in `AGENTS.md`. Keep universal safety and routing there; keep task-specific workflows in repo-local skills under `.codex/skills/`.

## Open Decisions To Capture

Capture decisions or explicitly mark them as open when they affect implementation:

- UCSB college, school, division, department, and subject naming in filters
- PostgreSQL source of truth versus CSV runtime source
- C++ API versus a web-native backend
- external prerequisite modeling
- concurrent enrollment, minimum grades, standing requirements, and instructor consent
- local-only tool versus deployed app, class project, or portfolio app
- whether frontend fallback fixtures should remain after backend API integration

## Verification

For docs-only changes, verify links, command spelling, and consistency with current files. For docs tied to behavior changes, run or cite the lane checks used for the behavior.
