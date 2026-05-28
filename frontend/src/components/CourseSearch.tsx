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
  return (
    <div className="course-results" aria-live="polite">
      <div className="result-count">
        <span>{totalCount}</span>
        <span>{totalCount === 1 ? 'match' : 'matches'}</span>
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
  );
}

function formatCredits(credits: number | null): string {
  return credits === null ? 'Var' : String(credits);
}

export default CourseSearch;
