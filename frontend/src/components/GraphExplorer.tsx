import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape, {
  type Core,
  type EdgeSingular,
  type ElementDefinition,
  type EventObject,
  type NodeSingular,
  type StylesheetJson,
} from 'cytoscape';
import { getCourse, getDependents, getPrerequisites, isAbortError } from '../api/client';
import type { CourseDetail, CourseRelationshipResponse, GraphCommand, GraphLayoutMode, GraphNode, GraphResponse } from '../types';
import { graphEdgeElementId, graphPathFocus } from '../utils/graphPathFocus';

type CytoscapeLayoutOptions = Parameters<Core['layout']>[0];

const graphTheme = {
  edge: '#C7D0DD',
  groupColors: ['#7AA2F7', '#A78BFA', '#E09CB5', '#56C2A3', '#D6AA43', '#E06C75'],
  hoverBorder: '#7AA2F7',
  nodeBorder: '#C7D0DD',
  nodeFill: '#10151D',
  nodeText: '#F3F6FA',
  nodeTextOutline: '#080B10',
  rootBorder: '#56C2A3',
} as const;
const selectedNodeGlow = {
  'underlay-color': graphTheme.rootBorder,
  'underlay-opacity': 0.28,
  'underlay-padding': '10px',
  'underlay-shape': 'ellipse',
};
const selectedNodeStyle = {
  'background-color': graphTheme.nodeFill,
  'border-color': graphTheme.rootBorder,
  'border-opacity': 1,
  color: graphTheme.nodeText,
  'text-outline-color': graphTheme.nodeTextOutline,
  'text-outline-width': '3px',
  ...selectedNodeGlow,
};
const rootNodeStyle = {
  ...selectedNodeStyle,
  'border-style': 'solid',
  'border-width': '5px',
  'font-family': 'Inter, Segoe UI, Arial, sans-serif',
  'font-size': '12px',
  height: '90px',
  width: '90px',
  'z-index': 20,
  'z-index-compare': 'manual',
};

const hoverDelayMs = 250;
const defaultGraphHeight = 430;
const layoutHorizontalPadding = 64;
const layoutVerticalPadding = 28;
const layoutNodeDiameter = 76;
const layoutColumnSpacing = 136;
const layoutFirstLayerGap = 246;
const layoutDistanceGap = 178;
const layoutRowSpacing = 86;
const organicGroupRadius = 250;
const organicGroupRingGap = 166;
const organicGroupAngularStep = 2.399963229728653;
const organicSameGroupNodeGap = 94;
const organicCrossGroupNodeGap = 142;
const organicCollisionPasses = 6;

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

interface GraphLayout {
  height: number;
  positions: Map<string, { x: number; y: number }>;
  rootX: number;
  width: number;
}

interface GraphGroupAccent {
  color: string;
  key: string;
  rank: number;
  type: GraphResponse['edges'][number]['groupType'];
}

interface OrganicGroup {
  centroid: { x: number; y: number };
  key: string;
  nodes: NodeSingular[];
  radius: number;
  rank: number;
}

interface LayoutBucket {
  columnCount: number;
  distance: number;
  placements: NodePlacement[];
  side: -1 | 1;
  startX: number;
}

interface StageSize {
  height: number;
  width: number;
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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const hoverAbortRef = useRef<AbortController | null>(null);
  const hoverCacheRef = useRef<Map<string, HoverInfo>>(new Map());
  const hoverNodeIdRef = useRef<string | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const [hoverPanel, setHoverPanel] = useState<HoverPanel | null>(null);
  const [stageSize, setStageSize] = useState<StageSize>({ height: defaultGraphHeight, width: 0 });

