# Building Specialized Agents in a Modern AI Coding Workflow

## Goal

The goal of specialized agents is not to create a bunch of random AI personas. The goal is to create a repeatable development workflow where each AI-assisted step has a clear purpose, clear boundaries, and a clear output.

A good agent workflow should help with:

- Better planning before code changes
- Smaller and safer diffs
- Fewer hallucinated changes
- Better testing
- Better review
- Better documentation
- Less “vibecoding”
- More maintainable long-term development

The core idea:

```text
Do not ask one AI agent to do everything.
Split the work into controlled stages.
```

A strong modern flow looks like this:

```text
Understand → Plan → Implement → Test → Review → Document → Merge
```

---

# 1. Start With Repo-Level Instructions

Before creating specialized agents, create a strong `AGENTS.md` file at the root of the repo.

This file acts as the shared context every agent should follow.

## Recommended file

```text
AGENTS.md
```

## Purpose

`AGENTS.md` tells AI coding agents how the project works, what commands to run, what conventions to follow, and what they must avoid.

This prevents every agent from guessing.

## Example `AGENTS.md`

```md
# AGENTS.md

## Project Overview

This project is a [describe project type] built with:

- Frontend: [React / Vue / Next.js / etc.]
- Backend: [Node / Express / Django / etc.]
- Database: [Postgres / MongoDB / SQLite / etc.]
- Package manager: [npm / pnpm / yarn]

## Setup Commands

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Run typecheck:

```bash
npm run typecheck
```

## Project Structure

```text
src/
  components/      Reusable UI components
  pages/           Route-level pages
  lib/             Shared utilities
  api/             API client and request logic
  store/           State management
  types/           TypeScript types
  tests/           Test files
```

## Coding Rules

- Make the smallest safe change.
- Do not rewrite unrelated files.
- Follow existing naming and folder conventions.
- Prefer typed code.
- Avoid `any` unless explicitly justified.
- Keep functions focused.
- Keep components reasonably small.
- Do not silently change public APIs.
- Do not remove existing behavior unless requested.

## Testing Rules

- Add or update tests for changed behavior.
- Run relevant tests before finishing.
- If tests cannot be run, explain why.
- Do not claim tests passed unless they were actually run.

## Documentation Rules

- Update documentation when setup, behavior, commands, or APIs change.
- Do not document features that do not exist.
- Keep examples accurate.

## Safety Rules

- Do not commit secrets.
- Do not modify environment files containing real credentials.
- Do not delete migrations without explicit approval.
- Do not change deployment config unless the task requires it.
- Do not install new dependencies without explaining why.
```

---

# 2. Define the Workflow Before Defining the Agents

Do not start by asking, “What agents should I create?”

Start by asking:

```text
What parts of my development process need more control?
```

Usually the answer is:

```text
Planning
Implementation
Testing
Review
Documentation
```

The modern flow should be staged.

## Recommended basic workflow

```text
1. Planning phase
   - Understand current code
   - Identify relevant files
   - Produce a safe implementation plan

2. Implementation phase
   - Make the smallest useful change
   - Avoid unrelated rewrites
   - Follow repo conventions

3. Testing phase
   - Add or update tests
   - Run relevant checks
   - Catch regressions

4. Review phase
   - Review the diff
   - Check correctness
   - Check maintainability
   - Check security if relevant

5. Documentation phase
   - Update README, API docs, setup docs, or comments if needed
```

This matters more than the number of agents.

---

# 3. Build Agents Around Workflow Stages

A specialized agent should represent a stage in the workflow.

Each agent needs:

```text
Role
Purpose
Boundaries
Allowed actions
Forbidden actions
Expected output
Quality checklist
```

Do not make agents vague.

Bad:

```text
smart-dev-agent
fix-everything-agent
fullstack-god-agent
```

Good:

```text
planning-agent
implementation-agent
test-agent
review-agent
documentation-agent
```

The names are less important than the boundaries.

---

# 4. Create an Agent Contract Template

Every agent should follow this structure.

```md
# Agent Name

## Purpose

Describe exactly what this agent is supposed to do.

## When to Use

Describe when this agent should be invoked.

## When Not to Use

Describe situations where this agent should not be used.

## Allowed Actions

List what the agent is allowed to do.

## Forbidden Actions

List what the agent must not do.

## Required Inputs

List what information the agent needs before working.

## Expected Output

Define the required response format.

## Quality Checklist

List what the agent must check before finishing.

## Failure Behavior

Explain what the agent should do if it cannot complete the task safely.
```

This makes agents predictable.

---

# 5. Build the Planning Step First

The planning step is the most important part if your goal is to avoid chaotic AI-generated code.

The planning agent should usually be read-only.

## Planning agent purpose

