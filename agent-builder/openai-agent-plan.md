# OpenAI Agent Conversion Plan

## Current Understanding

`agent-builder/` is a local workflow pack for making repository cleanup work
disciplined. It contains:

- two general reference documents about specialized agents and engineering
  practice
- one repo-specific context appendix for `requisite-visualization`
- six role contracts for coordinator, audit planner, implementer, verifier,
  reviewer, and docs curator

The pack is not application runtime code. Its value is in the role boundaries,
approval gates, stop conditions, and verification expectations.

## Target Convention

Convert the folder from loose prompt documents into a conventional agent workflow
definition:

1. A top-level README explains purpose, shape, and usage.
2. A structured manifest defines roles, handoffs, guardrails, tools, state, and
   release policy.
3. Each role contract remains human-readable and reusable.
4. OpenAI Agent Builder can model the workflow as nodes and typed edges.
5. OpenAI Agents SDK can model the workflow as coordinator-owned orchestration
   with specialist agents, tools, guardrails, state, and handoffs.

## Workflow Topology

```text
User Task
  -> Intake
  -> Coordinator
  -> Audit Planner
  -> Human Approval Gate
  -> Implementer
  -> Verifier
  -> Reviewer
  -> Docs Curator
  -> Release Gate
```

## Agent Roles

| Role | Access | Responsibility |
|---|---|---|
| Coordinator | read, route, release | Classify work, collect context, enforce gates |
| Audit Planner | read-only | Inspect repo and propose ranked cleanup tasks |
| Implementer | write scoped files | Apply one approved task with a small diff |
| Verifier | read-only commands | Run checks and classify failures |
| Reviewer | read-only | Inspect actual diff and recommend merge or changes |
| Docs Curator | scoped docs writes | Update docs to match implemented behavior |

## Typed State Objects

Use these payloads between agents:

- `TaskBrief`: user goal, branch, current worktree caveats, allowed scope
- `RepoRead`: files inspected, current behavior, risks, relevant commands
- `CleanupBacklog`: ranked tasks, parking lot, deferred decisions
- `ApprovedTask`: title, goal, files, behavior policy, generated-data policy,
  verification commands, commit preference
- `ChangeSet`: files changed, intended behavior, tests/docs updated
- `VerificationReport`: commands, pass/fail, skipped checks, confidence
- `ReviewReport`: blocking findings, non-blocking findings, recommendation
- `ReleaseDecision`: commit/push eligibility, branch target, remaining risks

## OpenAI Agent Builder Mapping

Use Agent Builder when the goal is a hosted visual workflow:

- Model each role as an agent node.
- Model approval and release as explicit control-flow gates.
- Use typed edges for each state object listed above.
- Attach trace graders for planning quality, scope control, verification
  completeness, and documentation accuracy.
- Publish only after preview runs cover at least one happy path and one stop
  condition.

## OpenAI Agents SDK Mapping

Use the Agents SDK when the repository or product owns orchestration:

- Define one coordinator agent with handoffs to the specialist agents.
- Give read-only agents no write tools.
- Give implementer and docs curator scoped write tools only after approval.
- Keep branch, commit, and push actions behind explicit release policy checks.
- Persist run state so interrupted work can resume from the last completed
  stage.
- Use traces first for debugging, then build evals around recurring workflow
  failures.

## General Agentic Planning Rules

- Separate thinking stages from changing stages.
- Require current-state reading before plans.
- Make approval payloads explicit before writes.
- Prefer small, reversible diffs.
- Treat verification as a gate, not an afterthought.
- Treat review as read-only by default.
- Record deferred product and architecture decisions instead of silently making
  them.

## Implementation Status

Completed in this conversion:

- Added a top-level README for the workflow pack.
- Added this OpenAI conversion plan.
- Added `workflow.json` as a structured manifest.
- Made `agent-builder/` trackable by removing it from `.gitignore`.

Deferred:

- Splitting role contracts into subdirectories. The current flat structure is
  retained to preserve existing references and minimize diff risk.
- Creating runnable Agents SDK code. This pack is now ready for that as a
  separate implementation task.
