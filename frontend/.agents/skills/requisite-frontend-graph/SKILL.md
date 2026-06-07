---
name: requisite-frontend-graph
description: Work on requisite-visualization frontend graph exploration, Vite React TypeScript UI, Cytoscape rendering, fetch-based API integration, filtering controls, fullscreen behavior, loading/error states, and graph interaction verification. Use when tasks touch frontend/ files or user-facing visualization behavior.
---

# Requisite Frontend Graph

## Workflow

Use the Frontend Visualization lane. State reasoning tier, risk level, expected files, and whether escalation is needed. Use high reasoning for Cytoscape layout/performance decisions, fullscreen behavior, large graph UX, and fetch-state architecture.

Read existing components, styles, API client code, types, and backend contract docs before editing frontend behavior.

Primary files:

- `frontend/src/App.tsx`
- `frontend/src/api/`
- `frontend/src/components/`
- `frontend/src/styles.css`
- `frontend/src/types.ts`
- frontend-related README or Docker additions when needed

## Runtime Rules

Normal runtime must use backend `fetch()` calls. Frontend fixtures, when needed, should live in test-scoped files rather than the production runtime tree.

Clicking a graph node should select the course and fetch fresh backend detail when needed.

Keep course search, selected-course details, prerequisites, dependents, graph neighborhoods, depth, direction, subject, college, fit-to-view, zoom, reset, and fullscreen controls coherent.

Users must be able to select more than one college and render a subset rather than all colleges.

## Visual Rules

Do not build a marketing landing page. The first screen should be the usable course explorer.

Keep styling quiet and utilitarian. Use a professional light workspace by default with a dark mode option, readable text, controls, focus states, and edge colors.

Course nodes should be circular, not rounded rectangles.

Represent `any` groups with solid bright group-specific colors derived from stable `groupIndex` values. Do not use dotted OR-group lines.

Use the browser Fullscreen API with a CSS fallback for contexts where fullscreen requests fail.

## Verification

Use the smallest relevant checks first:

```powershell
cd frontend
npm run build
$env:VITE_API_BASE_URL='http://127.0.0.1:8080'
npm run dev -- --host 127.0.0.1 --port 5173
```

After meaningful UI changes, verify in a browser: search, multi-select colleges, node click selection, zoom in/out, fit/reset, fullscreen enter/exit, and backend-unavailable error handling.

The Vite large Cytoscape chunk warning is acceptable unless the task is specifically about bundle optimization.
