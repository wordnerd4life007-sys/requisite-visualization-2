# Codex Coordinator Prompt: Connect Backend API To Frontend

Use this prompt from the repository root when you want Codex to coordinate multiple agents to connect the backend API to the React frontend and improve the graph UI.

```text
You are the coordinator for `requisite-visualization`.

First, read `AGENTS.md` completely and follow it strictly.

Before spawning agents:
- Check the current session/status if available.
- If remaining Codex usage/credits/rate-limit is at or below 10%, stop and create the required handoff instead of starting work.
- Run `git status --short`.
- Do not read or print `.env`.
- Do not run destructive database commands such as `docker compose down -v`.
- Follow the intelligence policy in `AGENTS.md`: use more reasoning for irreversible or cross-lane decisions, inspect code before escalating, and de-escalate after contracts and migration paths are stable.

Goal:
Completely connect the backend API to the frontend. The web app must stop depending on `frontend/src/data/mockCatalog.ts` at runtime and should use backend `fetch()` calls for course search, course detail, prerequisites, dependents, and graph neighborhoods. The frontend should become a polished dark graph explorer with a black background, circular course nodes, click-to-inspect course details, clear zoom/navigation controls, working fullscreen behavior, multi-select college filters, and bright solid group colors for alternative prerequisite groups.

Spawn these workers in planning-only mode first. Each worker must read `AGENTS.md`, state its assigned reasoning tier, risk level, files it expects to touch, whether it needs escalation before editing, and a small implementation plan. Use the reasoning tiers below when spawning workers or splitting follow-up implementation:

1. Backend API worker
   Reasoning:
   - Use `high` for API planning, HTTP dependency selection, source-of-truth boundaries, and JSON contract changes.
   - Use `medium` for implementation after the contract and dependency choice are stable.

   Ownership:
   - `backend/api/`
   - new API files under `backend/include/` and `backend/src/`
   - API-related `Makefile` changes only after coordinating with the testing/dev worker

   Tasks:
   - Select the smallest practical HTTP API approach for this repo and document why.
   - Implement read-only endpoints matching or intentionally updating `backend/api/API_STRATEGY.md`.
   - Serve data from the in-memory catalog/graph layer first; PostgreSQL can remain optional unless already ready.
   - Add CORS for the Vite frontend.
   - Include endpoints for:
     - `GET /health`
     - `GET /courses?q=&subjects=&colleges=&limit=`
     - `GET /courses/:id`
     - `GET /courses/:id/prerequisites`
     - `GET /courses/:id/dependents`
     - `GET /graph?course=&direction=&depth=&subjects=&colleges=`
   - Include `college`, `department`, `subject`, `credits`, prerequisite group metadata, `groupType`, and `groupIndex` in responses.
   - Return stable JSON errors and never log secrets.

2. Catalog expansion worker
   Reasoning:
   - Use `high` for catalog field modeling, Coursedog metadata interpretation, prerequisite parser changes, and import behavior.
   - Use `xhigh` only for schema changes, generated data contract changes, or source-of-truth changes that affect API/frontend workers.

   Ownership:
   - `scripts/generate_courses_csv.py`
   - `backend/data/` generated catalog files only when explicitly regenerating data for this task
   - DB import script updates that are only about expanded catalog fields

   Tasks:
   - Expand catalog generation beyond the current College of Engineering subset to the current UCSB course catalog available from Coursedog.
   - Preserve or add fields needed for filtering by college, department, and subject.
   - Avoid hardcoding one college list if the Coursedog source exposes academic group metadata.
   - Keep prerequisite parsing offline-testable and avoid network access in unit tests.
   - Regenerate data only after the script change is reviewable and the coordinator authorizes the generated file update.

3. Frontend integration and UI worker
   Reasoning:
   - Use `medium` for API client integration once response contracts are stable.
   - Use `high` for Cytoscape layout/performance, fullscreen behavior, large-graph UX, and fetch-state architecture.
   - Use `low` for labels, small CSS cleanup, and component plumbing after behavior is settled.

   Ownership:
   - `frontend/`

   Tasks:
   - Replace runtime use of `mockCatalog.ts` with an API client using `fetch()`.
   - Keep a small development fallback or fixture only if the backend is unavailable, and label it clearly in code, not as the normal UI state.
   - Add loading, error, and empty states that do not block graph navigation.
   - Make the app visually dark with a black background and high contrast.
   - Render course nodes as circles.
   - Clicking a course circle must select it and show detail information. Fetch fresh detail if needed.
   - Improve Cytoscape zoom and graph navigation with fit, zoom in, zoom out, reset, and usable wheel/touch behavior.
   - Fix fullscreen. Use the browser Fullscreen API for the graph workspace and add a CSS fallback class for browsers that fail fullscreen requests.
   - Replace dotted OR-group lines with solid bright colors. Each `any` prerequisite group should get its own stable neon color, such as green, purple, or blue, based on `groupIndex`. Required `all` edges should remain visually distinct but less dominant.
   - Add multi-select college filtering. Users must be able to choose more than one college and also choose a subset rather than all colleges.
   - Keep the first screen as the explorer, not a landing page.

4. Testing and developer experience worker
   Reasoning:
   - Use `medium` for focused test harnesses and command wiring.
   - Use `high` for cross-stack contract tests, CI strategy, and shared build/dependency changes.

   Ownership:
   - tests
   - `Makefile`
   - frontend test/build scripts
   - CI or helper scripts if needed

   Tasks:
   - Add backend endpoint smoke tests or contract tests.
   - Add frontend API-client tests if the project setup supports them without heavy tooling.
   - Add focused tests for all-college catalog parsing and group-color metadata.
   - Verify `mingw32-make test-cpp`, backend API startup, and `npm run build`.
   - Use Playwright or the in-app browser for a visual check of the graph if practical.

5. Documentation worker
   Reasoning:
   - Use `low` for wording updates and command documentation.
   - Use `medium` when documenting open product decisions, architecture tradeoffs, or cross-lane handoffs.

   Ownership:
   - `README.md`
   - `docs/`
   - `AGENTS.md`

   Tasks:
   - Keep docs honest about implemented behavior versus planned work.
   - Document how to run the backend API and frontend together.
   - Document the all-UCSB catalog scope and any remaining data caveats.

Implementation order after all plans report:
1. Backend API contract and catalog query boundary.
2. Catalog expansion script changes, then regenerate data only if authorized.
3. Frontend API client integration using the stable contract.
4. Dark graph UI, node details, fullscreen, zoom/navigation, and multi-college filters.
5. Tests and docs.

Definition of done:
- The frontend no longer shows fixture-backed catalog messaging during normal operation.
- The frontend uses backend `fetch()` calls for courses, course detail, relationships, and graph data.
- Course nodes are circular and clickable.
- The selected course detail panel updates from real API data.
- Alternative prerequisite groups use solid bright group-specific colors.
- Multi-select college filtering works and affects the rendered graph.
- Fullscreen works or has a reliable in-app fallback.
- `mingw32-make test-cpp`, backend build/API smoke checks, and `npm run build` pass, or blockers are documented.
- Final response states what changed, what was verified, what is still mocked if anything, and how to run the full app.
```
