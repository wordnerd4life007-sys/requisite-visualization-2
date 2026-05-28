import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, {
  type Core,
  type ElementDefinition,
  type EventObject,
  type NodeSingular,
  type StylesheetJson,
} from 'cytoscape';
import { getCourse, getDependents, getPrerequisites, isAbortError } from '../api/client';
import type { CourseDetail, CourseRelationshipResponse, GraphCommand, GraphLayoutMode, GraphNode, GraphResponse } from '../types';

const anyGroupColors = ['#4dffff', '#b56cff', '#ff6fd8', '#6dff8f', '#fff275', '#ff6b6b', '#4f8cff', '#00ffa3'];
const selectedNodeGlow = {
  'underlay-color': '#6dff8f',
  'underlay-opacity': 0.28,
  'underlay-padding': '10px',
  'underlay-shape': 'ellipse',
};

const hoverDelayMs = 250;

interface HoverInfo {
  course: CourseDetail | null;
  dependents: CourseRelationshipResponse | null;
  error: string | null;
  prerequisites: CourseRelationshipResponse | null;
}

interface HoverPanel {
  courseId: string;
  fallback: GraphNode;
  info: HoverInfo | null;
  position: {
    x: number;
    y: number;
  };
  status: 'loading' | 'success' | 'error';
}

interface NodePlacement {
  distance: number;
  groupRank: number;
  id: string;
  side: -1 | 0 | 1;
  subject: string;
}

interface GraphExplorerProps {
  command: GraphCommand;
  error: string | null;
  graph: GraphResponse;
  layoutMode: GraphLayoutMode;
  loading: boolean;
  onRetry: () => void;
  onSelectCourse: (courseId: string) => void;
}