  const groupAccents = useMemo(() => groupAccentByNode(graph), [graph]);
  const groupRanks = useMemo(() => groupRankByNode(graph), [graph]);
  const structuredLayout = useMemo(
    () => graphNodeLayout(graph, groupRanks, stageSize),
    [graph, groupRanks, stageSize.height, stageSize.width],
  );

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodeElements = graph.nodes.map((node) => ({
      classes: [
        node.id === graph.rootCourseId ? 'is-root' : '',
        node.external ? 'is-external' : '',
        groupAccents.has(node.id) ? 'has-group' : '',
        groupAccents.get(node.id)?.type === 'any' ? 'group-any' : '',
        groupAccents.get(node.id)?.type === 'all' ? 'group-all' : '',
      ].filter(Boolean).join(' '),
      data: {
        id: node.id,
        label: node.label || node.id,
        name: node.name ?? 'External prerequisite',
        college: node.college ?? '',
        department: node.department ?? '',
        external: node.external,
        groupColor: groupAccents.get(node.id)?.color ?? '',
        groupKey: groupAccents.get(node.id)?.key ?? '',
        groupRank: node.id === graph.rootCourseId ? -1 : (groupRanks.get(node.id) ?? Number.MAX_SAFE_INTEGER),
        groupType: groupAccents.get(node.id)?.type ?? '',
        root: node.id === graph.rootCourseId,
        subject: node.subject ?? '',
      },
      position: structuredLayout.positions.get(node.id),
    }));

    const edgeElements = graph.edges.map((edge, index) => {
      const id = edgeElementId(edge, index);
      const isPrerequisiteEdge = edge.relationship === 'prerequisite';

      return {
        classes: [
          isPrerequisiteEdge ? 'has-group' : '',
          isPrerequisiteEdge && edge.groupType === 'any' ? 'group-any' : '',
          isPrerequisiteEdge && edge.groupType === 'all' ? 'group-all' : '',
        ].filter(Boolean).join(' '),
        data: {
          id,
          source: edge.from,
          target: edge.to,
          relationship: edge.relationship,
          groupType: isPrerequisiteEdge ? edge.groupType : '',
          groupIndex: edge.groupIndex,
          groupColor: isPrerequisiteEdge ? groupColor(edge.groupIndex) : '',
          groupKey: isPrerequisiteEdge ? graphGroupKey(edge) : '',
          external: edge.external ?? false,
        },
      };
    });

