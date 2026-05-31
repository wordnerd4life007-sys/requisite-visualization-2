# Cleanup Audit Planner Contract

## Purpose

Perform a read-only full-repo audit and produce a ranked cleanup backlog for making `requisite-visualization` easier for outside developers to consume.

The planner identifies work. It does not edit files.

## Priority Order

Rank contributor-onboarding issues first:

1. setup accuracy
2. reliable commands
3. repo structure clarity
4. README and docs accuracy
5. ignored/generated file hygiene
6. test and build confidence
7. confusing architecture or stale docs
8. handoff quality for future contributors

Code maintainability and product polish still matter, but they should not outrank basic contributor usability unless they block setup or trust.

## Allowed Actions

- Read files, manifests, docs, tests, scripts, and build config.
- Run non-mutating checks that improve the audit.
- Inspect `git status --short --branch`.
- Inspect ignored status with `git status --ignored --short` when file hygiene matters.
- Report stale processes, locked binaries, or port conflicts.

## Forbidden Actions

- Do not edit files.
- Do not rewrite, regenerate, or normalize generated data.
- Do not stage, commit, push, delete, or move files.
- Do not read or print secret values from `.env`.
- Do not decide unresolved product or architecture questions.

## Required Exploration

Start with:

```powershell
git status --short --branch
rg --files
```

Then inspect the relevant source of truth:

- `AGENTS.md`
- `README.md`
- `docs/`
- `backend/api/API_STRATEGY.md`
- `Makefile`
- `frontend/package.json`
- `scripts/`
- `tests/`

Use `rg` for stale terms and contributor traps:

```powershell
rg -n "TODO|FIXME|HACK|Remaining Work|Open .*Decision|mock|fixture|deprecated|temporary" .
```

## Ranking Model

Score each candidate with concise labels:

- Impact: high, medium, low contributor value
- Risk: high, medium, low blast radius
- Effort: small, medium, large
- Verification confidence: strong, partial, weak

Prefer tasks with high impact, low or medium risk, small or medium effort, and strong verification.

## Audit Item Schema

Each top task must include:

- title
- evidence with file references where possible
- contributor impact
- risk/blast radius
- effort estimate
- suggested owner lane
- verification plan
- whether it requires an explicit product or architecture decision

## Open Decision Policy

Document and defer decisions such as:

- PostgreSQL source of truth vs CSV runtime source
- `/paths` endpoint ownership and path reconstruction
- parser semantics for grades, standing, concurrent enrollment, and non-course requirements
- frontend test strategy for Cytoscape interactions
- whether local-only, deployed web app, class project, or portfolio app is the primary target

Do not silently choose these during cleanup.

## Output Format

```md
## Current Repo Read

Briefly state branch, worktree caveats, and any baseline checks run.

## Top 10 Cleanup Tasks

### 1. [Task Title]

- Evidence:
- Contributor impact:
- Risk/blast radius:
- Effort:
- Owner lane:
- Verification:
- Requires decision: yes/no

## Parking Lot

Lower-priority observations that should not distract from the first cleanup pass.

## Open Decisions Deferred

Decisions found but intentionally not resolved.

## Recommended First Task

Name exactly one task and explain why it is the best first approved cleanup.
```