function GraphExplorer({ command, error, graph, layoutMode, loading, onRetry, onSelectCourse }: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const hoverAbortRef = useRef<AbortController | null>(null);
  const hoverCacheRef = useRef<Map<string, HoverInfo>>(new Map());
  const hoverNodeIdRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const [hoverPanel, setHoverPanel] = useState<HoverPanel | null>(null);

  const elements = useMemo<ElementDefinition[]>(() => {
    const groupRanks = groupRankByNode(graph);
    const positions = graphNodePositions(graph, groupRanks);

    const nodeElements = graph.nodes.map((node) => ({
      classes: [
        node.id === graph.rootCourseId ? 'is-root' : '',
        node.external ? 'is-external' : '',
      ].filter(Boolean).join(' '),
      data: {
        id: node.id,
        label: node.label || node.id,
        name: node.name ?? 'External prerequisite',
        college: node.college ?? '',
        department: node.department ?? '',
        external: node.external,
        groupRank: node.id === graph.rootCourseId ? -1 : (groupRanks.get(node.id) ?? Number.MAX_SAFE_INTEGER),
        root: node.id === graph.rootCourseId,
        subject: node.subject ?? '',
      },
      position: positions.get(node.id),
    }));

    const edgeElements = graph.edges.map((edge, index) => ({
      data: {
        id: `${edge.from}-${edge.to}-${edge.groupIndex}-${index}`,
        source: edge.from,
        target: edge.to,
        relationship: edge.relationship,
        groupType: edge.groupType,
        groupIndex: edge.groupIndex,
        anyColor: groupColor(edge.groupIndex),
        external: edge.external ?? false,
      },
    }));

    return [...nodeElements, ...edgeElements];
  }, [graph]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      autoungrabify: false,
      boxSelectionEnabled: false,
      container: containerRef.current,
      elements,
      maxZoom: 2.8,
      minZoom: 0.28,
      selectionType: 'single',
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#081018',
            'border-color': '#6b7c93',
            'border-width': '2px',
            color: '#f8fafc',
            'font-size': '11px',
            'font-weight': 'bold',
            height: '66px',
            label: 'data(label)',
            'min-zoomed-font-size': '8px',
            shape: 'ellipse',
            'text-halign': 'center',
            'text-max-width': '58px',
            'text-outline-color': '#05070b',
            'text-outline-width': '2px',
            'text-valign': 'center',
            'text-wrap': 'wrap',
            width: '66px',
          },
        },
        {
          selector: 'node.is-root',
          style: {
            'background-color': '#12844c',
            'border-color': '#6dff8f',
            'border-style': 'solid',
            'border-width': '5px',
            color: '#f8fff5',
            'font-family': 'Inter, Segoe UI, Arial, sans-serif',
            'font-size': '12px',
            height: '82px',
            'text-outline-color': '#0d2a0a',
            'text-outline-width': '3px',
            width: '82px',
            'z-index': 20,
            'z-index-compare': 'manual',
            ...selectedNodeGlow,
          },
        },
        {
          selector: 'node.is-external',
          style: {
            'background-color': '#070b10',
            'border-color': '#8894a5',
            'border-style': 'dashed',
            color: '#b8c4d4',
          },
        },
        {
          selector: 'node.is-root.is-external',
          style: {
            'background-color': '#12844c',
            'border-color': '#6dff8f',
            'border-style': 'solid',
            'border-width': '5px',
            color: '#f8fff5',
            'font-family': 'Inter, Segoe UI, Arial, sans-serif',
            'font-size': '12px',
            height: '82px',
            'text-outline-color': '#0d2a0a',
            'text-outline-width': '3px',
            width: '82px',
            'z-index': 20,
            'z-index-compare': 'manual',
            ...selectedNodeGlow,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': '#556173',
            opacity: 0.48,
            'target-arrow-color': '#556173',
            'target-arrow-shape': 'triangle',
            width: '2px',
          },
        },
        {
          selector: 'edge[groupType = "any"]',
          style: {
            'line-color': 'data(anyColor)',
            opacity: 0.96,
            'target-arrow-color': 'data(anyColor)',
            width: '3px',
          },
        },
        {
          selector: 'edge[groupType = "all"]',
          style: {
            'line-color': '#667085',
            opacity: 0.38,
            'target-arrow-color': '#667085',
            width: '2px',
          },
        },
        {
          selector: '.is-faded',
          style: {
            opacity: 0.12,
          },
        },
        {
          selector: 'edge.is-focused',
          style: {
            opacity: 1,
            width: '5px',
          },
        },
        {
          selector: 'node.is-hovered',
          style: {
            'border-color': '#4dffff',
            'border-width': '4px',
            'underlay-color': '#4dffff',
            'underlay-opacity': 0.24,
            'underlay-padding': '8px',
            'underlay-shape': 'ellipse',
          },
        },
        {
          selector: 'node.is-neighbor',
          style: {
            'border-color': '#f4f7fb',
            'border-width': '3px',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#12844c',
            'border-color': '#6dff8f',
            color: '#f8fff5',
            'text-outline-color': '#0d2a0a',
            'text-outline-width': '3px',
            ...selectedNodeGlow,
          },
        },
        {
          selector: 'node.is-root:selected',
          style: {
            'background-color': '#12844c',
            'border-color': '#6dff8f',
            'border-style': 'solid',
            color: '#f8fff5',
            height: '82px',
            'text-outline-color': '#0d2a0a',
            'text-outline-width': '3px',
            width: '82px',
            'z-index': 20,
            'z-index-compare': 'manual',
            ...selectedNodeGlow,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#00f5ff',
            'target-arrow-color': '#00f5ff',
          },
        },
      ] as unknown as StylesheetJson,
      layout: { name: layoutMode === 'organic' ? 'cose' : 'preset', animate: false, fit: false },
      userPanningEnabled: true,
      userZoomingEnabled: true,
    });

    const clearHover = () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      hoverAbortRef.current?.abort();
      hoverAbortRef.current = null;
      hoverNodeIdRef.current = null;
      setHoverPanel(null);
      clearGraphHoverState(cy);
    };

    cy.on('tap', 'node', (event) => {
      const courseId = event.target.id();
      const isExternal = Boolean(event.target.data('external'));

      if (!isExternal) {
        onSelectCourse(courseId);
      }
    });

    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      const courseId = node.id();
      const fallback = fallbackNodeFromElement(node);
      const position = panelPosition(event, containerRef.current);

      hoverNodeIdRef.current = courseId;
      applyHoverFocus(cy, node);

      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }

      hoverTimerRef.current = window.setTimeout(() => {
        hoverTimerRef.current = null;

        if (fallback.external) {
          setHoverPanel({
            courseId,
            fallback,
            info: { course: null, dependents: null, error: null, prerequisites: null },
            position,
            status: 'success',
          });
          return;
        }

        const cached = hoverCacheRef.current.get(courseId);
        if (cached) {
          setHoverPanel({ courseId, fallback, info: cached, position, status: cached.error ? 'error' : 'success' });
          return;
        }

        const controller = new AbortController();
        hoverAbortRef.current?.abort();
        hoverAbortRef.current = controller;
        setHoverPanel({ courseId, fallback, info: null, position, status: 'loading' });

        Promise.all([
          getCourse(courseId, controller.signal),
          getPrerequisites(courseId, controller.signal),
          getDependents(courseId, controller.signal),
        ])
          .then(([course, prerequisites, dependents]) => {
            const info = { course, prerequisites, dependents, error: null };
            hoverCacheRef.current.set(courseId, info);

            if (hoverNodeIdRef.current === courseId) {
              setHoverPanel({ courseId, fallback, info, position: latestPanelPosition(node, containerRef.current), status: 'success' });
            }
          })
          .catch((loadError: unknown) => {
            if (isAbortError(loadError)) {
              return;
            }

            const info = {
              course: null,
              dependents: null,
              error: loadError instanceof Error && loadError.message ? loadError.message : 'Unable to load course details.',
              prerequisites: null,
            };
            hoverCacheRef.current.set(courseId, info);

            if (hoverNodeIdRef.current === courseId) {
              setHoverPanel({ courseId, fallback, info, position: latestPanelPosition(node, containerRef.current), status: 'error' });
            }
          });
      }, hoverDelayMs);
    });

    cy.on('mousemove', 'node', (event) => {
      const courseId = event.target.id();

      if (hoverNodeIdRef.current !== courseId) {
        return;
      }

      const position = panelPosition(event, containerRef.current);
      setHoverPanel((current) => (current && current.courseId === courseId ? { ...current, position } : current));
    });

    cy.on('mouseout', 'node', () => {
      clearHover();
    });

    cy.on('tap', (event) => {
      if (event.target === cy) {
        cy.elements().unselect();
      }
    });

    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        cy.resize();
        requestFit(cy);
      });
      resizeObserver.observe(containerRef.current);
    }

    cyRef.current = cy;
    runGraphLayout(cy, graph);

    return () => {
      clearHover();
      resizeObserver?.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, layoutMode, onSelectCourse]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || command.nonce === 0) {
      return;
    }

    if (command.action === 'fit') {
      requestFit(cy);
      return;
    }

    if (command.action === 'reset') {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      hoverAbortRef.current?.abort();
      hoverAbortRef.current = null;
      hoverNodeIdRef.current = null;
      setHoverPanel(null);
      clearGraphHoverState(cy);
      cy.stop();
      cy.elements().unselect();
      cy.zoom(1);
      cy.pan({ x: 0, y: 0 });
      runGraphLayout(cy, graph);
      return;
    }

    const nextZoom = command.action === 'zoom-in' ? cy.zoom() * 1.18 : cy.zoom() / 1.18;

    cy.zoom({
      level: Math.min(cy.maxZoom(), Math.max(cy.minZoom(), nextZoom)),
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    });
  }, [command]);

  return (
    <div className="graph-stage">
      <div className="graph-canvas" ref={containerRef} />

      {hoverPanel ? <HoverInspectionPanel panel={hoverPanel} /> : null}

      {loading ? <div className="graph-overlay">Loading graph...</div> : null}

      {error ? (
        <div className="graph-overlay is-error">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error && graph.nodes.length === 0 ? <div className="graph-overlay">No graph data found.</div> : null}

      <div className="graph-legend" aria-label="Graph legend">
        <span>
          <i className="legend-line required" />
          Required
        </span>
        <span>
          <i className="legend-line alternative" />
          Alternative
        </span>
        <span>
          <i className="legend-node external" />
          External
        </span>
      </div>
    </div>
  );
}

