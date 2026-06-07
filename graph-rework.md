# Graph Rework Orchestrator Plan

Temporary planning artifact for a future orchestrated graph UI rework.

The orchestrator should use this file to deploy a team of agents one task at a time. Start every worker in planning-only mode first. Each worker should read `AGENTS.md`, state reasoning tier, risk level, expected files, whether escalation is needed, and a focused implementation plan before editing.

## Context

Current graph runtime is a Vite React + TypeScript frontend using Cytoscape. It is not a Graphviz DOT renderer. The Graphviz skill is still useful as a design lens because it emphasizes directed graph discipline: explicit direction, rank/layer control, spacing, edge routing, clusters, readable labels, and predictable output.

Current graph implementation is mainly in:

- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/components/ExplorerControls.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`
- `frontend/src/utils/graphPathFocus.ts`

Current API contract reference:

- `backend/api/API_STRATEGY.md`

## Orchestration Rules

- Do not edit generated or data-heavy files unless a task explicitly requires it.
- Keep normal frontend runtime on backend `fetch()` calls.
- Preserve circular course nodes unless a specific task explicitly changes that project rule.
- Keep light mode as the default and dark mode as a supported option.
- Use bright, solid, stable colors for `any` prerequisite groups.
- Prefer small, reviewable milestones. Verify each milestone before moving to the next.
- Avoid multiple workers editing the same file at the same time.
- If a worker touches graph layout, rendering, or large-graph UX, use high reasoning.
- If a worker only changes labels, copy, or small styling, use low reasoning after behavior is stable.

## Target Outcome

Create a professional course dependency graph that is easier to read at small and large graph sizes:

- Clear prerequisite-to-course-to-dependent direction.
- Layered/ranked layout with fewer crossings.
- Better spacing and edge routing.
- Visible grouping for prerequisite groups and catalog metadata.
- More useful labels without clutter.
- Better controls for graph complexity.
- Verified behavior across desktop, mobile, light mode, dark mode, and fullscreen.

## Finding 1: Structured Layout Is Too Hand-Rolled

Current issue:

The structured layout buckets nodes by BFS distance and side, then sorts by group rank, subject, and id. This is deterministic, but it does not do full crossing minimization, multi-parent rank balancing, or dense-layer optimization.

Recommended path:

1. Frontend graph worker compares layout options:
   - `cytoscape-dagre`
   - `cytoscape-klay` or ELK-style layout
   - server-generated Graphviz/DOT positions
   - improved local layout as fallback
2. Pick one primary layered layout for structured mode.
3. Keep the current hand-rolled layout behind a fallback or remove it only after the replacement is verified.
4. Add deterministic sorting inputs so repeated renders do not jump unexpectedly.
5. Verify common cases:
   - one selected course with only prerequisites
   - one selected course with only dependents
   - `both` direction
   - shared prerequisites
   - dense courses with many prerequisite options

Expected files:

- `frontend/package.json`
- `frontend/package-lock.json` if dependency changes are needed
- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/types.ts` if layout mode names change

Definition of done:

- Structured mode uses a real layered layout or a documented improved local layout.
- Node overlap is prevented on tested graph sizes.
- Crossings are visibly reduced compared with the current bucket layout.
- `npm run build` passes.

## Finding 2: Edge Routing Needs Professional Treatment

Current issue:

Edges currently use mostly low-opacity bezier curves. Dense graphs can become hard to follow, especially when prerequisites and dependents are shown together.

Recommended path:

1. Make edge routing a layout-mode-specific concern.
2. Use orthogonal, taxi, segmented, or otherwise clearer routing for structured mode if Cytoscape supports it cleanly.
3. Keep organic mode curves if they work better there.
4. Strengthen edge hierarchy:
   - root-adjacent edges most visible
   - focused path edges strongest
   - non-focused edges muted but still readable
   - `any` group edges solid and bright
   - `all` edges distinct but less dominant
5. Revisit arrowheads. `triangle-tee` may be visually heavy or semantically odd for prerequisite flow.

Expected files:

- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/styles.css` if legend or CSS variables need updates

Definition of done:

- Direction can be read without relying only on hover.
- Focused paths are visually obvious.
- Edge styling remains readable in light and dark mode.

## Finding 3: No Cluster Or Subgraph Equivalent

Current issue:

Graphviz uses clusters to create visible logical groupings. The app currently uses color accents but no visual envelopes, swimlanes, or grouped regions.

Recommended path:

1. Decide the first grouping dimension:
   - prerequisite group
   - subject
   - college
   - dependency side and depth
2. Implement one grouping model first. Prefer prerequisite group grouping because it maps directly to user confusion around `any` and `all`.
3. Consider Cytoscape compound nodes or non-interactive background overlays.
4. Keep groups subtle. They should clarify, not turn the graph into nested boxes everywhere.
5. Add a control to turn grouping on/off if it adds visual density.

Expected files:

- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/components/ExplorerControls.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`

Definition of done:

- At least one logical grouping is visible in graph view.
- Grouping does not break node click selection, hover panels, fit, reset, or fullscreen.
- Grouping is useful with `any` prerequisite groups.

## Finding 4: Alternative Groups Are Colored But Not Self-Explaining

Current issue:

`any` prerequisite groups use stable bright colors, which is good. However, users still need the legend or details panel to understand what the group means.

Recommended path:

1. Add lightweight group labels near grouped edges or grouped nodes:
   - "choose 1"
   - "any group 1"
   - "all required"
2. Add hover/focus text for group semantics.
3. Keep labels short and zoom-aware so the graph does not become text-heavy.
4. Align detail panel wording with graph labels.
5. Make sure group colors and labels remain stable across rerenders.

Expected files:

- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/components/CourseDetail.tsx`
- `frontend/src/styles.css`

Definition of done:

- A first-time user can distinguish `any` from `all` without opening backend docs.
- The graph legend matches actual graph styling.
- No dotted OR-group lines are introduced.

## Finding 5: Labels Are Too Sparse For Inspection

Current issue:

Circular nodes mainly show course IDs. This is clean, but professional inspection often needs more context: short title, credits, external marker, status, or subject grouping.

Recommended path:

1. Add zoom-aware labels:
   - low zoom: course ID only
   - medium zoom: course ID plus short title
   - high zoom or hover: title, credits, subject, status
2. Avoid oversized circular nodes by using external label text or compact overlays instead of stuffing everything inside the circle.
3. Add a label-density control only if needed.
4. Ensure external prerequisites are clearly marked.
5. Keep labels readable in dark mode and light mode.

Expected files:

- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/styles.css`

Definition of done:

- Course ID remains readable at default zoom.
- More context is available without requiring a detail-panel click.
- Labels do not overlap badly in common graph sizes.

## Finding 6: Both-Direction Layout Is Useful But Ambiguous

Current issue:

The current `both` layout places prerequisites and dependents around the root, but the canvas does not strongly communicate "inputs to selected course to unlocked courses."

Recommended path:

1. Add stronger directional framing:
   - prerequisites lane
   - selected course/root lane
   - dependents lane
2. Consider a top-to-bottom layout option:
   - prerequisites above
   - selected course center
   - dependents below
3. Label graph regions without using marketing/explainer copy.
4. Keep controls simple: avoid too many layout choices until one works well.
5. Verify path-finder behavior still sets a useful direction/depth after route discovery.

Expected files:

- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/components/ExplorerControls.tsx`
- `frontend/src/App.tsx` if path behavior changes
- `frontend/src/styles.css`

Definition of done:

- Users can immediately tell which nodes are prerequisites and which are dependents.
- `both` direction is not visually confused with an undirected network.

## Finding 7: Organic Layout Is Not A Professional Default

Current issue:

Organic layout is useful for exploration, but course prerequisites are directed dependency graphs. Organic should not be the primary professional view.

Recommended path:

1. Keep structured/layered layout as default.
2. Rename or reposition organic mode if it reads as equally recommended.
3. Tune organic mode for exploratory use only:
   - related clusters stay near each other
   - root remains visually central
   - collisions are handled
4. Consider hiding organic mode behind an advanced control if it distracts from the primary workflow.

Expected files:

- `frontend/src/components/ExplorerControls.tsx`
- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/styles.css`

