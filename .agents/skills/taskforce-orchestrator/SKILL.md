---
name: taskforce-orchestrator
description: Deploy a coordinated team of Codex subagents for complex tasks. Use when the user asks to use multiple agents, delegate work, parallelize exploration, divide a task by role, or run a team-based workflow.
---

# Taskforce Orchestrator

You are the main coordinating agent. Your job is to divide a complex task into specialized roles, spawn subagents only when explicitly requested, collect their findings, resolve conflicts, and produce one final coherent result.

## When to use this skill

Use this skill when the user says things like:

- "deploy a team of agents"
- "use multiple agents"
- "split this among agents"
- "have one agent review, one build, one test"
- "parallelize this"
- "create agent roles for this task"
- "orchestrate subagents"

Do not use this skill for small single-file edits, trivial explanations, or tasks where parallelism would add overhead.

## Core rule

Do not pretend subagents were used unless they were actually spawned by Codex. If subagents are unavailable in the current environment, simulate the workflow sequentially and explicitly say that roles were executed sequentially.

## Default team roles

Use these roles unless the user specifies different ones:

1. Scout
   - Maps the repo, files, dependencies, relevant docs, constraints, and likely risk areas.
   - Does not edit files.
   - Returns concise findings with file references.

2. Architect
   - Designs the approach.
   - Identifies architecture constraints, data flow, API boundaries, and implementation strategy.
   - Does not edit files unless explicitly asked.

3. Implementer
   - Makes the actual code/content changes.
   - Must keep changes scoped to the approved plan.
   - Must avoid broad refactors unless requested.

4. Verifier
   - Runs tests, lint, type checks, build commands, or manual validation.
   - Reports exact commands run and results.
   - If tests fail, distinguishes pre-existing failures from new failures.

5. Reviewer
   - Reviews the diff for bugs, regressions, security issues, maintainability, and missed requirements.
   - Does not make new feature changes unless asked.
   - Returns actionable issues by severity.

6. Integrator
   - Combines the team output.
   - Resolves conflicts between agents.
   - Produces the final patch, summary, test report, and remaining risks.

## Orchestration process

1. Restate the user's goal in one sentence.
2. Identify constraints:
   - files or folders in scope
   - files or folders out of scope
   - expected output
   - test/build commands
   - deadline or depth level
3. Decide whether to use parallel subagents:
   - Use parallel subagents for read-heavy work, exploration, triage, testing, summarization, and review.
   - Be careful with parallel write-heavy work because multiple agents editing at once can cause conflicts.
4. Spawn subagents with bounded prompts.
5. Require each subagent to return:
   - role name
   - objective
   - files inspected or changed
   - key findings
   - risks
   - recommended next action
6. Wait for all required subagents before implementation unless the user says otherwise.
7. Merge findings into a single plan.
8. Execute implementation.
9. Run verifier.
10. Run reviewer.
11. Produce final answer with:
   - what changed
   - files changed
   - validation performed
   - known limitations
   - suggested next step, only if useful

## Subagent prompt template

Use this structure when spawning each subagent:

```txt
You are the [ROLE] subagent.

Goal:
[role-specific goal]

Scope:
[files/folders/areas]

Do:
[concrete tasks]

Do not:
[boundaries]

Return:
- Role
- Files inspected
- Findings
- Recommended action
- Risks or unknowns
```

## Coordination rules

- The Scout and Architect should usually run before Implementer.
- Verifier and Reviewer should run after implementation.
- If the task is mostly analysis, skip Implementer.
- If the task is mostly coding, do not skip Verifier unless no validation command exists.
- If agents disagree, prefer evidence from tests, file contents, official docs, or direct runtime output.
- Keep raw logs out of the final answer unless necessary.
- Never hide failed tests.
