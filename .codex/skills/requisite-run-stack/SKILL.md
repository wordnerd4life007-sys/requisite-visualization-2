---
name: requisite-run-stack
description: Start and verify the requisite-visualization local development stack from end to end. Use when Codex needs to make this repo's PostgreSQL-backed C++ API server and Vite React frontend run locally, choose loopback addresses and ports, clean up stale port listeners safely, diagnose port conflicts, start background processes, or report the frontend/API URLs.
---

# Requisite Run Stack

## Defaults

Use these loopback-only addresses unless the user asks otherwise:

- PostgreSQL: `127.0.0.1:5432` through Docker Compose service `postgres`.
- API: `http://127.0.0.1:8080` with `API_PORT=8080`.
- Frontend: `http://127.0.0.1:5173` with `VITE_API_BASE_URL=http://127.0.0.1:8080`.

Prefer `postgres` data source for normal runtime. Use `csv` only when Docker/PostgreSQL is unavailable or the user wants a fast local fallback:

```powershell
.\.codex\skills\requisite-run-stack\scripts\start-requisite-stack.ps1 -DataSource csv
```

## Workflow

1. Re-read `AGENTS.md` first and follow its branch, secret, and destructive-command rules.
2. Run `git status --short --branch` before starting services so existing worktree state is known.
3. Use the bundled script for the normal start-to-finish path:

```powershell
.\.codex\skills\requisite-run-stack\scripts\start-requisite-stack.ps1
```

4. If ports are blocked, inspect the reported listener process names. Only clean up stale local dev listeners. Do not stop unrelated services just because they use the preferred port.
5. To remove stale listeners on the preferred API/frontend ports, rerun with:

```powershell
.\.codex\skills\requisite-run-stack\scripts\start-requisite-stack.ps1 -ForcePortCleanup
```

6. Report the final URLs and log paths. If a service fails, summarize the failing command and the relevant log path without printing `.env` contents or secret values.

## Script Behavior

The helper script:

- Builds the C++ API with `mingw32-make api`.
- Starts Docker Compose PostgreSQL when `-DataSource postgres` is used.
- Installs frontend dependencies with `npm install` only when `frontend/node_modules` is missing.
- Starts API and frontend in hidden background processes with logs under `.codex/run-stack-logs/`.
- Uses `127.0.0.1` bindings and `--strictPort` for Vite so accidental port drift is visible.
- Checks `/health` on the API and the frontend root page before declaring success.
- Leaves the Docker volume intact. Never use `docker compose down -v` for this workflow.

The script is conservative about port cleanup. Without `-ForcePortCleanup`, it reports any process listening on `8080` or `5173` and exits. With `-ForcePortCleanup`, it stops only the process bound to those ports, which is appropriate for stale `requisite-api.exe`, `node.exe`, `npm.cmd`, or Vite dev-server listeners after checking the names.

## Useful Variants

Choose alternate ports when the preferred ports are intentionally occupied:

```powershell
.\.codex\skills\requisite-run-stack\scripts\start-requisite-stack.ps1 -ApiPort 18080 -FrontendPort 15173
```

Start with CSV data, skipping Docker:

```powershell
.\.codex\skills\requisite-run-stack\scripts\start-requisite-stack.ps1 -DataSource csv
```

Skip process startup and only check current listeners and HTTP health:

```powershell
.\.codex\skills\requisite-run-stack\scripts\start-requisite-stack.ps1 -CheckOnly
```

## Failure Handling

If Docker is installed but not on `PATH`, run:

```powershell
.\scripts\enable-docker-path.ps1
```

If `mingw32-make` is missing, do not fall back to plain `make` unless the repo or user confirms it works in this environment.

If PostgreSQL starts but the API cannot load the catalog, run:

```powershell
.\scripts\test-db-connection.ps1
```

If the database is reachable but empty or stale, apply the existing non-destructive migration/import workflow only after inspecting the current import docs/scripts. Do not reset the Docker volume unless the user explicitly requests a reset.
