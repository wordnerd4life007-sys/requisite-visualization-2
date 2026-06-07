# Frontend UI/UX Revamp Plan

Planning artifact for a complete UI/UX revamp of the `requisite-visualization` frontend. This is intentionally separate from `graph-rework.md`, which remains focused on graph layout and graph-specific orchestration.

This plan uses the `ui-ux-pro-max` design-system search with the query:

```text
education SaaS dashboard course dependency graph professional data visualization React
```

It also follows the repo frontend lane rules:

- Keep the first screen as the usable course explorer, not a marketing page.
- Keep normal runtime on backend `fetch()` calls.
- Preserve circular course nodes.
- Keep light mode as the default and dark mode supported.
- Use bright, solid, stable colors for `any` prerequisite groups.
- Do not introduce dotted OR-group lines.

## Design System

Use a quiet, utilitarian, data-dense dashboard style.

Recommended palette from `ui-ux-pro-max`:

- Primary: `#1E40AF`
- Secondary: `#3B82F6`
- Highlight/CTA: `#F59E0B`
- Background: `#F8FAFC`
- Text: `#1E3A8A`

Adaptation for this app:

- Keep graph behavior colors meaningful rather than decorative.
- Use neutrals for surfaces, blue for commands, green for root/completion, amber for route/path highlights, and stable bright colors for prerequisite groups.
- Maintain AA contrast in light and dark mode.
- Avoid a one-note blue interface.

Typography recommendation:

- Body: Fira Sans or current system sans if font loading is not worth the dependency.
- Technical labels: Fira Code or system monospace for course IDs, route chains, and compact graph badges.

## Target Experience

The revamped frontend should feel like a working academic planning and graph inspection tool:

- Course search and filters control the graph directly.
- The graph is the dominant first-screen workspace.
- The selected course inspector is always available on desktop and follows the graph on mobile.
- Catalog results and unofficial advisor tools are secondary surfaces.
- Dense data is scannable without marketing-style hero sections, oversized cards, or decorative backgrounds.

## Proposed Desktop IA

```text
top status bar
  brand / catalog status / API status / theme

command bar
  search / subject / colleges / path endpoints / graph mode shortcuts

main workspace
  graph canvas, largest area
  selected course inspector rail

secondary area
  catalog results drawer or lower panel
  unofficial advisor helper
```

## Proposed Mobile IA

```text
top compact bar
search and filter accordion
graph canvas
selected course inspector
results drawer
advisor helper below primary explorer
```

## Current State Observations

- `App.tsx` owns most fetch state, filtering, path state, theme, fullscreen, and advisor state.
- `GraphExplorer.tsx` owns a large amount of graph lifecycle and interaction code.
- `ExplorerControls.tsx` is a focused command surface and should stay focused.
- `styles.css` is one large stylesheet containing shell, graph, detail, search, and advisor styles.
- The current graph already supports circular nodes, structured/organic modes, taxi edges in structured mode, hover panels, lane labels, fullscreen, fit/reset, and light/dark themes.

## Revamp Principles

1. Graph first, controls second, details third.
2. The default view should be directed, ranked, and readable.
3. Semantics should not depend on color alone.
4. Details should respond to graph selection without causing layout shifts.
5. Large graph simplification should come before adding more visual density.
6. Light mode remains default; dark mode remains a first-class variant.
7. Milestones should be small because `GraphExplorer.tsx` has high coupling.

## Milestone 0: Baseline Audit

Goal: create a measurable baseline before changing UI behavior.

Tasks:

- Run `cd frontend; npm run build`.
- Start the frontend with `VITE_API_BASE_URL=http://127.0.0.1:8080`.
- Capture browser screenshots at 1440, 1024, 768, and 375 widths.
- Check search, filters, graph directions, depth changes, layout mode changes, node selection, hover panel, zoom, fit/reset, fullscreen, dark mode, and backend-unavailable state.

Definition of done:

- Baseline screenshots exist or are summarized.
- Known current failures are documented before edits.

## Milestone 1: Visual System And Shell

Goal: create a cleaner professional workspace without changing graph semantics.

Tasks:

- Introduce CSS tokens for surfaces, text hierarchy, command colors, graph colors, semantic states, shadows, and borders.
- Tighten the top bar into a compact status surface.
- Convert search/filter/path inputs into a unified command bar.
- Make the graph panel the dominant first-screen region on desktop.
- Keep cards only for repeated items, modals, popovers, and framed tools.
- Avoid nested card styling in the main shell.

Expected files:

- `frontend/src/App.tsx`
- `frontend/src/components/CourseSearch.tsx`
- `frontend/src/styles.css`

Definition of done:

- First viewport is the usable explorer.
- The graph is visually primary.
- Search, subject, college, and path controls are still reachable.
- Mobile has no horizontal scroll.
- `npm run build` passes.

## Milestone 2: Component Boundary Cleanup

Goal: reduce implementation risk before deeper graph changes.

Tasks:

- Split `GraphExplorer.tsx` only at natural boundaries:
  - Cytoscape lifecycle hook
  - graph element builder
  - layout helpers
  - hover preview helpers
  - legend/overlays
- Keep behavior identical during the split.
- Derive values in render/memo instead of adding redundant React state.

Definition of done:

- Behavior is unchanged.
- `npm run build` passes.
- Later layout work has smaller edit surfaces.

## Milestone 3: Graph-Adjacent UI Controls

Goal: make graph controls easier to scan and use without changing core graph layout yet.

Tasks:

- Clarify hierarchy in `ExplorerControls`.
- Keep direction as a segmented control.
- Keep depth as a stepper.
- Keep viewport actions as icon buttons with labels/tooltips.
- Add room for later complexity controls without wrapping awkwardly.
- Ensure all icon-only controls have `aria-label`, `title`, and visible focus.

Definition of done:

- Controls do not overlap at 375px, 768px, 1024px, and 1440px.
- Keyboard focus order matches visual order.
- Existing graph commands still work.

## Milestone 4: Inspection Model

Goal: make selected, hovered, and searched courses feel like one coherent workflow.

Tasks:

- Make the selected course inspector visually connected to graph selection.
- Keep hover previews lightweight and non-layout-shifting.
- Add course ID, title, credits, subject, and external marker where useful.
- Keep `CourseDetail` group language aligned with graph labels.
- Consider right-rail tabs only if the rail becomes overloaded.

Definition of done:

- Selecting a graph node updates the detail rail clearly.
- Hover preview does not obscure controls or cause layout shift.
- Group semantics are consistent across graph and detail panel.

## Milestone 5: Catalog Results And Filters

Goal: make catalog browsing useful without competing with the graph.

Tasks:

- Treat results as a drawer, collapsible panel, or lower secondary region.
- Preserve multi-select college filtering.
- Ensure search results include enough metadata to choose between similarly named courses.
- Keep loading and error states announced.

Definition of done:

- Users can search and select without losing graph context.
- Results are readable on mobile.
- Errors use `role="alert"` or equivalent live announcement.

## Milestone 6: Complexity Controls

Goal: let users reduce graph complexity without changing backend data.

Initial controls:

- direct vs recursive view
- hide external-only leaves
- collapse/expand alternative prerequisite groups
- fit selected path
- fit visible graph
- center selected course

Definition of done:

- Large graphs have at least one clear simplification path.
- Fit/reset/zoom/fullscreen remain reliable.
- Mobile controls do not overlap or overflow.

## Milestone 7: Advisor Helper Placement

Goal: keep the unofficial helper useful without competing with the explorer.

Tasks:

- Treat `AdvisorPanel` as secondary until the product promotes advising to a primary workflow.
- Consider a collapsible lower panel or right-rail tab.
- Keep TODO/unofficial wording honest.
- Avoid mixing unofficial planning state with backend catalog truth.

Definition of done:

- Advisor UI is reachable but not visually dominant.
- Public wording distinguishes implemented helper behavior from official advising.

## Milestone 8: Accessibility And Responsive Pass

Goal: make the redesigned frontend usable by keyboard and at common viewport sizes.

Tasks:

- Add a skip link to the main workspace.
- Audit labels for search, filters, path inputs, buttons, and graph commands.
- Add `role="alert"` for errors and `role="status"` for loading states where appropriate.
- Ensure all icon-only buttons have accessible names.
- Check focus order across top bar, command bar, graph controls, result list, detail rail, and fullscreen graph.
- Verify contrast for light and dark mode.
- Respect `prefers-reduced-motion`.

Definition of done:

- Keyboard users can operate all non-canvas controls.
- Errors are announced.
- No information depends on color alone.
- 375px, 768px, 1024px, and 1440px layouts are verified.

## Milestone 9: Verification And Documentation

Commands:

```powershell
cd frontend
npm run build
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

Browser checks:

- search/select course
- multi-select colleges
- subject filter
- prerequisites, dependents, both
- depth changes
- layout changes
- group labels/colors
- hover panel
- node click selection
- path finder
- zoom in/out
- fit/reset/center
- fullscreen enter/exit
- dark mode
- mobile viewport
- backend-unavailable error handling

Docs:

- Update docs only after behavior lands.
- Separate implemented behavior from roadmap ideas.
- Keep API contract docs unchanged unless frontend needs a new backend field.

## Suggested Sequence

1. Baseline audit.
2. Visual system and shell.
3. Component boundary cleanup.
4. Graph-adjacent controls.
5. Inspection model.
6. Catalog results and filters.
7. Complexity controls.
8. Advisor helper placement.
9. Accessibility, responsive, verification, and docs.

## Final Definition Of Done

- The first screen is a usable professional course explorer.
- The graph is the dominant interaction surface.
- Search, filter, graph, detail, and path workflows feel connected.
- `any` and `all` prerequisite groups are understandable without relying only on color.
- Large graphs can be simplified without changing backend data.
- Light mode, dark mode, fullscreen, desktop, and mobile are verified.
- `npm run build` passes, or blockers are documented.