    return [...nodeElements, ...edgeElements];
  }, [graph, groupAccents, groupRanks, structuredLayout.positions]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const measureStage = () => {
      const rect = stage.getBoundingClientRect();
      const nextSize = {
        height: Math.max(defaultGraphHeight, Math.round(rect.height || defaultGraphHeight)),
        width: Math.max(0, Math.round(rect.width || 0)),
      };

      setStageSize((current) =>
        current.height === nextSize.height && current.width === nextSize.width ? current : nextSize,
      );
    };

    measureStage();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(measureStage);
    resizeObserver.observe(stage);

    return () => resizeObserver.disconnect();
  }, []);

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
            'background-color': graphTheme.nodeFill,
            'border-color': graphTheme.nodeBorder,
            'border-opacity': 0.24,
            'border-width': '2px',
            color: graphTheme.nodeText,
            'font-size': '11.5px',
            'font-weight': 'bold',
            height: '76px',
            label: 'data(label)',
            'min-zoomed-font-size': '4px',
            shape: 'ellipse',
            'text-halign': 'center',
            'text-max-width': '68px',
            'text-outline-color': graphTheme.nodeTextOutline,
            'text-outline-width': '2px',
            'text-valign': 'center',
            'text-wrap': 'wrap',
            width: '76px',
          },
        },
        {
          selector: 'node.has-group',
          style: {
            'border-color': 'data(groupColor)',
            'border-opacity': 0.74,
            'underlay-color': 'data(groupColor)',
            'underlay-opacity': 0.07,
            'underlay-padding': '6px',
            'underlay-shape': 'ellipse',
          },
        },
        {
          selector: 'node.group-any',
          style: {
            'border-opacity': 0.9,
            'border-width': '3px',
            'underlay-opacity': 0.1,
          },
        },
        {
          selector: 'node.group-all',
          style: {
            'border-opacity': 0.54,
          },
        },
        {
          selector: 'node.is-root',
          style: rootNodeStyle,
        },
        {
          selector: 'node.is-external',
          style: {
            'background-color': graphTheme.nodeFill,
            'border-color': graphTheme.nodeBorder,
            'border-opacity': 0.42,
            'border-style': 'dashed',
            color: graphTheme.nodeText,
          },
        },
        {
          selector: 'node.is-root.is-external',
          style: rootNodeStyle,
        },
        {
          selector: 'edge',
          style: {
            'arrow-scale': 1.42,
            'curve-style': 'bezier',
            'line-cap': 'round',
            'line-color': graphTheme.edge,
            opacity: 0.28,
            'target-arrow-color': graphTheme.edge,
            'target-arrow-fill': 'filled',
            'target-arrow-shape': 'triangle-tee',
            'target-distance-from-node': '2px',
            width: '2.2px',
          },
        },
        {
          selector: 'edge.has-group',
          style: {
            'line-color': 'data(groupColor)',
            opacity: 0.58,
            'target-arrow-color': 'data(groupColor)',
            width: '2.6px',
          },
        },
        {
          selector: 'edge.group-any',
          style: {
            opacity: 0.9,
            width: '3.4px',
          },
        },
        {
          selector: 'edge.group-all',
          style: {
            opacity: 0.46,
            width: '2.4px',
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
            'border-color': graphTheme.hoverBorder,
            'border-opacity': 1,
            'border-width': '4px',
            'underlay-color': graphTheme.hoverBorder,
            'underlay-opacity': 0.24,
            'underlay-padding': '8px',
            'underlay-shape': 'ellipse',
          },
        },
        {
          selector: 'node.is-neighbor',
          style: {
            'border-color': graphTheme.nodeBorder,
            'border-opacity': 1,
            'border-width': '3px',
          },
        },
        {
          selector: 'node:selected',
          style: selectedNodeStyle,
        },
        {
          selector: 'node.is-root:selected',
          style: rootNodeStyle,
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': graphTheme.hoverBorder,
            'target-arrow-color': graphTheme.hoverBorder,
          },
        },
      ] as unknown as StylesheetJson,
      layout: { name: 'preset', animate: false, fit: false },
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
      const position = panelPosition(event, stageRef.current, containerRef.current);

      hoverNodeIdRef.current = courseId;
      applyHoverFocus(cy, node, graph);

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
              setHoverPanel({
                courseId,
                fallback,
                info,
                position: latestPanelPosition(node, stageRef.current, containerRef.current),
                status: 'success',
              });
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
              setHoverPanel({
                courseId,
                fallback,
                info,
                position: latestPanelPosition(node, stageRef.current, containerRef.current),
                status: 'error',
              });
            }
          });
      }, hoverDelayMs);
    });

    cy.on('mousemove', 'node', (event) => {
      const courseId = event.target.id();

      if (hoverNodeIdRef.current !== courseId) {
        return;
      }

      const position = panelPosition(event, stageRef.current, containerRef.current);
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

    cyRef.current = cy;
    runGraphLayout(cy, graph, structuredLayout, layoutMode, scrollRef.current);

    return () => {
      clearHover();
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, graph, layoutMode, onSelectCourse, structuredLayout]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || command.nonce === 0) {
      return;
    }

    if (command.action === 'fit') {
      requestGraphViewport(cy, graph, structuredLayout, layoutMode, scrollRef.current);
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
      runGraphLayout(cy, graph, structuredLayout, layoutMode, scrollRef.current);
      return;
    }

    const nextZoom = command.action === 'zoom-in' ? cy.zoom() * 1.18 : cy.zoom() / 1.18;
    const scrollElement = scrollRef.current;
    const renderedPosition =
      layoutMode === 'structured' && scrollElement
        ? { x: scrollElement.scrollLeft + scrollElement.clientWidth / 2, y: cy.height() / 2 }
        : { x: cy.width() / 2, y: cy.height() / 2 };

    cy.zoom({
      level: Math.min(cy.maxZoom(), Math.max(cy.minZoom(), nextZoom)),
      renderedPosition,
    });
  }, [command, graph, layoutMode, structuredLayout]);

  const canvasStyle =
    layoutMode === 'structured'
      ? {
          width: `${structuredLayout.width}px`,
        }
      : undefined;

  return (
    <div className="graph-stage" ref={stageRef}>
      <div className="graph-scroll" ref={scrollRef}>
        <div className="graph-canvas" ref={containerRef} style={canvasStyle} />
      </div>

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
  return graphTheme.groupColors[Math.abs(groupIndex) % graphTheme.groupColors.length];
}

function graphGroupKey(edge: GraphResponse['edges'][number]): string {
  return `${edge.groupType}:${edge.groupIndex}`;
}

function edgeElementId(edge: GraphResponse['edges'][number], index: number): string {
  return graphEdgeElementId(edge, index);
}