```text
Understand the codebase and produce a safe implementation plan.
```

## Planning agent rules

```text
- Do not edit files.
- Read relevant files first.
- Identify the current system behavior.
- Identify the smallest safe change.
- List affected files.
- List risks.
- List required tests.
- Do not invent architecture.
```

## Planning prompt template

```md
You are acting as a planning agent.

Your job is to understand the current codebase and produce an implementation plan.

Rules:

- Do not edit files.
- Read the relevant files before proposing changes.
- Follow `AGENTS.md`.
- Identify the smallest safe change.
- Do not suggest broad rewrites unless absolutely necessary.
- Do not invent project conventions.
- If information is missing, state what is missing.

Return your answer in this format:

## Current Understanding

Explain how the relevant part of the app currently works.

## Relevant Files

List files likely involved in the change.

## Proposed Plan

Give an ordered step-by-step implementation plan.

## Risks

List what could break.

## Test Plan

List tests or checks that should be run.

## Open Questions

List anything that needs clarification before implementation.
```

## What to focus on

The planning step should answer:

```text
What exists now?
What needs to change?
Where should the change happen?
What is the smallest safe diff?
What could break?
How will we verify it?
```

If the plan cannot answer those questions, implementation should not start yet.

---

# 6. Build the Implementation Step Second

The implementation step should be constrained by the plan.

Do not tell an implementation agent to “make the app better.”

Tell it exactly what plan to execute.

## Implementation agent purpose

```text
Apply an approved plan with the smallest safe code change.
```

## Implementation agent rules

```text
- Follow the approved plan.
- Follow `AGENTS.md`.
- Do not rewrite unrelated files.
- Do not change architecture unless the plan requires it.
- Keep the diff small.
- Preserve existing behavior.
- Add error handling where needed.
- Add or update tests if behavior changes.
```

## Implementation prompt template

```md
You are acting as an implementation agent.

Implement the approved plan below.

Rules:

- Follow `AGENTS.md`.
- Only implement the requested change.
- Do not rewrite unrelated files.
- Do not introduce new dependencies unless necessary.
- Preserve existing public APIs unless the plan says otherwise.
- Add or update tests for changed behavior.
- Run relevant checks if possible.
- If you cannot safely complete part of the plan, stop and explain why.

Approved plan:

[PASTE PLAN HERE]

Return your answer in this format:

## Changes Made

List the files changed and what changed in each.

## Behavior Changed

Explain the user-facing or developer-facing behavior change.

## Tests Added or Updated

List tests added or changed.

## Checks Run

List commands run and whether they passed.

## Notes

Mention anything incomplete, risky, or worth reviewing.
```

## What to focus on

The implementation step should focus on:

```text
Small diff
Existing conventions
No unrelated rewrites
Clear error handling
Typed interfaces
Preserved behavior
Runnable tests
```

The best implementation agent is boring. It should not be creative unless explicitly asked.

---

# 7. Build the Testing Step Third

The testing step should not be an afterthought.

The test agent should verify behavior, not just create shallow tests.

## Testing agent purpose

```text
Add or update tests for the changed behavior and important edge cases.
```

## Testing agent rules

```text
- Follow existing test style.
- Test behavior, not implementation details.
- Add regression tests for fixed bugs.
- Cover success and failure cases.
- Do not fake passing tests.
- Do not weaken existing tests to make them pass.
```

## Testing prompt template

```md
You are acting as a testing agent.

Your job is to add or update tests for the recent change.

Rules:

- Follow `AGENTS.md`.
- Read existing tests before writing new ones.
- Match the existing testing style.
- Test meaningful behavior.
- Include edge cases.
- Do not weaken or delete existing tests unless clearly justified.
- Do not modify production code unless a real bug is discovered and explained.

Recent change:

[DESCRIBE CHANGE OR PASTE DIFF SUMMARY]

Return your answer in this format:

## Existing Test Pattern

Explain how tests are currently structured.

## Tests Added or Updated

List each test and what it verifies.

## Edge Cases Covered

List edge cases.

## Commands Run

List test commands run and results.

## Gaps

Mention anything still untested.
```

## What to focus on

Good tests should cover:

```text
Normal successful behavior
Invalid inputs
Missing data
Permission failures
Network/API failures
Empty states
Regression cases
```

Bad testing:

```text
Only checking that a component renders.
Only testing the happy path.
Deleting failing tests.
Changing tests to match broken behavior.
```

---

# 8. Build the Review Step Fourth

The review step should act like a senior developer reviewing a pull request.

The review agent should usually be read-only.

## Review agent purpose

```text
Check the diff for correctness, maintainability, regressions, and unnecessary complexity.
```

## Review agent rules

