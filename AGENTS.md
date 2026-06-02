# AGENTS.md

Repository instructions for coding agents working on `requisite-visualization`.

## PERSISTENT RULE LOADING

AGENTS.md is not initialization-only context.

Treat each incoming user message as a fresh instruction cycle:
LOAD → SKIM → FILTER RELEVANT RULES → PLAN → EXECUTE

Required checkpoints:

- New user prompt
- Before edits
- Before tool calls
- Before commits
- Before branch operations
- Before large refactors
- Before autonomous multi-step execution

Do not cache AGENTS.md mentally and assume it remains fully applied. Re-read relevant sections.

## Project Overview

`requisite-visualization` is an early prototype for exploring UCSB course prerequisites. The intended product is a web app where students can search for a course, see direct and recursive prerequisites, inspect dependent courses, filter by academic unit, and eventually plan a path through courses or a degree sequence.

Current state:

- The C++ backend defaults to `API_DATA_SOURCE=postgres`, snapshots imported PostgreSQL data into an in-memory catalog/graph, and serves a local read-only API through `backend/src/api/HttpServer.cpp`.
- `API_DATA_SOURCE=csv` remains available for tests and local fallback work, reading `backend/data/courses.csv` or `COURSES_CSV_PATH`.
- PostgreSQL schema, Docker Compose setup, and an import script are part of the runtime data path after CSV generation.
- The executable in `backend/src/main.cpp` is currently a demo/test harness, not the final app runtime.
- `backend/api/API_STRATEGY.md` defines the implemented first-pass JSON contracts, including `/paths`, and remaining roadmap tradeoffs.
- `frontend/` is a Vite React + TypeScript course explorer using Cytoscape and backend `fetch()` calls during normal runtime.
- `scripts/generate_courses_csv.py` fetches UCSB Coursedog data and writes the current all-UCSB CSV with college, subject, and department metadata.

Current integration status:

- The first backend API is implemented and the frontend normal runtime uses backend `fetch()` calls.
- The graph UI uses a professional light workspace by default with a dark mode option, circular course nodes, click-to-inspect details, zoom/navigation controls, fullscreen behavior, and solid bright colors for alternative prerequisite groups.
- Catalog generation now targets the current UCSB catalog by default and preserves college, department, and subject metadata for frontend filters.

Target data flow:

```text
UCSB Coursedog catalog
  -> scripts/generate_courses_csv.py
  -> backend/data/courses.csv
  -> PostgreSQL import
  -> C++ catalog/API startup snapshot
  -> API
  -> React/TypeScript visualization with fetch-based data loading
```

## Global Agent Rules

- Read the relevant code before editing. This project is small enough that most backend/data tasks should inspect the touched files directly.
- Do not read, print, commit, or summarize secret values from `.env`.
- Do not run destructive database commands such as `docker compose down -v` unless the user explicitly asks for a reset.
- Do not rewrite generated or data-heavy files unless the task is specifically about data generation/import.
- Keep changes scoped to the assigned lane. If multiple agents are working, do not edit another lane's owned files without coordinating.
- Prefer small, reviewable patches over broad refactors.
- Add or update tests for behavior changes whenever a test surface exists. If tests do not exist yet, create the smallest useful harness for the lane.
- Keep documentation and code names honest. For example, `CountPaths` currently returns shortest path length, not a count of all paths.

## Agent Intelligence And Time Budgeting

Use reasoning effort based on decision risk and blast radius, not on how large the edit looks. The default for normal repository work is `medium`.

- Print current reasoning tier at every reasoning switch. Example: "REASONING: low"
- Use more intelligence for irreversible or cross-lane decisions, not for mechanical work.
- Do not use high reasoning to compensate for not reading code; inspect first.
- Escalate reasoning when changing API contracts, schema, generated data formats, graph semantics, dependencies, or runtime source of truth.
- De-escalate once the migration path and contract are stable.
- Workers should state their assigned reasoning tier, risk level, expected files, and whether they need escalation before editing.

Use `high` reasoning for:

- Graph/catalog architecture, recursive traversal, cycle/path logic, and grouped prerequisite semantics.
- Database schema evolution, external prerequisite modeling, credits modeling, and all-UCSB catalog expansion.
- API framework/dependency choice, JSON contract design, source-of-truth boundaries, and CORS/error policy.
- Cytoscape layout/performance decisions, fullscreen behavior, large graph UX, and fetch-state architecture.
- Cross-lane refactors or migrations.

Use `xhigh` only for decisions that are both hard to reverse and likely to affect multiple lanes, such as changing the runtime source of truth, replacing the graph representation, redesigning prerequisite semantics, or changing generated catalog/schema contracts after another lane depends on them.

Use `low` reasoning for:

- Component renames, label changes, small CSS cleanup, documentation wording, boilerplate, and route/component plumbing after contracts are stable.

Before major refactors or migrations:

1. Run `git status --short`.
2. Inspect the full dependency chain for the lane, including call sites, tests, docs, generated-data assumptions, and API/frontend consumers.
3. Check `AGENTS.md`, `backend/api/API_STRATEGY.md`, `docs/data-quality.md`, `docs/architecture.md`, and `TODO.md` if it exists.
4. Write a brief migration strategy covering old behavior, new behavior, compatibility, tests, and rollback or handoff.

## Branch, Commit, And Push Policy

- At the start of any coding task, run `git status --short --branch` or `git branch --show-current` plus `git status --short` so the active branch and worktree state are known before edits.
- Never push to `main` autonomously. Only push `main` when the user explicitly asks for that push in the current task.
- If an agent is on `main` and the task does not explicitly require committing or pushing on `main`, keep work local and ask before any commit or branch-changing operation that would affect `main`.
- On branches such as `experiment`, complete meaningful milestones by running the relevant build/tests/checks for the touched lane. If they pass, commit and push the focused changes.
- A meaningful milestone means the requested behavior or documentation slice is complete, scoped, and verified enough to be useful on its own.
- If the relevant checks fail, do not commit or push unless the user explicitly asks for a checkpoint.
- Do not push broken mid-task work unless the user explicitly asks for a checkpoint push.
- Keep commits focused. Stage only files that belong to the milestone, avoid unrelated worktree changes, and include a short commit summary describing what changed.
- Before every commit or push, re-run `git status --short --branch` and review the staged diff so secrets, generated data, cache files, and unrelated changes are not included.

## Rate-Limit Pause And Handoff

If Codex usage, credit, or rate-limit remaining reaches 10% or lower, all agents must pause project work and preserve progress for after limits reset.

Trigger conditions:

- The Codex Usage panel, `/status`, CLI/app warning, or parent coordinator reports 10% or less remaining usage/credits.
- A rate-limit or credit exhaustion warning appears and continuing could strand partial work.
- A `429`, `Too Many Requests`, or `rate limit reached` response occurs during agent work.

Required behavior:

- Stop spawning or messaging subagents.
- Do not start new implementation work, broad searches, dependency installs, builds, test suites, generated-data refreshes, or Docker/database operations.
- Finish only the smallest safe atomic action already in progress, such as completing the current file write if stopping mid-write would corrupt a file.
- Do not repeatedly retry rate-limited requests. Back off and wait for the reset instead of burning remaining quota.
- Avoid committing or pushing automatically unless the user explicitly asked for that before the pause.

Progress preservation steps:

1. Run `git status --short` if possible.
2. Capture the active lane, current task, files changed, commands already run, verification state, blockers, and exact next step.
3. If enough quota remains for one small write, create or update `AGENT_HANDOFF.md` at the repo root with the handoff template below. This file is a temporary working note for resuming after reset.
4. If there is not enough quota for a file write, put the same handoff content in the final response.
5. Tell the user work is paused because the remaining Codex limit is at or below 10%, and recommend resuming the same thread with `/resume` after reset. If the thread is large, recommend `/compact` before resuming.

Handoff template:

```md
# Agent Handoff

Paused because Codex remaining usage was at or below 10%.

## Active Lane

- Lane:
- Task:
- Status:

## Files Touched

-

## Commands Run

-

## Verification

- Passed:
- Not run:
- Blocked:

## Current State

-

## Next Step After Limit Reset

1.
```

## Current Tooling And Commands

Use PowerShell-compatible commands on Windows.

Build C++ backend:

```powershell
mingw32-make
```

Build C++ API server:

```powershell
mingw32-make api
```

Run local API server:

```powershell
.\build\requisite-api.exe
```

Run current demo executable:

```powershell
.\build\requisite-visualization.exe
```

Run C++ graph tests:

```powershell
mingw32-make test-cpp
```

Run API smoke test:

```powershell
mingw32-make test-api-smoke
```

Clean build artifacts:

```powershell
mingw32-make clean
```

Start local PostgreSQL:

```powershell
docker compose up -d postgres
```

If `docker` is installed but not on PATH, use:

```powershell
.\scripts\enable-docker-path.ps1
```

Check DB connectivity and seed state:

```powershell
.\scripts\test-db-connection.ps1
```

Apply the current schema to an existing PostgreSQL volume:

```powershell
.\scripts\apply-db-migration.ps1
```

Dry-run the CSV-to-PostgreSQL import without connecting to a database:

```powershell
python .\scripts\import_courses_to_postgres.py --dry-run
```

Regenerate course CSV from UCSB Coursedog:

```powershell
python .\scripts\generate_courses_csv.py --output backend\data\courses.csv
```

Install and build the frontend:

```powershell
cd frontend
npm install
npm run build
```

Run the frontend dev server:

```powershell
cd frontend
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

Notes:

- `make` may not exist on Windows; `mingw32-make` is known to work in the current environment.
- Python dependencies are listed in `requirements.txt`; `scripts/generate_courses_csv.py` and `scripts/generate_program_requirements.py` require `requests`.
- Docker Desktop may be installed at `C:\Program Files\Docker\Docker\resources\bin\docker.exe` even when `docker` is not on PATH.
- The frontend currently builds with Vite and Cytoscape. A large Cytoscape bundle warning is acceptable unless the task is specifically about production bundle optimization.

## Architecture Notes

Important files:

- `backend/include/api/ApiModels.h`: API/catalog response models, including `CourseRecord`.
- `backend/include/Graph.h`: graph API, shortest-path compatibility wrapper, and grouped prerequisite access.
- `backend/include/PrerequisiteParser.h` and `backend/src/PrerequisiteParser.cpp`: grouped prerequisite parser.
- `backend/src/Graph.cpp`: CSV loading, graph construction, and BFS traversal.
- `backend/src/main.cpp`: demo executable with hardcoded path checks.
- `backend/src/DatabaseConfig.cpp`: reads and validates DB config but does not connect to PostgreSQL.
- `backend/api/API_STRATEGY.md`: implemented read-only API contracts and integration boundary.
- `backend/db/migrations/001_initial_schema.sql`: schema for courses and grouped prerequisites.
- `backend/db/seeds/001_sample_data.sql`: small sample dataset only.
- `backend/data/courses.csv`: generated all-UCSB catalog data.
- `scripts/generate_courses_csv.py`: UCSB catalog fetch, metadata extraction, and prerequisite parser.
- `scripts/import_courses_to_postgres.py`: dry-run and SQL-output capable CSV import script.
- `frontend/`: Vite React + TypeScript explorer with Cytoscape graph visualization and backend API fetches.
- `frontend/src/data/mockCatalog.ts`: development fixture only; normal runtime should not import it.
- `docs/prompts/connect-api-frontend-agents.md`: reusable coordinator prompt for the API/frontend/catalog integration push.

Known project facts from the planning pass:

- `backend/data/courses.csv` has 12,271 all-UCSB course rows.
- 2,156 rows have prerequisites.
- 1,232 prerequisite groups are `any` groups.
- 9 rows have blank credits.
- 569 prerequisite option references point outside the current all-UCSB CSV catalog.
- The Postgres seed has only 8 sample courses, 8 groups, and 13 options.
- The frontend normal runtime uses backend `fetch()` calls and no longer shows mock-catalog status.
- The current frontend graph uses Cytoscape with circular nodes, dark styling, fullscreen controls, and solid group-colored `any` edges.

## Repo-Local Skills

Lane-specific procedures are installed as repo-local skills under `.codex/skills/`. After the persistent `AGENTS.md` skim, open the matching skill before editing in that lane.

- Lane 1, Backend Graph And Catalog: `.codex/skills/requisite-backend-graph/SKILL.md`
- Lane 2, Database And Import Pipeline: `.codex/skills/requisite-catalog-import/SKILL.md`
- Lane 3, API And Integration Boundary: `.codex/skills/requisite-api-contracts/SKILL.md`
- Lane 4, Frontend Visualization: `.codex/skills/requisite-frontend-graph/SKILL.md`
- Lane 5, Testing And Dev Experience: `.codex/skills/requisite-test-devex/SKILL.md`
- Lane 6, Documentation And Product Decisions: `.codex/skills/requisite-docs-sync/SKILL.md`

If a task crosses lanes, identify the handoff point and use each relevant skill in dependency order. Keep universal safety, git, rate-limit, and coordination rules in this file; keep detailed lane workflows in the skills.

## Parallel Work Lanes

Use these lanes to split work across agents. Each lane owns a distinct set of files and should avoid overlapping edits with other lanes.

For the next full integration push, use `docs/prompts/connect-api-frontend-agents.md`. It is a coordinator prompt designed to spawn planning-only workers first, then implement backend API connection, all-UCSB catalog expansion, frontend fetch integration, professional light graph UI improvements with a dark mode option, testing, and documentation in a controlled order.

## Coordination Rules For Multiple Agents

- Start by choosing one lane and stating the files you expect to touch.
- If a task crosses lanes, identify the handoff point and make the smallest shared contract first.
- Do not let two agents edit the same file at the same time unless one is explicitly integrating.
- Backend graph work should not block on API/frontend decisions; keep a clean in-memory interface.
- Frontend normal runtime should stay on backend `fetch()` calls. Mock fixtures may be used only in tests or clearly labeled development-only paths.
- DB import work should not rewrite the C++ parser unless Lane 1 agrees on shared parsing ownership.
- Documentation updates should reflect actual behavior, not planned behavior, unless clearly labeled as roadmap.
- Catalog expansion and API integration must agree on stable field names for `college`, `department`, and `subject` before frontend multi-select filters are finalized.

## Definition Of Done

For any code change:

- Relevant build/test/check commands were run, or the reason they could not run is documented.
- New behavior is covered by tests when practical.
- Public names match behavior.
- Secrets are not printed or committed.
- README/AGENTS/docs are updated when setup commands, architecture, or workflow changes.
- The final response states what changed, what was verified, and what remains.