function runGraphLayout(
  cy: Core,
  graph: GraphResponse,
  graphLayout: GraphLayout,
  layoutMode: GraphLayoutMode,
  scrollElement: HTMLDivElement | null,
) {
  cy.stop();

  cy.nodes().forEach((node) => {
    const position = graphLayout.positions.get(node.id());

    if (position) {
      node.position(position);
    }
  });

  if (layoutMode === 'organic') {
    runOrganicGraphLayout(cy, graph.rootCourseId, graphLayout, layoutMode, scrollElement);
    return;
  }

  requestGraphViewport(cy, graph, graphLayout, layoutMode, scrollElement);
}

function runOrganicGraphLayout(
  cy: Core,
  rootCourseId: string,
  graphLayout: GraphLayout,
  layoutMode: GraphLayoutMode,
  scrollElement: HTMLDivElement | null,
) {
  if (cy.nodes().length === 0) {
    requestGraphViewport(cy, { rootCourseId } as GraphResponse, graphLayout, layoutMode, scrollElement);
    return;
  }

  const layout = cy.layout(organicLayoutOptions(cy.nodes().length));

  layout.one('layoutstop', () => {
    separateOrganicGroups(cy, rootCourseId);
    requestGraphViewport(cy, { rootCourseId } as GraphResponse, graphLayout, layoutMode, scrollElement);
  });

  layout.run();
}

function organicLayoutOptions(nodeCount: number): CytoscapeLayoutOptions {
  return {
    name: 'cose',
    animate: false,
    componentSpacing: 188,
    coolingFactor: 0.94,
    edgeElasticity: (edge: EdgeSingular) => (edge.data('groupType') === 'any' ? 78 : 92),
    fit: false,
    gravity: 0.14,
    idealEdgeLength: (edge: EdgeSingular) => (edge.data('groupKey') ? 164 : 188),
    initialTemp: 190,
    minTemp: 1,
    nodeDimensionsIncludeLabels: true,
    nodeOverlap: 26,
    nodeRepulsion: (node: NodeSingular) => (node.data('root') ? 260000 : 190000),
    numIter: organicLayoutIterations(nodeCount),
    randomize: false,
  } as CytoscapeLayoutOptions;
}

function organicLayoutIterations(nodeCount: number): number {
  if (nodeCount > 180) {
    return 420;
  }

  if (nodeCount > 90) {
    return 620;
  }

  return 860;
}

function separateOrganicGroups(cy: Core, rootCourseId: string) {
  const root = cy.getElementById(rootCourseId);
  const rootPosition = root.nonempty() ? root.position() : { x: 0, y: 0 };
  const groups = organicGroups(cy, rootCourseId);

  groups.forEach((group, index) => {
    const ring = Math.floor(index / 6);
    const desiredRadius = organicGroupRadius + ring * organicGroupRingGap + group.radius * 0.38;
    const angle = -Math.PI / 2 + index * organicGroupAngularStep;
    const target = {
      x: rootPosition.x + Math.cos(angle) * desiredRadius,
      y: rootPosition.y + Math.sin(angle) * desiredRadius,
    };
    const shift = {
      x: target.x - group.centroid.x,
      y: target.y - group.centroid.y,
    };

    group.nodes.forEach((node) => {
      const position = node.position();
      node.position({
        x: position.x + shift.x,
        y: position.y + shift.y,
      });
    });
  });

  resolveOrganicCollisions(cy, rootCourseId);
}

function organicGroups(cy: Core, rootCourseId: string): OrganicGroup[] {
  const grouped = new Map<string, NodeSingular[]>();

  cy.nodes().forEach((node) => {
    if (node.id() === rootCourseId) {
      return;
    }

    const groupKey = String(node.data('groupKey') || '');

    if (!groupKey) {
      return;
    }

    const nodes = grouped.get(groupKey) ?? [];
    nodes.push(node);
    grouped.set(groupKey, nodes);
  });

  return Array.from(grouped.entries())
    .map(([key, nodes]) => organicGroupFromNodes(key, nodes))
    .sort((left, right) => left.rank - right.rank || left.key.localeCompare(right.key, undefined, { numeric: true }));
}

