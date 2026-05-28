import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import { API_BASE_URL, getCourse, getDependents, getGraph, getPrerequisites, isAbortError, listCourses } from './api/client';
import CourseDetail from './components/CourseDetail';
import CourseSearch from './components/CourseSearch';
import ExplorerControls from './components/ExplorerControls';
import GraphExplorer from './components/GraphExplorer';
import type {
  CourseDetail as CourseDetailType,
  CourseRelationshipResponse,
  CourseSummary,
  GraphCommand,
  GraphCommandAction,
  GraphDirection,
  GraphLayoutMode,
  GraphNode,
  GraphResponse,
  LoadStatus,
} from './types';

const initialCourseId = 'CMPSC 16';
const catalogLimit = 20000;
const visibleCourseLimit = 200;

function App() {
  const graphPanelRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState('all');
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId);
  const [direction, setDirection] = useState<GraphDirection>('both');
  const [depth, setDepth] = useState(2);
  const [graphCommand, setGraphCommand] = useState<GraphCommand>({ action: 'fit', nonce: 0 });
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('structured');
  const [dependentDepthVisible, setDependentDepthVisible] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);

  const [filterCatalog, setFilterCatalog] = useState<CourseSummary[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [courseStatus, setCourseStatus] = useState<LoadStatus>('idle');
  const [courseError, setCourseError] = useState<string | null>(null);
  const [courseReloadKey, setCourseReloadKey] = useState(0);

  const [selectedCourse, setSelectedCourse] = useState<CourseDetailType | null>(null);
  const [prerequisiteResponse, setPrerequisiteResponse] = useState<CourseRelationshipResponse | null>(null);
  const [dependentResponse, setDependentResponse] = useState<CourseRelationshipResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<LoadStatus>('idle');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);

  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [graphStatus, setGraphStatus] = useState<LoadStatus>('idle');
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphReloadKey, setGraphReloadKey] = useState(0);

  const filterSource = filterCatalog.length > 0 ? filterCatalog : courses;
  const courseById = useMemo(() => new Map(filterSource.map((course) => [course.id, course])), [filterSource]);
  const subjects = useMemo(
    () => uniqueSorted(filterSource.map((course) => course.subject || subjectFromId(course.id))),
    [filterSource],
  );
  const colleges = useMemo(
    () => uniqueSorted(filterSource.map((course) => course.college).filter(Boolean)),
    [filterSource],
  );

  const visibleCourses = useMemo(
    () => filterCourses(courses, query, subject, selectedColleges),
    [courses, query, selectedColleges, subject],
  );
  const displayedCourses = useMemo(() => visibleCourses.slice(0, visibleCourseLimit), [visibleCourses]);

  const visibleGraph = useMemo(
    () =>
      graph
        ? progressiveDependentsGraph(filterGraph(graph, subject, selectedColleges, courseById), dependentDepthVisible)
        : emptyGraph(selectedCourseId ?? '', direction, depth),
    [courseById, dependentDepthVisible, depth, direction, graph, selectedColleges, selectedCourseId, subject],
  );
  const maxDependentDepth = useMemo(() => dependentDistanceDepth(visibleGraph), [visibleGraph]);
  const canShowMoreDependents = direction !== 'prerequisites' && dependentDepthVisible < maxDependentDepth;

  const runGraphCommand = useCallback((action: GraphCommandAction) => {
    setGraphCommand((current) => ({ action, nonce: current.nonce + 1 }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    listCourses({ limit: catalogLimit }, controller.signal)
      .then((loadedCourses) => {
        setFilterCatalog(loadedCourses);
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setFilterCatalog([]);
        }
      });

    return () => controller.abort();
  }, [courseReloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      const normalizedQuery = query.trim();

      setCourseStatus('loading');
      setCourseError(null);

      listCourses(
        {
          limit: catalogLimit,
          q: normalizedQuery || undefined,
          subject: subject === 'all' ? undefined : subject,
          colleges: selectedColleges,
        },
        controller.signal,
      )
        .then((loadedCourses) => {
          setCourses(loadedCourses);
          setCourseStatus('success');

          if (loadedCourses.length > 0) {
            setSelectedCourseId((current) => current ?? loadedCourses[0].id);
          }
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          setCourses([]);
          setCourseStatus('error');
          setCourseError(errorMessage(error, 'Unable to load the course catalog.'));
        });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [courseReloadKey, query, selectedColleges, subject]);

  useEffect(() => {
    if (!selectedCourseId) {
      setSelectedCourse(null);
      setPrerequisiteResponse(null);
      setDependentResponse(null);
      setDetailStatus('idle');
      return;
    }

    const controller = new AbortController();

    setDetailStatus('loading');
    setDetailError(null);
    setSelectedCourse(null);
    setPrerequisiteResponse(null);
    setDependentResponse(null);

    Promise.all([
      getCourse(selectedCourseId, controller.signal),
      getPrerequisites(selectedCourseId, controller.signal),
      getDependents(selectedCourseId, controller.signal),
    ])
      .then(([course, prerequisites, dependents]) => {
        setSelectedCourse(course);
        setPrerequisiteResponse(prerequisites);
        setDependentResponse(dependents);
        setDetailStatus('success');
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        setSelectedCourse(null);
        setPrerequisiteResponse(null);
        setDependentResponse(null);
        setDetailStatus('error');
        setDetailError(errorMessage(error, 'Unable to load course details.'));
      });

    return () => controller.abort();
  }, [detailReloadKey, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setGraph(null);
      setGraphStatus('idle');
      return;
    }

    const controller = new AbortController();

    setGraphStatus('loading');
    setGraphError(null);
    setGraph(null);

    getGraph(
      {
        course: selectedCourseId,
        direction,
        depth,
        subject: subject === 'all' ? undefined : subject,
        colleges: selectedColleges,
      },
      controller.signal,
    )
      .then((graphResponse) => {
        setGraph(graphResponse);
        setGraphStatus('success');
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        setGraph(null);
        setGraphStatus('error');
        setGraphError(errorMessage(error, 'Unable to load graph data.'));
      });

    return () => controller.abort();
  }, [depth, direction, graphReloadKey, selectedColleges, selectedCourseId, subject]);

  useEffect(() => {
    setDependentDepthVisible(1);
  }, [selectedCourseId, direction, subject, selectedColleges, depth]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = document.fullscreenElement === graphPanelRef.current;
      setIsFullscreen(active);

      if (active) {
        setFullscreenFallback(false);
      }

      window.setTimeout(() => runGraphCommand('fit'), 60);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [runGraphCommand]);

  const toggleCollege = (college: string) => {
    setSelectedColleges((current) =>
      current.includes(college) ? current.filter((item) => item !== college) : [...current, college],
    );
  };

  const toggleFullscreen = async () => {
    const panel = graphPanelRef.current;

    if (!panel) {
      return;
    }

    if (fullscreenFallback) {
      setFullscreenFallback(false);
      setIsFullscreen(false);
      window.setTimeout(() => runGraphCommand('fit'), 60);
      return;
    }

    if (document.fullscreenElement === panel) {
      await document.exitFullscreen();
      return;
    }

    if (!panel.requestFullscreen) {
      setFullscreenFallback(true);
      setIsFullscreen(true);
      window.setTimeout(() => runGraphCommand('fit'), 60);
      return;
    }

    try {
      await panel.requestFullscreen();
    } catch {
      setFullscreenFallback(true);
      setIsFullscreen(true);
      window.setTimeout(() => runGraphCommand('fit'), 60);
    }
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <span className="eyebrow">UCSB Catalog</span>
          <h1>Course Explorer</h1>
        </div>
        <div className="catalog-status" aria-label="Catalog status">
          <span>{catalogStatusText(courseStatus, filterSource.length)}</span>
          <span>{API_BASE_URL}</span>
        </div>
      </header>

      <section className="workspace" aria-label="Course explorer workspace">
        <aside className="course-panel" aria-label="Course search and results">
          <div className="panel-toolbar">
            <label className="search-field">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Search courses</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by course, title, subject, or department"
              />
            </label>

            <label className="subject-filter">
              <Filter aria-hidden="true" size={17} />
              <span className="sr-only">Subject filter</span>
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="all">All subjects</option>
                {subjects.map((subjectCode) => (
                  <option key={subjectCode} value={subjectCode}>
                    {subjectCode}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="college-filter">
              <legend>Colleges</legend>
              <div className="college-options">
                <button
                  className={selectedColleges.length === 0 ? 'is-active' : ''}
                  type="button"
                  onClick={() => setSelectedColleges([])}
                >
                  All
                </button>
                {colleges.map((college) => (
                  <label className="college-option" key={college}>
                    <input
                      checked={selectedColleges.includes(college)}
                      type="checkbox"
                      onChange={() => toggleCollege(college)}
                    />
                    <span>{college}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <CourseSearch
            courses={displayedCourses}
            totalCount={visibleCourses.length}
            error={courseError}
            loading={courseStatus === 'loading'}
            selectedCourseId={selectedCourseId}
            onRetry={() => setCourseReloadKey((value) => value + 1)}
            onSelectCourse={setSelectedCourseId}
          />
        </aside>

        <section
          className={`graph-panel ${isFullscreen || fullscreenFallback ? 'is-fullscreen' : ''}`}
          ref={graphPanelRef}
          aria-label="Prerequisite graph"
        >
          <ExplorerControls
            canShowMoreDependents={canShowMoreDependents}
            depth={depth}
            direction={direction}
            graphEdgeCount={visibleGraph.edges.length}
            graphNodeCount={visibleGraph.nodes.length}
            isFullscreen={isFullscreen || fullscreenFallback}
            layoutMode={layoutMode}
            onDepthChange={setDepth}
            onDirectionChange={setDirection}
            onFit={() => runGraphCommand('fit')}
            onLayoutModeChange={setLayoutMode}
            onReset={() => runGraphCommand('reset')}
            onShowMoreDependents={() => setDependentDepthVisible((current) => current + 1)}
            onToggleFullscreen={toggleFullscreen}
            onZoomIn={() => runGraphCommand('zoom-in')}
            onZoomOut={() => runGraphCommand('zoom-out')}
          />
          <GraphExplorer
            command={graphCommand}
            error={graphError}
            graph={visibleGraph}
            layoutMode={layoutMode}
            loading={graphStatus === 'loading'}
            onRetry={() => setGraphReloadKey((value) => value + 1)}
            onSelectCourse={setSelectedCourseId}
          />
        </section>

        <CourseDetail
          course={selectedCourse}
          dependentResponse={dependentResponse}
          error={detailError}
          loading={detailStatus === 'loading'}
          prerequisiteResponse={prerequisiteResponse}
          onRetry={() => setDetailReloadKey((value) => value + 1)}
          onSelectCourse={setSelectedCourseId}
        />
      </section>
    </main>
  );
}

function catalogStatusText(status: LoadStatus, count: number): string {
  if (status === 'loading' || status === 'idle') {
    return 'Loading catalog';
  }

  if (status === 'error') {
    return 'Catalog unavailable';
  }

  return `${count} courses`;
}

function filterCourses(
  courses: CourseSummary[],
  query: string,
  subject: string,
  selectedColleges: string[],
): CourseSummary[] {
  const normalizedQuery = query.trim().toLowerCase();

  return courses
    .filter((course) => subject === 'all' || (course.subject || subjectFromId(course.id)) === subject)
    .filter((course) => selectedColleges.length === 0 || selectedColleges.includes(course.college))
    .filter((course) => {
      if (!normalizedQuery) {
        return true;
      }

      return [course.id, course.name, course.subject, course.department, course.college]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    })
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}

function filterGraph(
  graph: GraphResponse,
  subject: string,
  selectedColleges: string[],
  courseById: Map<string, CourseSummary>,
): GraphResponse {
  const nodes = graph.nodes.filter((node) => {
    if (node.id === graph.rootCourseId || node.external) {
      return true;
    }

    const metadata = nodeMetadata(node, courseById);
    const nodeSubject = metadata.subject || subjectFromId(node.id);

    if (subject !== 'all' && nodeSubject !== subject) {
      return false;
    }

    if (selectedColleges.length > 0 && metadata.college && !selectedColleges.includes(metadata.college)) {
      return false;
    }

    return true;
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const connectedIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const connectedNodes = nodes.filter((node) => node.id === graph.rootCourseId || !node.external || connectedIds.has(node.id));

  return {
    ...graph,
    nodes: connectedNodes,
    edges,
  };
}

function nodeMetadata(node: GraphNode, courseById: Map<string, CourseSummary>): Partial<CourseSummary> {
  return courseById.get(node.id) ?? node;
}

function emptyGraph(rootCourseId: string, direction: GraphDirection, depth: number): GraphResponse {
  return {
    rootCourseId,
    direction,
    depth,
    nodes: [],
    edges: [],
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function subjectFromId(courseId: string): string {
  return courseId.split(' ')[0] || courseId;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return `Backend API unavailable at ${API_BASE_URL}.`;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

function progressiveDependentsGraph(graph: GraphResponse, maxDependentDepth: number): GraphResponse {
  if (maxDependentDepth < 1 || graph.direction === 'prerequisites') {
    return graph;
  }

  const distances = new Map<string, number>([[graph.rootCourseId, 0]]);
  const queue = [graph.rootCourseId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentDepth = distances.get(current) ?? 0;

    for (const edge of graph.edges) {
      if (edge.relationship !== 'dependent' || edge.from !== current) {
        continue;
      }

      const nextDepth = currentDepth + 1;
      if (nextDepth > maxDependentDepth) {
        continue;
      }

      const existing = distances.get(edge.to);
      if (existing === undefined || nextDepth < existing) {
        distances.set(edge.to, nextDepth);
        queue.push(edge.to);
      }
    }
  }

  const keptNodes = new Set(
    graph.nodes
      .filter((node) => {
        const nodeDepth = distances.get(node.id);
        return node.id === graph.rootCourseId || nodeDepth !== undefined || !hasDependentInboundEdge(node.id, graph.edges);
      })
      .map((node) => node.id),
  );

  const edges = graph.edges.filter((edge) => {
    if (!keptNodes.has(edge.from) || !keptNodes.has(edge.to)) {
      return false;
    }

    if (edge.relationship !== 'dependent') {
      return true;
    }

    return (distances.get(edge.to) ?? Number.POSITIVE_INFINITY) <= maxDependentDepth;
  });

  return { ...graph, nodes: graph.nodes.filter((node) => keptNodes.has(node.id)), edges };
}

function dependentDistanceDepth(graph: GraphResponse): number {
  const distances = new Map<string, number>([[graph.rootCourseId, 0]]);
  const queue = [graph.rootCourseId];
  let maxDepth = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentDepth = distances.get(current) ?? 0;
    maxDepth = Math.max(maxDepth, currentDepth);
    for (const edge of graph.edges) {
      if (edge.relationship !== 'dependent' || edge.from !== current) {
        continue;
      }
      const nextDepth = currentDepth + 1;
      const existing = distances.get(edge.to);
      if (existing === undefined || nextDepth < existing) {
        distances.set(edge.to, nextDepth);
        queue.push(edge.to);
      }
    }
  }

  return maxDepth;
}

function hasDependentInboundEdge(nodeId: string, edges: GraphResponse['edges']): boolean {
  return edges.some((edge) => edge.relationship === 'dependent' && edge.to === nodeId);
}

export default App;
