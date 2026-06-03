import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, Moon, Route, Search, Sun } from 'lucide-react';
import {
  API_BASE_URL,
  getCourse,
  getDependents,
  getGraph,
  getPath,
  getPrerequisites,
  isAbortError,
  listCourses,
} from './api/client';
import CourseDetail from './components/CourseDetail';
import CourseSearch from './components/CourseSearch';
import ExplorerControls from './components/ExplorerControls';
import GraphExplorer from './components/GraphExplorer';
import AdvisorPanel from './components/AdvisorPanel';
import {
  courseIdsForStatus,
  emptyStudentProfile,
  loadStudentProfile,
  saveStudentProfile,
} from './utils/advisor';
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
  GraphTheme,
  LoadStatus,
  PathResponse,
  StudentProfile,
  ThemeMode,
} from './types';

const initialCourseId = 'CMPSC 16';
const catalogLimit = 20000;
const visibleCourseLimit = 200;
const pathSuggestionDepth = 6;
const pathSuggestionLimit = 80;
const themeStorageKey = 'requisite-visualization.theme.v1';

const graphThemes: Record<ThemeMode, GraphTheme> = {
  light: {
    completedFill: '#DCFCE7',
    currentFill: '#FEF3C7',
    edge: '#64748B',
    groupColors: ['#2563EB', '#7C3AED', '#DB2777', '#059669', '#B45309', '#DC2626'],
    hoverBorder: '#2563EB',
    nodeBorder: '#64748B',
    nodeFill: '#FFFFFF',
    nodeText: '#0F172A',
    nodeTextOutline: '#FFFFFF',
    plannedFill: '#EDE9FE',
    rootBorder: '#059669',
  },
  dark: {
    completedFill: '#173A31',
    currentFill: '#2F2B16',
    edge: '#C7D0DD',
    groupColors: ['#7AA2F7', '#A78BFA', '#E09CB5', '#56C2A3', '#D6AA43', '#E06C75'],
    hoverBorder: '#7AA2F7',
    nodeBorder: '#C7D0DD',
    nodeFill: '#10151D',
    nodeText: '#F3F6FA',
    nodeTextOutline: '#080B10',
    plannedFill: '#221B35',
    rootBorder: '#56C2A3',
  },
};