function organicGroupFromNodes(key: string, nodes: NodeSingular[]): OrganicGroup {
  const rank = nodes.reduce((lowest, node) => Math.min(lowest, numericData(node, 'groupRank', Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  const centroid = nodes.reduce(
    (sum, node) => {
      const position = node.position();
      return {
        x: sum.x + position.x / nodes.length,
        y: sum.y + position.y / nodes.length,
      };
    },
    { x: 0, y: 0 },
  );
  const radius = nodes.reduce((largest, node) => {
    const position = node.position();
    return Math.max(largest, Math.hypot(position.x - centroid.x, position.y - centroid.y));
  }, layoutNodeDiameter);

  return {
    centroid,
    key,
    nodes: [...nodes].sort((left, right) => left.id().localeCompare(right.id(), undefined, { numeric: true })),
    radius,
    rank,
  };
}

function resolveOrganicCollisions(cy: Core, rootCourseId: string) {
  const nodes = cy
    .nodes()
    .toArray()
    .sort((left, right) => left.id().localeCompare(right.id(), undefined, { numeric: true })) as NodeSingular[];

  for (let pass = 0; pass < organicCollisionPassCount(nodes.length); pass += 1) {
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        separateNodePair(nodes[leftIndex], nodes[rightIndex], rootCourseId);
      }
    }
  }
}

function organicCollisionPassCount(nodeCount: number): number {
  if (nodeCount > 180) {
    return 3;
  }

  if (nodeCount > 90) {
    return 4;
  }

  return organicCollisionPasses;
}

function separateNodePair(left: NodeSingular, right: NodeSingular, rootCourseId: string) {
  const leftPosition = left.position();
  const rightPosition = right.position();
  const delta = {
    x: rightPosition.x - leftPosition.x,
    y: rightPosition.y - leftPosition.y,
  };
  const distance = Math.hypot(delta.x, delta.y);
  const sameGroup = Boolean(left.data('groupKey')) && left.data('groupKey') === right.data('groupKey');
  const minimumDistance = sameGroup ? organicSameGroupNodeGap : organicCrossGroupNodeGap;

  if (distance >= minimumDistance) {
    return;
  }

  const fallbackAngle = deterministicAngle(`${left.id()}:${right.id()}`);
  const unit = distance > 0.01
    ? { x: delta.x / distance, y: delta.y / distance }
    : { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };
  const push = (minimumDistance - Math.max(distance, 0.01)) / 2;
  const leftIsRoot = left.id() === rootCourseId;
  const rightIsRoot = right.id() === rootCourseId;

  if (!leftIsRoot) {
    left.position({
      x: leftPosition.x - unit.x * (rightIsRoot ? push * 2 : push),
      y: leftPosition.y - unit.y * (rightIsRoot ? push * 2 : push),
    });
  }

  if (!rightIsRoot) {
    right.position({
      x: rightPosition.x + unit.x * (leftIsRoot ? push * 2 : push),
      y: rightPosition.y + unit.y * (leftIsRoot ? push * 2 : push),
    });
  }
}

function deterministicAngle(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return (hash % 360) * (Math.PI / 180);
}

function numericData(node: NodeSingular, key: string, fallback: number): number {
  const value = Number(node.data(key));
  return Number.isFinite(value) ? value : fallback;
}

function requestGraphViewport(
  cy: Core,
  graph: GraphResponse,
  graphLayout: GraphLayout,
  layoutMode: GraphLayoutMode,
  scrollElement: HTMLDivElement | null,
) {
  if (layoutMode === 'structured') {
    requestStructuredViewport(cy, graph, graphLayout, scrollElement);
    return;
  }

  requestFit(cy);
}

function requestStructuredViewport(
  cy: Core,
  graph: GraphResponse,
  graphLayout: GraphLayout,
  scrollElement: HTMLDivElement | null,
) {
  const alignScrollToRoot = () => {
    if (!scrollElement) {
      return;
    }

    const rootPosition = graphLayout.positions.get(graph.rootCourseId);
    const rootX = rootPosition?.x ?? graphLayout.rootX;
    const maxScrollLeft = Math.max(0, scrollElement.scrollWidth - scrollElement.clientWidth);
    const nextScrollLeft = Math.min(Math.max(0, rootX - scrollElement.clientWidth * 0.32), maxScrollLeft);
    scrollElement.scrollLeft = nextScrollLeft;
  };

  window.requestAnimationFrame(() => {
    cy.resize();
    cy.zoom(1);
    cy.pan({ x: 0, y: 0 });
    alignScrollToRoot();

    window.requestAnimationFrame(() => {
      cy.resize();
      cy.zoom(1);
      cy.pan({ x: 0, y: 0 });
      alignScrollToRoot();
    });
  });
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

function groupAccentByNode(graph: GraphResponse): Map<string, GraphGroupAccent> {
  const accents = new Map<string, GraphGroupAccent>();

  graph.edges.forEach((edge) => {
    if (edge.relationship !== 'prerequisite') {
      return;
    }

    const accent = groupAccentForEdge(edge);
    setPreferredGroupAccent(accents, edge.from, accent);
    setPreferredGroupAccent(accents, edge.to, accent);
  });

  accents.delete(graph.rootCourseId);
  return accents;
}

function groupAccentForEdge(edge: GraphResponse['edges'][number]): GraphGroupAccent {
  return {
    color: groupColor(edge.groupIndex),
    key: graphGroupKey(edge),
    rank: edge.groupType === 'any' ? Math.abs(edge.groupIndex) : 1000 + Math.abs(edge.groupIndex),
    type: edge.groupType,
  };
}

function setPreferredGroupAccent(
  accents: Map<string, GraphGroupAccent>,
  courseId: string,
  accent: GraphGroupAccent,
) {
  const current = accents.get(courseId);

  if (
    !current
    || accent.rank < current.rank
    || (accent.rank === current.rank && accent.key.localeCompare(current.key, undefined, { numeric: true }) < 0)
  ) {
    accents.set(courseId, accent);
  }
}

function groupRankByNode(graph: GraphResponse): Map<string, number> {
  const ranks = new Map<string, number>();

  graph.edges.forEach((edge) => {
    if (edge.relationship !== 'prerequisite') {
      return;
    }

    const rank = edge.groupType === 'any' ? Math.abs(edge.groupIndex) : 1000 + Math.abs(edge.groupIndex);
    setLowestRank(ranks, edge.from, rank);
    setLowestRank(ranks, edge.to, rank);
  });

  return ranks;
}

function graphNodeLayout(
  graph: GraphResponse,
  groupRanks: Map<string, number>,
  stageSize: StageSize,
): GraphLayout {
  const canvasHeight = Math.max(defaultGraphHeight, stageSize.height || defaultGraphHeight);
  const viewportWidth = Math.max(0, stageSize.width || 0);
  const maxRows = maxRowsForHeight(canvasHeight);
  const placements = nodePlacements(graph, groupRanks);
  const positions = new Map<string, { x: number; y: number }>();
  const bucketPlacements = new Map<string, NodePlacement[]>();

  placements.forEach((placement) => {
    if (placement.id === graph.rootCourseId) {
      positions.set(placement.id, { x: 0, y: canvasHeight / 2 });
      return;
    }

    const side = placement.side < 0 ? -1 : 1;
    const key = `${side}:${placement.distance}`;
    const bucket = bucketPlacements.get(key) ?? [];
    bucket.push(placement);
    bucketPlacements.set(key, bucket);
  });

  const buckets = Array.from(bucketPlacements.entries()).map<LayoutBucket>(([key, bucket]) => {
    const [side, distance] = key.split(':').map(Number) as [-1 | 1, number];
    const placementsForBucket = [...bucket].sort(comparePlacements);

    return {
      columnCount: Math.max(1, Math.ceil(placementsForBucket.length / maxRows)),
      distance,
      placements: placementsForBucket,
      side,
      startX: 0,
    };
  });

  assignBucketColumns(buckets, 1);
  assignBucketColumns(buckets, -1);

  buckets.forEach((bucket) => {
    bucket.placements.forEach((placement, index) => {
      const column = Math.floor(index / maxRows);
      const row = index % maxRows;
      const rowsInColumn = Math.min(maxRows, bucket.placements.length - column * maxRows);
      const x = bucket.startX + bucket.side * column * layoutColumnSpacing;
      const y = centeredRowY(row, rowsInColumn, canvasHeight);

      positions.set(placement.id, { x, y });
    });
  });

  return normalizeGraphLayout(positions, graph.rootCourseId, viewportWidth, canvasHeight);
}

function assignBucketColumns(buckets: LayoutBucket[], side: -1 | 1) {
  let nextStartX = side * layoutFirstLayerGap;

  buckets
    .filter((bucket) => bucket.side === side)
    .sort((left, right) => left.distance - right.distance)
    .forEach((bucket) => {
      bucket.startX = nextStartX;
      nextStartX += side * (bucket.columnCount * layoutColumnSpacing + layoutDistanceGap);
    });
}

function centeredRowY(row: number, rowsInColumn: number, canvasHeight: number): number {
  return canvasHeight / 2 + (row - (rowsInColumn - 1) / 2) * layoutRowSpacing;
}

function maxRowsForHeight(canvasHeight: number): number {
  const availableHeight = Math.max(0, canvasHeight - layoutVerticalPadding * 2 - layoutNodeDiameter);
  return Math.max(1, Math.floor(availableHeight / layoutRowSpacing) + 1);
}

function normalizeGraphLayout(
  positions: Map<string, { x: number; y: number }>,
  rootCourseId: string,
  viewportWidth: number,
  canvasHeight: number,
): GraphLayout {
  if (positions.size === 0) {
    return {
      height: canvasHeight,
      positions,
      rootX: 0,
      width: viewportWidth,
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;

  positions.forEach((position) => {
    minX = Math.min(minX, position.x - layoutNodeDiameter / 2);
    maxX = Math.max(maxX, position.x + layoutNodeDiameter / 2);
  });

  const offsetX = layoutHorizontalPadding - minX;
  const normalizedPositions = new Map<string, { x: number; y: number }>();

  positions.forEach((position, courseId) => {
    normalizedPositions.set(courseId, {
      x: position.x + offsetX,
      y: position.y,
    });
  });

  const contentWidth = maxX - minX + layoutHorizontalPadding * 2;
  const width = Math.max(viewportWidth, Math.ceil(contentWidth));
  const rootX = normalizedPositions.get(rootCourseId)?.x ?? layoutHorizontalPadding;

  return {
    height: canvasHeight,
    positions: normalizedPositions,
    rootX,
    width,
  };
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

function applyHoverFocus(cy: Core, node: NodeSingular, graph: GraphResponse) {
  cy.elements().removeClass('is-faded is-focused is-hovered is-neighbor');

  const focus = graphPathFocus(graph, node.id());
  const focusedNodeIds = focus.nodeIds;
  const focusedEdgeIds = focus.edgeIds;

  cy.elements().forEach((element) => {
    const isFocusedNode = element.isNode() && focusedNodeIds.has(element.id());
    const isFocusedEdge = element.isEdge() && focusedEdgeIds.has(element.id());

    if (!isFocusedNode && !isFocusedEdge) {
      element.addClass('is-faded');
    }
  });

  node.addClass('is-hovered');
  cy.nodes().filter((pathNode) => focusedNodeIds.has(pathNode.id()) && pathNode.id() !== node.id()).addClass('is-neighbor');
  cy.edges().filter((edge) => focusedEdgeIds.has(edge.id())).addClass('is-focused');
}

function clearGraphHoverState(cy: Core) {
  cy.elements().removeClass('is-faded is-focused is-hovered is-neighbor');
}

function panelPosition(
  event: EventObject,
  stage: HTMLDivElement | null,
  container: HTMLDivElement | null,
): { x: number; y: number } {
  const renderedPosition = event.renderedPosition ?? (event.target as NodeSingular).renderedPosition();
  return renderedPositionToPanelPosition(renderedPosition.x, renderedPosition.y, stage, container);
}

function latestPanelPosition(
  node: NodeSingular,
  stage: HTMLDivElement | null,
  container: HTMLDivElement | null,
): { x: number; y: number } {
  const position = node.renderedPosition();
  return renderedPositionToPanelPosition(position.x, position.y, stage, container);
}

function renderedPositionToPanelPosition(
  x: number,
  y: number,
  stage: HTMLDivElement | null,
  container: HTMLDivElement | null,
): { x: number; y: number } {
  const stageRect = stage?.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect();
  const offsetX = stageRect && containerRect ? containerRect.left - stageRect.left : 0;
  const offsetY = stageRect && containerRect ? containerRect.top - stageRect.top : 0;

  return clampPanelPosition(offsetX + x + 16, offsetY + y + 16, stage);
}

function clampPanelPosition(x: number, y: number, stage: HTMLDivElement | null): { x: number; y: number } {
  const width = stage?.clientWidth ?? 360;
  const height = stage?.clientHeight ?? 260;
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
