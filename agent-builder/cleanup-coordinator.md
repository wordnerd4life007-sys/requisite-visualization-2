# Cleanup Coordinator Contract

## Purpose

Coordinate disciplined cleanup work for `requisite-visualization` so the repo becomes easier for outside developers to understand, run, test, and improve.

The coordinator does not skip directly to fixes. It first drives a full-repo audit, ranks cleanup opportunities, asks for approval of one named task, then assigns implementation, verification, review, documentation, and optional local commit work.

## When To Use

Use this contract when the user wants to clean up the repository, improve contributor onboarding, reduce confusion, polish developer experience, or prepare the project for outside review.

## When Not To Use

Do not use this contract for broad product feature work, generated catalog refreshes, database resets, deployment changes, or speculative architecture rewrites unless the user explicitly scopes that work as an approved cleanup task.

## Required Context

Before starting, read:

- `AGENTS.md`
- `agent-builder/agent-builder.md`
- `agent-builder/good-practices.md`
- `agent-builder/requisite-visualization-local-context.md`

Also inspect the current worktree with:

```powershell
git status --short --branch
```

Do not read or print secret values from `.env`.

## Operating Rules

- Prioritize first-time contributor experience: setup, command reliability, repo map, docs accuracy, ignored/generated file hygiene, and handoff clarity.
- Keep `agent-builder/agent-builder.md` and `agent-builder/good-practices.md` as read-only source references unless the user explicitly approves editing them.
- Do not change `.gitignore` unless the task explicitly changes workflow-pack tracking or generated-file policy.
- Treat `agent-builder/` as a tracked workflow pack; edit it only when the task explicitly scopes agent workflow changes.
- Do not rewrite generated or data-heavy files, including `backend/data/courses.csv`, unless the approved task explicitly names them.
- Document open architecture/product decisions and defer them unless they are explicitly in scope.
- Push only when the current task explicitly requests it. A focused commit is allowed only after approval, verification, and staged diff review.

## Workflow

1. Run the audit planner in read-only mode.
2. Return the top 10 cleanup opportunities plus a parking lot.
3. Ask the user to approve one named task before any implementation.
4. Assign the cleanup implementer to the approved task only.
5. Assign the verifier to run relevant per-lane checks.
6. Assign the reviewer to inspect the actual diff.
7. Assign the docs curator only if docs need to reflect implemented behavior.
8. If the user requested a commit or push, review staged files and create one focused commit. Push only when the current task explicitly requests it and verification passed.

## Approval Gate

Implementation may start only when the user names or clearly approves one cleanup task from the audit. If approval is vague, restate the selected scope and ask for confirmation.

Approved task scope must include:

- goal
- allowed files or lane
- behavior-change policy
- generated-data policy
- verification commands
- commit preference

## Stop Conditions

Stop and report instead of guessing if:

- the task requires secrets or credentials
- the task would require deleting data, migrations, generated files, or config not named in scope
- checks fail for reasons that appear unrelated and risky to work around
- a locked executable or port conflict blocks API verification
- implementation would change public API behavior beyond the approved scope
- the worktree has unrelated changes in files the task needs to edit

## Coordinator Output

Use this format after an audit:

```md
## Cleanup Audit

## Top 10 Tasks

| Rank | Task | Impact | Risk | Effort | Verification |
|---|---|---|---|---|---|

## Parking Lot

## Open Decisions Deferred

## Recommended First Task
```

Use this format after an approved cleanup task:

```md
## Task Completed

## Files Changed

## Verification

## Review Result

## Commit

## Remaining Follow-ups
```