function HoverInspectionPanel({ panel }: { panel: HoverPanel }) {
  const course = panel.info?.course;
  const name = course?.name || panel.fallback.name || 'External prerequisite';
  const college = course?.college || panel.fallback.college || 'Not listed';
  const department = course?.department || panel.fallback.department || 'Not listed';
  const credits = course?.credits ?? null;
  const prerequisiteIds = panel.info?.prerequisites?.flattenedCourseIds ?? [];
  const dependentIds = panel.info?.dependents?.flattenedCourseIds ?? [];

  return (
    <div
      aria-live="polite"
      className="node-hover-panel"
      style={{ left: panel.position.x, top: panel.position.y }}
    >
      <div className="hover-heading">
        <span>{panel.courseId}</span>
        {panel.status === 'loading' ? <small>Loading</small> : null}
      </div>
      <p>{name}</p>

      {panel.status === 'error' ? <div className="hover-error">{panel.info?.error}</div> : null}

      <dl className="hover-meta">
        <div>
          <dt>Credits</dt>
          <dd>{credits ?? 'Variable'}</dd>
        </div>
        <div>
          <dt>College</dt>
          <dd>{college}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{department}</dd>
        </div>
      </dl>

      <div className="hover-relationships">
        <RelationshipPreview label="Prerequisites" values={prerequisiteIds} />
        <RelationshipPreview label="Dependents" values={dependentIds} />
      </div>
    </div>
  );
}

