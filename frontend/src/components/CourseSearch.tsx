import { useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { Search } from 'lucide-react';
import type { CourseSummary } from '../types';

interface CourseSearchProps {
  courses: CourseSummary[];
  totalCount: number;
  error: string | null;
  loading: boolean;
  selectedCourseId: string | null;
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSelectCourse: (courseId: string) => void;
}

function CourseSearch({
  courses,
  totalCount,
  error,
  loading,
  selectedCourseId,
  open,
  onClose,
  onRetry,
  onSelectCourse,
}: CourseSearchProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const matchLabel = totalCount === 1 ? 'match' : 'matches';
  const statusLabel = error
    ? 'Needs attention'
    : loading && courses.length === 0
      ? 'Loading'
      : totalCount === 0
        ? 'No matches'
        : `${totalCount} ${matchLabel}`;
  const previewCourses = courses.slice(0, 4);

  useEffect(() => {
    const panel = panelRef.current;

    if (!panel || !open || typeof window === 'undefined') {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const panelAnimation = animate(panel, {
      opacity: [0, 1],
      translateY: [-6, 0],
      duration: 220,
      ease: 'outCubic',
    });
    const resultAnimation = animate(panel.querySelectorAll('.course-result'), {
      opacity: [0, 1],
      translateX: [-8, 0],
      duration: 180,
      delay: stagger(14, { start: 70 }),
      ease: 'outCubic',
    });

    return () => {
      panelAnimation.cancel();
      resultAnimation.cancel();
    };
  }, [open, totalCount]);

  return (
    <section className={`course-results ${open ? 'is-open' : ''}`} aria-live="polite" aria-label="Course search results">
      {!open ? (
        <div className="results-summary">
          <span className={`matches-badge ${error ? 'is-error' : ''}`}>{statusLabel}</span>
          {previewCourses.length > 0 ? (
          <div className="preview-stack" aria-label="Search preview matches">
            {previewCourses.map((course) => (
              <button
                className={`preview-result ${course.id === selectedCourseId ? 'is-selected' : ''}`}
                key={course.id}
                type="button"
                onClick={() => onSelectCourse(course.id)}
              >
                <span>{course.id}</span>
                <small>{course.name}</small>
              </button>
            ))}
          </div>
          ) : null}
        </div>
      ) : null}

      <div className="results-panel" ref={panelRef} hidden={!open}>
        <div className="result-panel-heading">
          <Search aria-hidden="true" size={16} />
          <div className="result-count">
            <span>{totalCount}</span>
            <span>{matchLabel}</span>
            {courses.length < totalCount ? <span>showing {courses.length}</span> : null}
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
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
    </section>
  );
}

function formatCredits(credits: number | null): string {
  return credits === null ? 'Var' : String(credits);
}

export default CourseSearch;