Definition of done:

- Default graph view is directed, ranked, and readable.
- Organic mode remains available only if it adds clear value.

## Finding 8: Viewport Behavior Needs Complexity Controls

Current issue:

Structured mode aligns the viewport around the root and supports fit/reset, but large graphs can still sprawl. Graphviz-style `ranksep` and `nodesep` thinking maps to adaptive spacing and graph simplification controls.

Recommended path:

1. Add graph complexity controls before increasing visual density:
   - collapse/expand prerequisite groups
   - hide external-only leaves
   - limit dependents by subject/college
   - show direct-only vs recursive
2. Add adaptive spacing:
   - expand dense layers
   - compress sparse layers
   - reduce row spacing on smaller screens only when labels remain readable
3. Improve fit behavior for large graphs:
   - fit selected path
   - fit visible graph
   - center root
4. Verify fullscreen and mobile view after any viewport changes.

Expected files:

- `frontend/src/App.tsx`
- `frontend/src/components/ExplorerControls.tsx`
- `frontend/src/components/GraphExplorer.tsx`
- `frontend/src/styles.css`
- `frontend/src/types.ts`

Definition of done:

- Large graphs have at least one user-facing way to reduce visual complexity.
- Fit/reset/zoom/fullscreen remain reliable.
- Mobile does not show overlapping controls or unreadable labels.

## Suggested Agent Sequence

1. Layout research worker
   - Reasoning: high
   - Output: one recommendation for layered layout approach, dependency impact, and rollback plan.
   - No edits unless approved by orchestrator.

2. Layout implementation worker
   - Reasoning: high
   - Implements Finding 1 and the minimum edge-routing hooks needed for Finding 2.
   - Runs `cd frontend; npm run build`.

3. Edge and semantics worker
   - Reasoning: high
   - Implements Finding 2 and Finding 4.
   - Updates legend and hover semantics.

4. Grouping worker
   - Reasoning: high
   - Implements Finding 3.
   - Coordinates with edge worker before editing `GraphExplorer.tsx`.

5. Label and inspection worker
   - Reasoning: medium
   - Implements Finding 5.
   - Verifies label density across zoom levels.

6. Direction and layout controls worker
   - Reasoning: high
   - Implements Finding 6 and Finding 7.
   - Keeps default view professional and directed.

7. Complexity and viewport worker
   - Reasoning: high
   - Implements Finding 8.
   - Verifies fullscreen, fit, reset, desktop, and mobile.

8. Verification worker
   - Reasoning: medium
   - Runs frontend build and browser checks.
   - Suggested checks:
     - search/select course
     - prerequisites, dependents, both
     - depth changes
     - layout mode changes
     - group colors
     - hover panel
     - node click selection
     - zoom in/out
     - fit/reset
     - fullscreen enter/exit
     - dark mode
     - mobile viewport

9. Documentation worker
   - Reasoning: low to medium
   - Updates docs only after behavior is implemented.
   - Documents implemented behavior separately from roadmap ideas.

## Milestone Order

1. Choose layout engine or confirm improved local layout strategy.
2. Implement layered layout and baseline edge routing.
3. Improve group semantics and visible `any`/`all` explanation.
4. Add grouping/cluster treatment.
5. Improve labels and inspection affordances.
6. Clarify `both` direction and layout controls.
7. Add complexity and viewport controls.
8. Verify and document.

## Final Definition Of Done

- Default graph view is a directed, ranked professional dependency graph.
- Prerequisites, selected root, and dependents are visually distinct.
- Dense graphs have fewer crossings and better spacing than the current implementation.
- `any` and `all` prerequisite groups are understandable from the graph.
- Grouping/clustering clarifies the graph without overwhelming it.
- Labels expose enough context for inspection while preserving readability.
- Large graphs can be simplified without changing backend data.
- Light mode, dark mode, fullscreen, desktop, and mobile are verified.
- `cd frontend; npm run build` passes, or blockers are documented.