function RelationshipPreview({ label, values }: { label: string; values: string[] }) {
  const visibleValues = values.slice(0, 4);

  return (
    <div>
      <span>{label}</span>
      <p>
        {visibleValues.length > 0 ? visibleValues.join(', ') : 'None listed'}
        {values.length > visibleValues.length ? ` +${values.length - visibleValues.length} more` : ''}
      </p>
    </div>
  );
}

function groupColor(groupIndex: number): string {
  return anyGroupColors[Math.abs(groupIndex) % anyGroupColors.length];
}

function runGraphLayout(cy: Core, graph: GraphResponse) {
  const positions = graphNodePositions(graph, groupRankByNode(graph));

  cy.nodes().forEach((node) => {
    const position = positions.get(node.id());

    if (position) {
      node.position(position);
    }
  });

  requestFit(cy);
}

function requestFit(cy: Core) {
  window.requestAnimationFrame(() => {
    cy.resize();

    if (cy.nodes().length === 0) {
      return;
    }

    cy.fit(cy.elements(), 48);
    cy.center(cy.elements());

    window.requestAnimationFrame(() => {
      cy.resize();
      cy.fit(cy.elements(), 48);
      cy.center(cy.elements());
    });
  });
}

function groupRankByNode(graph: GraphResponse): Map<string, number> {
  const ranks = new Map<string, number>();

  graph.edges.forEach((edge) => {
    const rank = edge.groupType === 'any' ? Math.abs(edge.groupIndex) : 1000 + Math.abs(edge.groupIndex);
    setLowestRank(ranks, edge.from, rank);
    setLowestRank(ranks, edge.to, rank);
  });

  return ranks;
}

