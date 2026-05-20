import type { ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, HelpCircle } from 'lucide-react';
import type { CourseDetail as CourseDetailType, CourseRelationshipResponse } from '../types';

interface CourseDetailProps {
  course: CourseDetailType | null;
  dependentResponse: CourseRelationshipResponse | null;
  error: string | null;
  loading: boolean;
  prerequisiteResponse: CourseRelationshipResponse | null;
  onRetry: () => void;
  onSelectCourse: (courseId: string) => void;
}

function CourseDetail({
  course,
  dependentResponse,
  error,
  loading,
  prerequisiteResponse,
  onRetry,
  onSelectCourse,
}: CourseDetailProps) {
  return (
    <aside className="detail-panel" aria-label="Selected course detail">
      <div className="detail-heading">
        <BookOpen aria-hidden="true" size={20} />
        <div>
          <p className="detail-kicker">Selected course</p>
          <h2>{course?.id ?? 'No course selected'}</h2>
        </div>
      </div>

      {error ? (
        <div className="status-card is-error">
          <p>{error}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && loading && !course ? <div className="status-card">Loading course details...</div> : null}

      {!error && !loading && !course ? <div className="status-card">Select a course to inspect details.</div> : null}

      {course ? (
        <>
          <div className="detail-summary">
            <h3>{course.name}</h3>
            <dl>
              <div>
                <dt>Credits</dt>
                <dd>{course.credits ?? 'Variable'}</dd>
              </div>
              <div>
                <dt>College</dt>
                <dd>{course.college}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{course.subject}</dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{course.department ?? 'Not listed'}</dd>
              </div>
            </dl>
          </div>

          <RelationshipSection
            emptyText="No prerequisites found."
            icon={<ArrowDownToLine aria-hidden="true" size={18} />}
            response={prerequisiteResponse}
            title="Prerequisites"
            tooltipText="Each numbered group represents an alternative way to satisfy part of the prerequisite requirement. In most cases, completing one course or path from the listed group can satisfy that requirement for the selected course."
            onSelectCourse={onSelectCourse}
          />

          <RelationshipSection
            emptyText="No dependents found."
            icon={<ArrowUpFromLine aria-hidden="true" size={18} />}
            response={dependentResponse}
            title="Dependents"
            tooltipText="Dependents are courses that may require the selected course. Grouping shows how the selected course connects to later course options or requirement paths."
            onSelectCourse={onSelectCourse}
          />
        </>
      ) : null}
    </aside>
  );
}

interface RelationshipSectionProps {
  emptyText: string;
  icon: ReactNode;
  response: CourseRelationshipResponse | null;
  title: string;
  tooltipText: string;
  onSelectCourse: (courseId: string) => void;
}

function RelationshipSection({ emptyText, icon, response, title, tooltipText, onSelectCourse }: RelationshipSectionProps) {
  const groups = response?.groups ?? [];
  const tooltipId = `${title.toLowerCase()}-relationship-help`;

  return (
    <section className="relationship-section">
      <div className="section-title">
        {icon}
        <h3>{title}</h3>
        <span className="help-wrap">
          <button
            aria-describedby={tooltipId}
            aria-label={`${title} help`}
            className="help-trigger"
            type="button"
          >
            <HelpCircle aria-hidden="true" size={15} />
          </button>
          <span className="help-tooltip" id={tooltipId} role="tooltip">
            {tooltipText}
          </span>
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="empty-state">{emptyText}</p>
      ) : (
        <div className="group-stack">
          {groups.map((group, groupIndex) => (
            <div className="prereq-group" key={`${title}-${group.groupIndex}-${groupIndex}`}>
              <span
                aria-label={`${title} group ${groupIndex + 1}; ${group.type === 'all' ? 'required' : 'alternative'} relationship group`}
                className={`group-label ${group.type}`}
              >
                Group {groupIndex + 1}
              </span>
              <div className="option-row">
                {group.options.map((option, optionIndex) => (
                  <button
                    className="course-chip"
                    disabled={option.external}
                    key={`${title}-${groupIndex}-${optionIndex}-${option.courseId}`}
                    title={option.external ? 'External prerequisite' : `Select ${option.courseId}`}
                    type="button"
                    onClick={() => onSelectCourse(option.courseId)}
                  >
                    {option.courseId}
                    {option.external ? <span>External</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default CourseDetail;
