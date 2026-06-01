import { useId, useState } from 'react';
import { ChevronDown, ChevronUp, ListFilter } from 'lucide-react';
import type { CourseSummary } from '../types';

interface CourseSearchProps {
  courses: CourseSummary[];
  totalCount: number;
  error: string | null;
  loading: boolean;
  selectedCourseId: string | null;
  onRetry: () => void;
  onSelectCourse: (courseId: string) => void;
}

function CourseSearch({
  courses,
  totalCount,
  error,
  loading,
  selectedCourseId,
  onRetry,
  onSelectCourse,
}: CourseSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const resultsPanelId = useId();
  const ToggleIcon = expanded ? ChevronUp : ChevronDown;
  const matchLabel = totalCount === 1 ? 'match' : 'matches';
  const statusLabel = error
    ? 'Needs attention'
    : loading && courses.length === 0
      ? 'Loading'
      : totalCount === 0
        ? 'No matches'
        : `${totalCount} ${matchLabel}`;

  return (
    <div className={`course-results ${expanded ? 'is-expanded' : ''}`} aria-live="polite">
      <button
        aria-controls={resultsPanelId}
        aria-expanded={expanded}
        className="matches-toggle"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="matches-toggle-label">
          <ListFilter aria-hidden="true" size={17} />
          <span>Browse matches</span>
        </span>
        <span className={`matches-badge ${error ? 'is-error' : ''}`}>{statusLabel}</span>
        <ToggleIcon aria-hidden="true" className="matches-toggle-icon" size={17} />
      </button>

      <div className="results-panel" hidden={!expanded} id={resultsPanelId}>
        <div className="result-count">
          <span>{totalCount}</span>
          <span>{matchLabel}</span>
          {courses.length < totalCount ? <span>showing {courses.length}</span> : null}
        </div>

        {error ? (
          <div className="status-card is-error">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}

        {!error && loading && courses.length === 0 ? <div className="status-card">Loading courses...</div> : null}

        {!error && !loading && courses.length === 0 ? (
          <div className="status-card">No courses match the current filters.</div>
        ) : null}

        {courses.length > 0 ? (
          <div className="result-list">
            {courses.map((course) => (
              <button
                className={`course-result ${course.id === selectedCourseId ? 'is-selected' : ''}`}
                key={course.id}
                type="button"
                onClick={() => onSelectCourse(course.id)}
              >
                <span className="course-result-code">{course.id}</span>
                <span className="course-result-name">{course.name}</span>
                <span className="course-result-meta">
                  {formatCredits(course.credits)} units - {course.college}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatCredits(credits: number | null): string {
  return credits === null ? 'Var' : String(credits);
}

export default CourseSearch;