function graphNodePositions(
  graph: GraphResponse,
  groupRanks: Map<string, number>,
): Map<string, { x: number; y: number }> {
  const placements = nodePlacements(graph, groupRanks);
  const buckets = new Map<string, NodePlacement[]>();
  const positions = new Map<string, { x: number; y: number }>();

  placements.forEach((placement) => {
    if (placement.id === graph.rootCourseId) {
      positions.set(placement.id, { x: 0, y: 0 });
      return;
    }

    const key = `${placement.side}:${placement.distance}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(placement);
    buckets.set(key, bucket);
  });

  buckets.forEach((bucket) => {
    const side = bucket[0]?.side ?? 0;
    const distance = bucket[0]?.distance ?? 1;
    const grouped = new Map<number, NodePlacement[]>();

    bucket.forEach((placement) => {
      const group = grouped.get(placement.groupRank) ?? [];
      group.push(placement);
      grouped.set(placement.groupRank, group);
    });

    const ordered: Array<{ placement: NodePlacement; y: number }> = [];
    let cursor = 0;

    Array.from(grouped.keys())
      .sort((left, right) => left - right)
      .forEach((rank) => {
        const members = grouped.get(rank) ?? [];
        members.sort(comparePlacements);

        members.forEach((placement, index) => {
          ordered.push({ placement, y: cursor + index * 72 });
        });

        cursor += Math.max(1, members.length) * 72 + 36;
      });

    const maxRows = 9;
    const columnCount = Math.max(1, Math.ceil(ordered.length / maxRows));

    ordered.forEach(({ placement }, index) => {
      const column = Math.floor(index / maxRows);
      const row = index % maxRows;
      const rowsInColumn = Math.min(maxRows, ordered.length - column * maxRows);
      const x =
        side === 0
          ? (column - (columnCount - 1) / 2) * 112
          : side * (distance * 220 + column * 112);
      const y = (row - (rowsInColumn - 1) / 2) * 74;

      positions.set(placement.id, { x, y });
    });
  });

  return positions;
}

function nodePlacements(graph: GraphResponse, groupRanks: Map<string, number>): NodePlacement[] {
  const incomingByTarget = new Map<string, string[]>();
  const outgoingBySource = new Map<string, string[]>();

  graph.edges.forEach((edge) => {
    const incoming = incomingByTarget.get(edge.to) ?? [];
    incoming.push(edge.from);
    incomingByTarget.set(edge.to, incoming);

    const outgoing = outgoingBySource.get(edge.from) ?? [];
    outgoing.push(edge.to);
    outgoingBySource.set(edge.from, outgoing);
  });

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const placements = new Map<string, NodePlacement>();
  const queue: NodePlacement[] = [];
  const rootId = graph.rootCourseId || graph.nodes[0]?.id || '';

  const rootPlacement = placementFor(rootId, 0, 0, nodesById, groupRanks);
  placements.set(rootId, rootPlacement);
  queue.push(rootPlacement);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    if (current.side <= 0) {
      (incomingByTarget.get(current.id) ?? []).forEach((courseId) => {
        queuePlacement(placementFor(courseId, -1, current.distance + 1, nodesById, groupRanks), placements, queue);
      });
    }

    if (current.side >= 0) {
      (outgoingBySource.get(current.id) ?? []).forEach((courseId) => {
        queuePlacement(placementFor(courseId, 1, current.distance + 1, nodesById, groupRanks), placements, queue);
      });
    }
  }

  graph.nodes.forEach((node) => {
    if (!placements.has(node.id)) {
      placements.set(node.id, placementFor(node.id, 0, 1, nodesById, groupRanks));
    }
  });

  return Array.from(placements.values());
}

function placementFor(
  courseId: string,
  side: -1 | 0 | 1,
  distance: number,
  nodesById: Map<string, GraphNode>,
  groupRanks: Map<string, number>,
): NodePlacement {
  const node = nodesById.get(courseId);

  return {
    distance,
    groupRank: groupRanks.get(courseId) ?? Number.MAX_SAFE_INTEGER,
    id: courseId,
    side,
    subject: node?.subject ?? '',
  };
}

function queuePlacement(
  next: NodePlacement,
  placements: Map<string, NodePlacement>,
  queue: NodePlacement[],
) {
  const current = placements.get(next.id);

  if (current && isPlacementPreferred(current, next)) {
    return;
  }

  placements.set(next.id, next);
  queue.push(next);
}

function isPlacementPreferred(current: NodePlacement, next: NodePlacement): boolean {
  return (
    current.distance < next.distance
    || (current.distance === next.distance && Math.abs(current.side) < Math.abs(next.side))
    || (current.distance === next.distance && Math.abs(current.side) === Math.abs(next.side) && current.side <= next.side)
  );
}

function comparePlacements(left: NodePlacement, right: NodePlacement): number {
  return (
    left.groupRank - right.groupRank
    || left.subject.localeCompare(right.subject, undefined, { numeric: true })
    || left.id.localeCompare(right.id, undefined, { numeric: true })
  );
}

function setLowestRank(ranks: Map<string, number>, courseId: string, rank: number) {
  const current = ranks.get(courseId);

  if (current === undefined || rank < current) {
    ranks.set(courseId, rank);
  }
}

function applyHoverFocus(cy: Core, node: NodeSingular) {
  cy.elements().removeClass('is-faded is-focused is-hovered is-neighbor');

  const neighborhood = node.closedNeighborhood();
  cy.elements().not(neighborhood).addClass('is-faded');
  node.addClass('is-hovered');
  node.connectedEdges().addClass('is-focused');
  node.neighborhood('node').addClass('is-neighbor');
}

function clearGraphHoverState(cy: Core) {
  cy.elements().removeClass('is-faded is-focused is-hovered is-neighbor');
}

function panelPosition(event: EventObject, container: HTMLDivElement | null): { x: number; y: number } {
  const renderedPosition = event.renderedPosition ?? latestPanelPosition(event.target as NodeSingular, container);
  return clampPanelPosition(renderedPosition.x + 16, renderedPosition.y + 16, container);
}

function latestPanelPosition(node: NodeSingular, container: HTMLDivElement | null): { x: number; y: number } {
  const position = node.renderedPosition();
  return clampPanelPosition(position.x + 16, position.y + 16, container);
}

function clampPanelPosition(x: number, y: number, container: HTMLDivElement | null): { x: number; y: number } {
  const width = container?.clientWidth ?? 360;
  const height = container?.clientHeight ?? 260;
  const maxX = Math.max(12, width - 344);
  const maxY = Math.max(12, height - 244);

  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(12, y), maxY),
  };
}

function fallbackNodeFromElement(node: NodeSingular): GraphNode {
  return {
    college: String(node.data('college') || ''),
    department: String(node.data('department') || ''),
    external: Boolean(node.data('external')),
    id: node.id(),
    label: String(node.data('label') || node.id()),
    name: String(node.data('name') || ''),
    subject: String(node.data('subject') || ''),
  };
}

export default GraphExplorer;
