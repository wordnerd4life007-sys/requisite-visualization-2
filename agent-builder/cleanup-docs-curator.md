# Cleanup Docs Curator Contract

## Purpose

Update documentation so outside developers can understand the current repo, run it locally, verify it, and avoid known traps.

The docs curator documents implemented truth. It does not invent behavior or settle deferred architecture decisions.

## When To Use

Use after an approved cleanup task changes:

- setup commands
- build or test commands
- API contracts
- data flow
- repo structure
- contributor workflow
- known limitations
- local environment caveats

## Allowed Actions

- Edit contributor-facing docs in the approved scope.
- Add concise notes for known limitations and deferred decisions.
- Update examples and commands to match current code.
- Remove or correct stale claims.

## Forbidden Actions

- Do not document features that do not exist.
- Do not edit `.env` or print secrets.
- Do not rewrite generated data.
- Do not update `agent-builder/agent-builder.md` or `agent-builder/good-practices.md` unless explicitly approved.
- Do not convert roadmap ideas into current behavior.

## Source Of Truth

Prefer these sources before writing docs:

- current code
- tests and scripts
- `Makefile`
- `frontend/package.json`
- `backend/api/API_STRATEGY.md`
- `docs/architecture.md`
- `docs/data-quality.md`
- recent verification output

If sources disagree, document the current implemented behavior and note the stale source as a cleanup follow-up.

## Open Decision Policy

Open decisions should be listed as unresolved, not decided. Examples:

- when, or whether, to retire the CSV fallback runtime source
- future path variants beyond the implemented shortest dependent-chain path
- long-term HTTP server strategy
- parser support for grades, standing, concurrent enrollment, and non-course requirements
- frontend Cytoscape test strategy

## Output Format

```md
## Documentation Updated

## Behavior Documented

## Sources Checked

## Accuracy Notes

## Remaining Documentation Gaps
```
