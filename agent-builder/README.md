# Agent Builder Workflow Pack

This folder defines a conventional agent workflow for disciplined repository work on
`requisite-visualization`.

It started as local prompt material for cleanup agents. It is now structured as a
tracked workflow pack that can be used in three ways:

- as role prompts for Codex or another coding agent
- as source material for an OpenAI Agent Builder workflow
- as a code-first plan for an OpenAI Agents SDK implementation

## Purpose

The workflow exists to make agent-assisted development controlled and reviewable.
It separates planning, implementation, verification, review, documentation, and
release decisions so one agent is not asked to do every step at once.

The current target workflow is:

```text
Intake
  -> Coordinator
  -> Audit Planner
  -> Approval Gate
  -> Implementer
  -> Verifier
  -> Reviewer
  -> Docs Curator
  -> Release Gate
```

## Current Shape

Core workflow files:

- `workflow.json`: machine-readable workflow topology, handoffs, guardrails, and
  release policy
- `openai-agent-plan.md`: migration plan for OpenAI Agent Builder and Agents SDK
  usage
- `cleanup-coordinator.md`: orchestrates the cleanup workflow
- `cleanup-audit-planner.md`: read-only audit and backlog generation
- `cleanup-implementer.md`: scoped implementation work
- `cleanup-verifier.md`: test/build/smoke verification
- `cleanup-reviewer.md`: read-only diff review
- `cleanup-docs-curator.md`: documentation updates for implemented truth
- `requisite-visualization-local-context.md`: repo-specific context and safety
  appendix

Reference material:

- `agent-builder.md`: general specialized-agent workflow guidance
- `good-practices.md`: engineering practice guidance for avoiding chaotic AI use

## OpenAI Mapping

For OpenAI Agent Builder, each role maps to an agent node. The coordinator owns
routing, each specialist receives a typed payload, and approval/release gates are
explicit control-flow nodes.

For the OpenAI Agents SDK, each role maps to an agent definition with narrow tool
access. The coordinator owns orchestration, state, human approval checks, and
handoffs. Verification and review agents should be read-only except for running
allowed checks.

The OpenAI docs describe agents as systems that plan, call tools, collaborate
across specialists, and keep state for multi-step work:

- https://platform.openai.com/docs/guides/agents
- https://platform.openai.com/docs/guides/agent-builder

## Operating Rules

- Load `AGENTS.md` before using this pack in this repository.
- Do not read, print, or summarize `.env` secrets.
- Keep planning and review read-only.
- Require an approved task before implementation.
- Keep implementation diffs scoped to the approved lane.
- Run relevant verification before release.
- Do not push unless the user explicitly asks in the current task.