function App() {
  const graphPanelRef = useRef<HTMLElement | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    typeof window === 'undefined' ? 'light' : loadThemeMode(),
  );
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [subject, setSubject] = useState('all');
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId);
  const [direction, setDirection] = useState<GraphDirection>('both');
  const [depth, setDepth] = useState(2);
  const [graphCommand, setGraphCommand] = useState<GraphCommand>({ action: 'fit', nonce: 0 });
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('structured');
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

  const [pathFrom, setPathFrom] = useState(initialCourseId);
  const [pathTo, setPathTo] = useState('');
  const [pathStatus, setPathStatus] = useState<LoadStatus>('idle');
  const [pathError, setPathError] = useState<string | null>(null);
  const [pathResponse, setPathResponse] = useState<PathResponse | null>(null);
  const [pathFromSuggestionIds, setPathFromSuggestionIds] = useState<Set<string> | null>(null);
  const [pathToSuggestionIds, setPathToSuggestionIds] = useState<Set<string> | null>(null);
  const [pathFromSuggestionStatus, setPathFromSuggestionStatus] = useState<LoadStatus>('idle');
  const [pathToSuggestionStatus, setPathToSuggestionStatus] = useState<LoadStatus>('idle');
  const [pathFromSuggestionError, setPathFromSuggestionError] = useState<string | null>(null);
  const [pathToSuggestionError, setPathToSuggestionError] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile>(() =>
    typeof window === 'undefined' ? emptyStudentProfile : loadStudentProfile(),
  );

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
  const courseSuggestions = useMemo(() => visibleCourses.slice(0, 80), [visibleCourses]);
  const normalizedPathFrom = useMemo(() => normalizeCourseInput(pathFrom), [pathFrom]);
  const normalizedPathTo = useMemo(() => normalizeCourseInput(pathTo), [pathTo]);
  const selectedPathFromId = normalizedPathFrom && courseById.has(normalizedPathFrom) ? normalizedPathFrom : null;
  const selectedPathToId = normalizedPathTo && courseById.has(normalizedPathTo) ? normalizedPathTo : null;
  const pathFromSuggestions = useMemo(
    () => pathFromSuggestionIds ? coursesFromIds(pathFromSuggestionIds, courseById, pathSuggestionLimit) : courseSuggestions,
    [courseById, courseSuggestions, pathFromSuggestionIds],
  );
  const pathToSuggestions = useMemo(
    () => pathToSuggestionIds ? coursesFromIds(pathToSuggestionIds, courseById, pathSuggestionLimit) : courseSuggestions,
    [courseById, courseSuggestions, pathToSuggestionIds],
  );
  const pathFromHint = pathSuggestionHint({
    candidateCount: pathFromSuggestions.length,
    error: pathFromSuggestionError,
    selectedEndpointId: selectedPathToId,
    emptyText: selectedPathToId ? `No prerequisite courses can reach ${selectedPathToId}.` : '',
    loadingText: selectedPathToId ? `Loading valid starts for ${selectedPathToId}...` : '',
    status: pathFromSuggestionStatus,
  });
  const pathToHint = pathSuggestionHint({
    candidateCount: pathToSuggestions.length,
    error: pathToSuggestionError,
    selectedEndpointId: selectedPathFromId,
    emptyText: selectedPathFromId ? `No dependent courses reachable from ${selectedPathFromId}.` : '',
    loadingText: selectedPathFromId ? `Loading reachable courses from ${selectedPathFromId}...` : '',
    status: pathToSuggestionStatus,
  });

  const filteredGraph = useMemo(
    () =>
      graph
        ? filterGraph(graph, subject, selectedColleges, courseById)
        : emptyGraph(selectedCourseId ?? '', direction, depth),
    [courseById, depth, direction, graph, selectedColleges, selectedCourseId, subject],
  );
  const completedCourseIds = useMemo(() => courseIdsForStatus(studentProfile, 'completed'), [studentProfile]);
  const currentCourseIds = useMemo(() => courseIdsForStatus(studentProfile, 'current'), [studentProfile]);
  const plannedCourseIds = useMemo(() => courseIdsForStatus(studentProfile, 'planned'), [studentProfile]);
  const graphTheme = graphThemes[themeMode];
  const nextThemeMode: ThemeMode = themeMode === 'light' ? 'dark' : 'light';

  const runGraphCommand = useCallback((action: GraphCommandAction) => {
    setGraphCommand((current) => ({ action, nonce: current.nonce + 1 }));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    saveStudentProfile(studentProfile);
  }, [studentProfile]);

  useEffect(() => {
    let active = true;

    listCourses({ limit: catalogLimit })
      .then((loadedCourses) => {
        if (active) {
          setFilterCatalog(loadedCourses);
        }
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setFilterCatalog([]);
        }
      });

    return () => {
      active = false;
    };
  }, [courseReloadKey]);

  useEffect(() => {
    let active = true;
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
      )
        .then((loadedCourses) => {
          if (!active) {
            return;
          }

          setCourses(loadedCourses);
          setCourseStatus('success');

          if (loadedCourses.length > 0) {
            setSelectedCourseId((current) => current ?? loadedCourses[0].id);
          }
        })
        .catch((error: unknown) => {
          if (!active || isAbortError(error)) {
            return;
          }

          setCourses([]);
          setCourseStatus('error');
          setCourseError(errorMessage(error, 'Unable to load the course catalog.'));
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
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

    let active = true;

    setDetailStatus('loading');
    setDetailError(null);

    Promise.all([
      getCourse(selectedCourseId),
      getPrerequisites(selectedCourseId),
      getDependents(selectedCourseId),
    ])
      .then(([course, prerequisites, dependents]) => {
        if (!active) {
          return;
        }

        setSelectedCourse(course);
        setPrerequisiteResponse(prerequisites);
        setDependentResponse(dependents);
        setDetailStatus('success');
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        setSelectedCourse(null);
        setPrerequisiteResponse(null);
        setDependentResponse(null);
        setDetailStatus('error');
        setDetailError(errorMessage(error, 'Unable to load course details.'));
      });

    return () => {
      active = false;
    };
  }, [detailReloadKey, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setGraph(null);
      setGraphStatus('idle');
      return;
    }

    let active = true;

    setGraphStatus('loading');
    setGraphError(null);

    getGraph(
      {
        course: selectedCourseId,
        direction,
        depth,
        subject: subject === 'all' ? undefined : subject,
        colleges: selectedColleges,
      },
    )
      .then((graphResponse) => {
        if (!active) {
          return;
        }

        setGraph(graphResponse);
        setGraphStatus('success');
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        setGraph(null);
        setGraphStatus('error');
        setGraphError(errorMessage(error, 'Unable to load graph data.'));
      });

    return () => {
      active = false;
    };
  }, [depth, direction, graphReloadKey, selectedColleges, selectedCourseId, subject]);

  useEffect(() => {
    if (!selectedPathFromId) {
      setPathToSuggestionIds(null);
      setPathToSuggestionStatus('idle');
      setPathToSuggestionError(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    setPathToSuggestionIds(new Set());
    setPathToSuggestionStatus('loading');
    setPathToSuggestionError(null);

    getGraph(
      {
        course: selectedPathFromId,
        direction: 'dependents',
        depth: pathSuggestionDepth,
      },
      controller.signal,
    )
      .then((graphResponse) => {
        if (!active) {
          return;
        }

        setPathToSuggestionIds(courseIdsFromGraph(graphResponse, selectedPathFromId));
        setPathToSuggestionStatus('success');
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        setPathToSuggestionIds(new Set());
        setPathToSuggestionStatus('error');
        setPathToSuggestionError(errorMessage(error, 'Unable to load reachable courses.'));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedPathFromId]);

  useEffect(() => {
    if (!selectedPathToId) {
      setPathFromSuggestionIds(null);
      setPathFromSuggestionStatus('idle');
      setPathFromSuggestionError(null);
      return;
    }

    let active = true;
    const controller = new AbortController();

    setPathFromSuggestionIds(new Set());
    setPathFromSuggestionStatus('loading');
    setPathFromSuggestionError(null);

    getGraph(
      {
        course: selectedPathToId,
        direction: 'prerequisites',
        depth: pathSuggestionDepth,
      },
      controller.signal,
    )
      .then((graphResponse) => {
        if (!active) {
          return;
        }

        setPathFromSuggestionIds(courseIdsFromGraph(graphResponse, selectedPathToId));
        setPathFromSuggestionStatus('success');
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) {
          return;
        }

        setPathFromSuggestionIds(new Set());
        setPathFromSuggestionStatus('error');
        setPathFromSuggestionError(errorMessage(error, 'Unable to load valid starting courses.'));
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedPathToId]);

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

  const selectedCollegeLabel =
    selectedColleges.length === 0
      ? 'All colleges'
      : selectedColleges.length === 1
        ? selectedColleges[0]
        : `${selectedColleges.length} colleges`;

  const submitCourseSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResultsOpen(true);
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
  };

  const selectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
  };

  const submitPathSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const from = normalizeCourseInput(pathFrom);
    const to = normalizeCourseInput(pathTo);

    if (!from || !to) {
      setPathStatus('error');
      setPathError('Choose both courses.');
      setPathResponse(null);
      return;
    }

    setPathStatus('loading');
    setPathError(null);
    setPathResponse(null);

    try {
      const path = await getPath(from, to);
      setPathResponse(path);
      setPathStatus('success');

      if (path.reachable) {
        setSelectedCourseId(path.from);
        setDirection('dependents');
        setDepth(Math.min(6, Math.max(1, path.distance)));
      }
    } catch (error: unknown) {
      setPathStatus('error');
      setPathError(errorMessage(error, 'Unable to load the course path.'));
      setPathResponse(null);
    }
  };

  const useSelectedCourseAsPathStart = () => {
    if (selectedCourseId) {
      setPathFrom(selectedCourseId);
    }
  };

  const toggleThemeMode = () => {
    setThemeMode((current) => {
      const next: ThemeMode = current === 'light' ? 'dark' : 'light';

      try {
        window.localStorage.setItem(themeStorageKey, next);
      } catch {
        // Theme changes should still work for the current session if storage is unavailable.
      }

      return next;
    });
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
        <div className="top-actions">
          <div className="catalog-status" aria-label="Catalog status">
            <span>{catalogStatusText(courseStatus, filterSource.length)}</span>
            <span>{API_BASE_URL}</span>
          </div>
          <button
            aria-label={`Switch to ${nextThemeMode} mode`}
            aria-pressed={themeMode === 'dark'}
            className="theme-toggle"
            title={`Switch to ${nextThemeMode} mode`}
            type="button"
            onClick={toggleThemeMode}
          >
            {themeMode === 'light' ? <Moon aria-hidden="true" size={18} /> : <Sun aria-hidden="true" size={18} />}
          </button>
        </div>
      </header>

      <section className="workspace" aria-label="Course explorer workspace">
        <aside className="course-panel" aria-label="Course search and results">
          <div className="panel-toolbar">
            <form className="search-stack" onSubmit={submitCourseSearch}>
              <label className="search-field">
                <Search aria-hidden="true" size={18} />
                <span className="sr-only">Search courses</span>
                <input
                  autoComplete="off"
                  list="course-suggestions"
                  type="search"
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder="Search by course, title, subject, or department"
                />
              </label>
              <button className="search-submit" type="submit">
                Search
              </button>
            </form>

            <label className="subject-filter">
              <Filter aria-hidden="true" size={17} />
              <span className="sr-only">Subject filter</span>
              <select autoComplete="off" value={subject} onChange={(event) => setSubject(event.target.value)}>
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
              <details className="college-menu">
                <summary>
                  <span>{selectedCollegeLabel}</span>
                  <ChevronDown aria-hidden="true" size={16} />
                </summary>
                <div className="college-menu-panel">
                  <button
                    className={selectedColleges.length === 0 ? 'is-active' : ''}
                    type="button"
                    onClick={() => setSelectedColleges([])}
                  >
                    All colleges
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
              </details>
            </fieldset>
          </div>

          <CourseSearch
            courses={displayedCourses}
            totalCount={visibleCourses.length}
            error={courseError}
            loading={courseStatus === 'loading'}
            selectedCourseId={selectedCourseId}
            open={resultsOpen}
            onClose={() => setResultsOpen(false)}
            onRetry={() => setCourseReloadKey((value) => value + 1)}
            onSelectCourse={selectCourse}
          />

          <form className="path-finder" onSubmit={submitPathSearch}>
            <div className="path-heading">
              <Route aria-hidden="true" size={17} />
              <span>Path</span>
            </div>
            <label>
              <span>From</span>
              <input
                autoComplete="off"
                aria-describedby={pathFromHint ? 'path-from-hint' : undefined}
                list="path-from-suggestions"
                value={pathFrom}
                onChange={(event) => setPathFrom(event.target.value)}
              />
              {pathFromHint ? <small className="path-hint" id="path-from-hint">{pathFromHint}</small> : null}
            </label>
            <label>
              <span>To</span>
              <input
                autoComplete="off"
                aria-describedby={pathToHint ? 'path-to-hint' : undefined}
                list="path-to-suggestions"
                value={pathTo}
                onChange={(event) => setPathTo(event.target.value)}
              />
              {pathToHint ? <small className="path-hint" id="path-to-hint">{pathToHint}</small> : null}
            </label>
            <div className="path-actions">
              <button type="button" onClick={useSelectedCourseAsPathStart}>
                Use selected
              </button>
              <button disabled={pathStatus === 'loading'} type="submit">
                Route
              </button>
            </div>
            <PathResult
              response={pathResponse}
              error={pathError}
              loading={pathStatus === 'loading'}
              onSelectCourse={selectCourse}
            />
          </form>

          <datalist id="course-suggestions">
            {courseSuggestions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </datalist>
          <datalist id="path-from-suggestions">
            {pathFromSuggestions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </datalist>
          <datalist id="path-to-suggestions">
            {pathToSuggestions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </datalist>
        </aside>

        <section
          className={`graph-panel ${isFullscreen || fullscreenFallback ? 'is-fullscreen' : ''}`}
          ref={graphPanelRef}
          aria-label="Prerequisite graph"
        >
          <ExplorerControls
            depth={depth}
            direction={direction}
            graphEdgeCount={filteredGraph.edges.length}
            graphNodeCount={filteredGraph.nodes.length}
            isFullscreen={isFullscreen || fullscreenFallback}
            layoutMode={layoutMode}
            onDepthChange={setDepth}
            onDirectionChange={setDirection}
            onFit={() => runGraphCommand('fit')}
            onLayoutModeChange={setLayoutMode}
            onReset={() => runGraphCommand('reset')}
            onToggleFullscreen={toggleFullscreen}
            onZoomIn={() => runGraphCommand('zoom-in')}
            onZoomOut={() => runGraphCommand('zoom-out')}
          />
          <GraphExplorer
            command={graphCommand}
            completedCourseIds={completedCourseIds}
            currentCourseIds={currentCourseIds}
            error={graphError}
            graph={filteredGraph}
            layoutMode={layoutMode}
            loading={graphStatus === 'loading'}
            onRetry={() => setGraphReloadKey((value) => value + 1)}
            onSelectCourse={selectCourse}
            plannedCourseIds={plannedCourseIds}
            theme={graphTheme}
          />
        </section>

        <section className="right-rail" aria-label="Course detail">
          <CourseDetail
            course={selectedCourse}
            dependentResponse={dependentResponse}
            error={detailError}
            loading={detailStatus === 'loading'}
            prerequisiteResponse={prerequisiteResponse}
            onRetry={() => setDetailReloadKey((value) => value + 1)}
            onSelectCourse={selectCourse}
          />
        </section>
      </section>

      <section className="advisor-todo-section" aria-label="TODO unofficial planning helper">
        <div className="todo-heading">
          <span className="todo-badge">TODO</span>
          <div>
            <p className="detail-kicker">Frontend follow-up</p>
            <h2>Unofficial helper</h2>
          </div>
        </div>
        {/* TODO(frontend): Keep this helper below the explorer until the advising workflow is promoted into the primary UI. */}
        <AdvisorPanel
          course={selectedCourse}
          courseCatalog={filterSource}
          dependentResponse={dependentResponse}
          prerequisiteResponse={prerequisiteResponse}
          profile={studentProfile}
          onProfileChange={setStudentProfile}
          onSelectCourse={setSelectedCourseId}
        />
      </section>
    </main>
  );
}

interface PathResultProps {
  response: PathResponse | null;
  error: string | null;
  loading: boolean;
  onSelectCourse: (courseId: string) => void;
}

function PathResult({ response, error, loading, onSelectCourse }: PathResultProps) {
  if (loading) {
    return <p className="path-result">Loading path...</p>;
  }

  if (error) {
    return <p className="path-result is-error">{error}</p>;
  }

  if (!response) {
    return <p className="path-result">No path loaded.</p>;
  }

  if (!response.reachable) {
    return (
      <p className="path-result">
        No dependent path from {response.from} to {response.to}.
      </p>
    );
  }

  return (
    <div className="path-result is-success" aria-label="Shortest dependent path">
      <span>{response.distance} steps</span>
      <div className="path-chain">
        {response.courseIds.map((courseId, index) => (
          <button key={`${courseId}-${index}`} type="button" onClick={() => onSelectCourse(courseId)}>
            {courseId}
          </button>
        ))}
      </div>
    </div>
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

      return [course.id, course.name, course.description, course.subject, course.department, course.college]
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

function courseIdsFromGraph(graph: GraphResponse, rootCourseId: string): Set<string> {
  return new Set(
    graph.nodes
      .filter((node) => !node.external && node.id !== rootCourseId)
      .map((node) => node.id),
  );
}

function coursesFromIds(
  courseIds: Set<string>,
  courseById: Map<string, CourseSummary>,
  limit: number,
): CourseSummary[] {
  return Array.from(courseIds)
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is CourseSummary => Boolean(course))
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }))
    .slice(0, limit);
}

interface PathSuggestionHintParams {
  candidateCount: number;
  emptyText: string;
  error: string | null;
  loadingText: string;
  selectedEndpointId: string | null;
  status: LoadStatus;
}

function pathSuggestionHint({
  candidateCount,
  emptyText,
  error,
  loadingText,
  selectedEndpointId,
  status,
}: PathSuggestionHintParams): string | null {
  if (!selectedEndpointId) {
    return null;
  }

  if (status === 'loading') {
    return loadingText;
  }

  if (status === 'error') {
    return error;
  }

  if (status === 'success' && candidateCount === 0) {
    return emptyText;
  }

  return null;
}

function subjectFromId(courseId: string): string {
  return courseId.split(' ')[0] || courseId;
}

function normalizeCourseInput(value: string): string {
  return value.trim().split(/\s+/).join(' ').toUpperCase();
}

function loadThemeMode(): ThemeMode {
  try {
    const storedThemeMode = window.localStorage.getItem(themeStorageKey);
    return storedThemeMode === 'dark' || storedThemeMode === 'light' ? storedThemeMode : 'light';
  } catch {
    return 'light';
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return `Backend API unavailable at ${API_BASE_URL}.`;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export default App;