```text
- Do not edit files.
- Review the actual diff.
- Prioritize blocking issues.
- Include exact file references when possible.
- Separate correctness issues from style preferences.
- Check whether tests cover the change.
- Check whether the implementation follows the plan.
```

## Review prompt template

```md
You are acting as a code review agent.

Review the recent changes as if this were a pull request.

Rules:

- Do not edit files.
- Follow `AGENTS.md`.
- Focus on correctness, maintainability, regressions, and unnecessary complexity.
- Prioritize blocking issues first.
- Do not give vague approval.
- Include exact files and line references when possible.
- If something is only a preference, label it as non-blocking.

Return your answer in this format:

## Summary

Briefly summarize the change.

## Blocking Issues

List issues that should be fixed before merge.

## Non-Blocking Issues

List minor improvements.

## Test Coverage

Explain whether the tests are sufficient.

## Maintainability

Explain whether the code is easy to understand and extend.

## Final Recommendation

Choose one:

- Approve
- Approve with comments
- Request changes
```

## What to focus on

The review step should catch:

```text
Incorrect assumptions
Broken edge cases
Unnecessary rewrites
Duplicated logic
Bad naming
Missing validation
Weak tests
Hidden coupling
Security risks
Performance problems
```

A bad review says:

```text
Looks good.
```

A good review says:

```text
This works for the happy path, but fails when the user is unauthenticated because the redirect assumes `user.id` exists in `src/auth/session.ts`.
```

---

# 9. Build the Documentation Step Last

Documentation should describe what actually exists.

The documentation agent should not invent behavior.

## Documentation agent purpose

```text
Update project documentation to match the implemented behavior.
```

## Documentation agent rules

```text
- Do not document features that do not exist.
- Read the implemented code before writing docs.
- Update setup instructions if commands changed.
- Update API docs if endpoints changed.
- Update examples if behavior changed.
- Keep docs concise and accurate.
```

## Documentation prompt template

```md
You are acting as a documentation agent.

Update documentation based on the recent implemented change.

Rules:

- Follow `AGENTS.md`.
- Only document behavior that exists in the code.
- Do not invent features.
- Keep instructions copy/paste friendly.
- Include commands where useful.
- Update README, API docs, or relevant docs files only if needed.

Recent change:

[DESCRIBE CHANGE OR PASTE SUMMARY]

Return your answer in this format:

## Documentation Updated

List files changed.

## What Was Added

Summarize the documentation added.

## Accuracy Notes

Explain what code behavior the docs are based on.

## Remaining Documentation Gaps

List anything still undocumented.
```

## What to focus on

Documentation should answer:

```text
What does this project do?
How do I run it?
How do I test it?
How do I configure it?
How does this feature work?
What errors or edge cases should I know about?
```

---

# 10. Use Read-Only and Write-Capable Agents Separately

This is one of the most important design principles.

## Read-only agents

Use read-only behavior for:

```text
Planning
Review
Security review
Architecture analysis
Debug investigation
Documentation analysis
```

Read-only agents are safer because they cannot accidentally mutate the codebase.

## Write-capable agents

Use write access for:

```text
Implementation
Test writing
Documentation updates
Small refactors
Bug fixes
```

A bad workflow lets every agent edit everything.

A good workflow separates:

```text
Thinkers from changers.
```

Recommended split:

```text
Planner: read-only
Reviewer: read-only
Security reviewer: read-only
Implementer: can edit
Test writer: can edit tests
Docs agent: can edit docs
```

---

# 11. Use Small Diffs as a Rule

Specialized agents work best when each task is small.

Bad task:

```text
Build authentication, dashboard, database, deployment, settings page, dark mode, and admin panel.
```

Good task:

```text
Add password reset email request form using the existing auth API pattern.
```

Better task:

```text
Add the frontend form only.
Do not change backend code.
Use existing form components.
Add validation and tests.
```

Small tasks reduce:

```text
Hallucinated code
Merge conflicts
Broken unrelated behavior
Review difficulty
Testing difficulty
```

---

# 12. Require Exact Output Formats

Agents should not respond however they want.

Every agent should have a required output format.

Example:

```md
## Summary

## Files Changed

## Tests Run

## Risks

## Next Steps
```

This makes outputs comparable and reviewable.

Bad output:

```text
Done! I improved the app.
```

Good output:

```text
Changed `src/auth/reset-password.tsx` to add the password reset form.
Added validation for invalid emails.
Added tests in `src/auth/reset-password.test.tsx`.
Ran `npm test -- reset-password`; passed.
Did not modify backend routes.
```

---

# 13. Require Verification Commands

Agents should know the commands used to verify work.

Add them to `AGENTS.md`.

Example:

```md
## Verification Commands

Before finishing, run the relevant commands:

```bash
npm run lint
npm run typecheck
npm test
```

For frontend changes:

```bash
npm run test:frontend
```

For backend changes:

```bash
npm run test:backend
```

For full validation:

```bash
npm run verify
```
```

