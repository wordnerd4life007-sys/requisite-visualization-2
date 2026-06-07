---
name: requisite-repo-cleanup
description: Purpose-led cleanup workflow for requisite-visualization. Use when the user wants to audit, rank, or implement repository cleanup that improves contributor onboarding, setup accuracy, docs truthfulness, command reliability, generated-file hygiene, test confidence, architecture clarity, handoff quality, or local agent workflow. Also use when asked to run repo cleanup agents or the cleanup coordinator.
---

# Requisite Repo Cleanup

## Overview

Drive cleanup from an explicit purpose, not from a vague desire to "make the repo better." Default purpose: make `requisite-visualization` easier for a new outside contributor to understand, run, test, and improve.

Use this skill as the Codex-native version of `.github/agents/repo-cleanup.agent.md` plus `agent-builder/cleanup-coordinator.md`. The source contracts remain useful references; this skill turns them into an executable repo-local workflow.

## Source Order

Before work, follow `AGENTS.md` exactly: re-read relevant rules, print the reasoning tier, inspect branch/worktree state, avoid secrets, and keep edits scoped.

Read these sources when they are relevant:

- `.github/agents/repo-cleanup.agent.md` for the original GitHub agent contract and audit output format.
- `agent-builder/cleanup-coordinator.md` for the local coordinator gates and stop conditions.
- `agent-builder/requisite-visualization-local-context.md` for current repo-specific cleanup context.
- `agent-builder/cleanup-audit-planner.md`, `cleanup-implementer.md`, `cleanup-verifier.md`, `cleanup-reviewer.md`, and `cleanup-docs-curator.md` when running that stage.
- Lane skills under scoped `.agents/skills/` branches when an approved cleanup task touches backend, API, frontend, data import, tests, or docs.

Treat `agent-builder/agent-builder.md` and `agent-builder/good-practices.md` as read-only source references unless the user explicitly approves editing them.

## Workflow Decision

1. If the user asks for an audit, cleanup backlog, repo review, outside-contributor readiness pass, or does not approve a named task, run audit mode only.
2. If the user clearly approves one named cleanup task and provides or implies scope, run implementation mode for that task only.
3. If the user asks to make or update cleanup workflow files, treat that as local agent workflow cleanup and edit only the requested workflow artifacts.
4. If the request would require secrets, destructive database actions, generated data rewrites, public API changes, broad architecture decisions, or unrelated dirty files in the edit target, stop and report the blocker.

## Purpose Filter

Start by writing the cleanup purpose in one sentence. If the user did not provide one, use:

```text
Purpose: improve first-time contributor confidence by making setup, repo structure, commands, docs, tests, generated-file policy, and handoffs easier to trust.
```

Use that purpose to rank work. Prefer tasks with high contributor impact, low or medium risk, small or medium effort, and strong verification. Do not let code polish outrank broken setup, stale docs, confusing source-of-truth claims, or unreliable checks unless the polish blocks contributor understanding.

## Audit Mode

Audit mode is read-only.

Start with:

```powershell
git status --short --branch
rg --files
```

Inspect the current source of truth:

- `AGENTS.md`
- `README.md`
- `docs/`
- `backend/api/API_STRATEGY.md`
- `Makefile`
- `frontend/package.json`
- `scripts/`
- `tests/`

Use targeted searches for contributor traps:

```powershell
rg -n "TODO|FIXME|HACK|Remaining Work|Open .*Decision|mock|fixture|deprecated|temporary" .
```

For each top item, include evidence, contributor impact, risk or blast radius, effort, owner lane, verification plan, and whether an explicit product or architecture decision is required.

Return:

```md
## Cleanup Audit

## Top 10 Tasks

| Rank | Task | Impact | Risk | Effort | Verification |
|---|---|---|---|---|---|

## Parking Lot

## Open Decisions Deferred

## Recommended First Task
```

End audit mode by asking the user to approve one named task before implementation.

## Implementation Mode

Implementation may start only when one cleanup task is clearly approved. Confirm or infer:

- goal and definition of done
- allowed files or lane
- behavior-change policy
- generated-data policy
- verification commands
- commit preference

Before edits, run `git status --short --branch`, re-read `AGENTS.md`, read affected files and nearby tests/docs, and check whether unrelated local changes touch the same files. If unrelated changes conflict with the task, stop and report.

Keep the diff small. Preserve public behavior unless the approved task explicitly says otherwise. Do not edit `.env`, print secrets, rewrite `backend/data/courses.csv`, weaken tests, change `.gitignore`, or alter generated/data-heavy files unless the approved task names them.

## Verification And Review

Run the smallest relevant checks for touched lanes:

```powershell
mingw32-make test-cpp
python -m unittest discover -s tests/python
python .\scripts\import_courses_to_postgres.py --dry-run
mingw32-make test-api-smoke
cd frontend
npm run build
```

For docs-only or workflow-only changes, validate structure, links, command spelling, and consistency with source contracts. For skill changes, run:

```powershell
python "$env:USERPROFILE\.codex\skills\.system\skill-creator\scripts\quick_validate.py" .agents\skills\requisite-repo-cleanup
```

Review the actual diff after verification. Lead with blocking findings if any. Check scope control, generated-file hygiene, test coverage, misleading docs, and accidental exposure of local paths or secrets.

## Output After Implementation

```md
## Task Completed

## Files Changed

## Verification

## Review Result

## Commit

## Remaining Follow-ups
```

If no commit was requested, state that changes are local and uncommitted.
