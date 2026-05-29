import type { GraphEdge, GraphResponse } from '../types';

export interface GraphPathFocus {
  edgeIds: Set<string>;
  found: boolean;
  nodeIds: Set<string>;
}

interface TraversalEdge {
  edgeId: string;
  nextNodeId: string;
}

interface VisitedFrom {
  edgeId: string;
  previousNodeId: string;
}

export function graphEdgeElementId(edge: GraphEdge, index: number): string {
  return `${edge.from}-${edge.to}-${edge.groupIndex}-${index}`;
}

export function graphPathFocus(graph: GraphResponse, targetNodeId: string): GraphPathFocus {
  const rootNodeId = graph.rootCourseId;

  if (!rootNodeId || !targetNodeId) {
    return emptyPathFocus(targetNodeId);
  }

  if (rootNodeId === targetNodeId) {
    return {
      edgeIds: new Set(),
      found: true,
      nodeIds: new Set([rootNodeId]),
    };
  }

  const adjacency = buildUndirectedAdjacency(graph);
  const visitedFrom = new Map<string, VisitedFrom | null>([[targetNodeId, null]]);
  const queue = [targetNodeId];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const currentNodeId = queue[cursor];

    if (currentNodeId === rootNodeId) {
      return reconstructPathFocus(rootNodeId, visitedFrom);
    }

    for (const edge of adjacency.get(currentNodeId) ?? []) {
      if (visitedFrom.has(edge.nextNodeId)) {
        continue;
      }

      visitedFrom.set(edge.nextNodeId, {
        edgeId: edge.edgeId,
        previousNodeId: currentNodeId,
      });
      queue.push(edge.nextNodeId);
    }
  }

  return {
    edgeIds: new Set(),
    found: false,
    nodeIds: new Set([targetNodeId]),
  };
}

function buildUndirectedAdjacency(graph: GraphResponse): Map<string, TraversalEdge[]> {
  const adjacency = new Map<string, TraversalEdge[]>();

  graph.edges.forEach((edge, index) => {
    const edgeId = graphEdgeElementId(edge, index);
    addTraversalEdge(adjacency, edge.from, { edgeId, nextNodeId: edge.to });
    addTraversalEdge(adjacency, edge.to, { edgeId, nextNodeId: edge.from });
  });

  return adjacency;
}

function addTraversalEdge(
  adjacency: Map<string, TraversalEdge[]>,
  nodeId: string,
  edge: TraversalEdge,
) {
  const edges = adjacency.get(nodeId) ?? [];
  edges.push(edge);
  adjacency.set(nodeId, edges);
}

function reconstructPathFocus(
  rootNodeId: string,
  visitedFrom: Map<string, VisitedFrom | null>,
): GraphPathFocus {
  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>([rootNodeId]);
  let currentNodeId = rootNodeId;

  while (true) {
    const previous = visitedFrom.get(currentNodeId);

    if (!previous) {
      break;
    }

    edgeIds.add(previous.edgeId);
    nodeIds.add(previous.previousNodeId);
    currentNodeId = previous.previousNodeId;
  }

  return {
    edgeIds,
    found: true,
    nodeIds,
  };
}

function emptyPathFocus(targetNodeId: string): GraphPathFocus {
  return {
    edgeIds: new Set(),
    found: false,
    nodeIds: targetNodeId ? new Set([targetNodeId]) : new Set(),
  };
}