The agent should report:

```text
Commands run
Pass/fail result
Any errors
Any commands skipped
Why they were skipped
```

Bad:

```text
Tests should pass.
```

Good:

```text
Ran `npm test -- auth`; 12 tests passed.
Ran `npm run typecheck`; passed.
Skipped E2E tests because Playwright is not installed locally.
```

---

# 14. Add Guardrails for Dangerous Areas

Some files should require extra caution.

In `AGENTS.md`, add a section like this:

```md
## High-Risk Files

Be extra careful with:

- Authentication logic
- Authorization checks
- Database migrations
- Payment code
- Deployment config
- Environment files
- API contracts
- Generated files
- Lockfiles
```

Add rules:

```md
## High-Risk Change Rules

- Do not modify auth or permissions without explaining the security impact.
- Do not change database migrations unless the task explicitly requires it.
- Do not change deployment config unless the task explicitly requires it.
- Do not commit secrets.
- Do not edit generated files directly.
- Do not update dependencies unless necessary.
```

This prevents broad AI changes in sensitive areas.

---

# 15. Add “Stop Conditions”

Agents should know when to stop instead of guessing.

Add this to agent instructions:

```md
## Stop Conditions

Stop and report instead of continuing if:

- The task requires missing credentials.
- The existing architecture is unclear.
- Tests fail for reasons unrelated to your change.
- The requested change conflicts with existing behavior.
- The task would require a broad rewrite.
- You find a possible security issue.
- You need to delete data, migrations, or important config.
```

This reduces damage.

A good agent does not force completion when the safe answer is:

```text
I found a blocker.
```

---

# 16. Recommended File Structure

For Claude-style project agents:

```text
project-root/
  AGENTS.md
  .claude/
    agents/
      planner.md
      implementer.md
      test-writer.md
      code-reviewer.md
      docs-updater.md
```

For GitHub Copilot-style instructions:

```text
project-root/
  AGENTS.md
  .github/
    copilot-instructions.md
    instructions/
      frontend.instructions.md
      backend.instructions.md
      tests.instructions.md
```

For Codex-style workflow:

```text
project-root/
  AGENTS.md
```

Then use separate Codex tasks with role-specific prompts:

```text
Planning task
Implementation task
Testing task
Review task
Documentation task
```

---

# 17. Minimal Setup to Start

Do not overbuild.

Start with:

```text
AGENTS.md
Planner prompt
Implementation prompt
Review prompt
Testing prompt
```

That is enough for a disciplined workflow.

Minimum useful workflow:

```text
1. Ask planner for a plan.
2. Review the plan yourself.
3. Ask implementer to apply only that plan.
4. Ask test agent to add tests.
5. Ask reviewer to inspect the diff.
6. Merge only after checks pass.
```

---

# 18. Practical Example: Adding a Feature

## User request

```text
Add password reset to the app.
```

## Bad AI flow

```text
Prompt: Add password reset.
AI edits auth, routes, database, email service, UI, and docs all at once.
Many files change.
Tests are missing.
Hard to review.
```

## Good agent flow

### Step 1: Planning

```text
Planning agent:
- Reads current auth code
- Finds existing login/register flow
- Finds API client
- Finds email system if any
- Produces plan
- Does not edit files
```

### Step 2: Human review

```text
Human checks whether the plan is reasonable.
```

### Step 3: Implementation

```text
Implementation agent:
- Adds password reset request form
- Adds API call using existing client
- Adds validation
- Keeps diff small
```

### Step 4: Testing

```text
Testing agent:
- Adds tests for valid email
- Adds tests for invalid email
- Adds tests for API failure
- Adds tests for loading state
```

### Step 5: Review

```text
Review agent:
- Checks implementation against plan
- Checks edge cases
- Checks auth/security implications
- Checks test quality
```

### Step 6: Documentation

```text
Documentation agent:
- Updates README or auth docs if needed
```

---

# 19. What to Focus On Most

The most important parts are:

```text
1. Clear repo instructions
2. Small tasks
3. Planning before editing
4. Read-only review stages
5. Required tests
6. Required output formats
7. Stop conditions
8. Human approval before risky changes
```

Less important:

```text
Fancy agent names
Large agent libraries
Many overlapping roles
Complex orchestration too early
```

The point is not to have many agents.

The point is to make AI-assisted development controlled, inspectable, and repeatable.

---

# 20. Core Rule

```text
Use agents to separate responsibilities, not to multiply chaos.
```

A modern specialized-agent workflow should make the development process more disciplined:

```text
Plan before code.
Constrain the diff.
Test the behavior.
Review the result.
Document the truth.
```