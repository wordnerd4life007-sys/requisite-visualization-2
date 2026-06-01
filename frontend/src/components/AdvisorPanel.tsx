import { type FormEvent, useMemo, useState } from 'react';
import { Bot, CheckCircle2, CircleDashed, ClipboardList, Import, Lock, Trash2 } from 'lucide-react';
import type {
  CourseDetail,
  CourseRelationshipResponse,
  CourseSummary,
  StudentCourseStatus,
  StudentProfile,
} from '../types';
import {
  courseStatusMap,
  evaluateCourseReadiness,
  parseCourseHistoryText,
  removeCourseRecord,
  upsertCourseRecord,
} from '../utils/advisor';

interface AdvisorPanelProps {
  course: CourseDetail | null;
  courseCatalog: CourseSummary[];
  dependentResponse: CourseRelationshipResponse | null;
  prerequisiteResponse: CourseRelationshipResponse | null;
  profile: StudentProfile;
  onProfileChange: (profile: StudentProfile) => void;
  onSelectCourse: (courseId: string) => void;
}

function AdvisorPanel({
  course,
  courseCatalog,
  dependentResponse,
  prerequisiteResponse,
  profile,
  onProfileChange,
  onSelectCourse,
}: AdvisorPanelProps) {
  const [manualCourseId, setManualCourseId] = useState('');
  const [manualStatus, setManualStatus] = useState<StudentCourseStatus>('completed');
  const [pasteValue, setPasteValue] = useState('');
  const readiness = useMemo(
    () => evaluateCourseReadiness(course, prerequisiteResponse, profile),
    [course, prerequisiteResponse, profile],
  );
  const knownCourseIds = useMemo(() => new Set(courseCatalog.map((item) => item.id)), [courseCatalog]);
  const statuses = useMemo(() => courseStatusMap(profile), [profile]);
  const parsedRecords = useMemo(() => parseCourseHistoryText(pasteValue), [pasteValue]);
  const dependentCount = dependentResponse?.flattenedCourseIds.length ?? 0;

  const submitManualCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onProfileChange(upsertCourseRecord(profile, manualCourseId, manualStatus));
    setManualCourseId('');
  };

  const importParsedCourses = () => {
    const nextProfile = parsedRecords.reduce(
      (current, record) => upsertCourseRecord(current, record.courseId, 'completed', 'paste'),
      profile,
    );
    onProfileChange(nextProfile);
    setPasteValue('');
  };

  const clearProfile = () => {
    onProfileChange({
      ...profile,
      courses: [],
    });
  };

  return (
    <aside className="advisor-panel" aria-label="Course planning helper">
      <div className="advisor-heading">
        <Bot aria-hidden="true" size={19} />
        <div>
          <p className="detail-kicker">Unofficial helper</p>
          <h2>Planning Assistant</h2>
        </div>
      </div>

      <p className="advisor-note">
        Local-only course history. Use this to explore prerequisites, not as official UCSB advising.
      </p>

      <section className="advisor-section">
        <div className="advisor-status-row">
          <ReadinessBadge status={readiness.status} />
          <span>{readinessSummary(readiness.status, course?.id)}</span>
        </div>
        {readiness.missingCourseIds.length > 0 ? (
          <div className="advisor-chip-list" aria-label="Missing prerequisite courses">
            {readiness.missingCourseIds.slice(0, 12).map((courseId) => (
              <button key={courseId} type="button" onClick={() => onSelectCourse(courseId)}>
                {courseId}
              </button>
            ))}
          </div>
        ) : null}
        <p className="advisor-metric">
          {course?.id ?? 'Selected course'} has {dependentCount} dependent course{dependentCount === 1 ? '' : 's'} in the loaded graph data.
        </p>
      </section>

      <form className="advisor-add-form" onSubmit={submitManualCourse}>
        <label>
          <span>Add course</span>
          <input
            autoComplete="off"
            list="course-suggestions"
            placeholder="CMPSC 16"
            value={manualCourseId}
            onChange={(event) => setManualCourseId(event.target.value)}
          />
        </label>
        <label>
          <span>Status</span>
          <select value={manualStatus} onChange={(event) => setManualStatus(event.target.value as StudentCourseStatus)}>
            <option value="completed">Completed</option>
            <option value="current">Current</option>
            <option value="planned">Planned</option>
          </select>
        </label>
        <button type="submit">Add</button>
      </form>

      <section className="advisor-import">
        <label>
          <span>
            <Import aria-hidden="true" size={14} />
            Paste transcript text
          </span>
          <textarea
            placeholder="Paste an unofficial transcript or course history. Review detected courses before importing."
            value={pasteValue}
            onChange={(event) => setPasteValue(event.target.value)}
          />
        </label>
        <div className="advisor-import-actions">
          <span>{parsedRecords.length} detected</span>
          <button disabled={parsedRecords.length === 0} type="button" onClick={importParsedCourses}>
            Import as completed
          </button>
        </div>
      </section>

      <section className="advisor-course-list">
        <div className="advisor-list-heading">
          <ClipboardList aria-hidden="true" size={16} />
          <span>{profile.courses.length} tracked courses</span>
          {profile.courses.length > 0 ? (
            <button aria-label="Clear tracked courses" type="button" onClick={clearProfile}>
              <Trash2 aria-hidden="true" size={14} />
            </button>
          ) : null}
        </div>
        {profile.courses.length === 0 ? (
          <p className="empty-state">Add completed, current, or planned courses to see readiness hints.</p>
        ) : (
          <div className="advisor-records">
            {profile.courses.map((record) => (
              <div className="advisor-record" key={record.courseId}>
                <button type="button" onClick={() => onSelectCourse(record.courseId)}>
                  {record.courseId}
                </button>
                <span className={`advisor-status ${record.status}`}>{record.status}</span>
                {!knownCourseIds.has(record.courseId) ? <span className="advisor-warning">unmatched</span> : null}
                <button
                  aria-label={`Remove ${record.courseId}`}
                  type="button"
                  onClick={() => onProfileChange(removeCourseRecord(profile, record.courseId))}
                >
                  <Trash2 aria-hidden="true" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="advisor-section">
        <div className="advisor-list-heading">
          <Lock aria-hidden="true" size={15} />
          <span>Advisor scope</span>
        </div>
        <p className="advisor-note">
          Degree requirements and official GOLD progress data are not connected yet. This assistant only evaluates selected-course prerequisites against courses you enter here.
        </p>
      </section>
    </aside>
  );
}

function ReadinessBadge({ status }: { status: ReturnType<typeof evaluateCourseReadiness>['status'] }) {
  const Icon = status === 'ready' || status === 'completed' ? CheckCircle2 : CircleDashed;
  return (
    <span className={`readiness-badge ${status}`}>
      <Icon aria-hidden="true" size={15} />
    </span>
  );
}

function readinessSummary(status: ReturnType<typeof evaluateCourseReadiness>['status'], courseId?: string): string {
  const label = courseId ?? 'This course';

  if (status === 'completed') {
    return `${label} is marked completed.`;
  }
  if (status === 'ready') {
    return `${label} appears ready based on listed prerequisites.`;
  }
  if (status === 'in_progress') {
    return `${label} is marked current.`;
  }
  if (status === 'planned') {
    return `${label} is marked planned.`;
  }
  if (status === 'blocked') {
    return `${label} still has missing prerequisite groups.`;
  }
  return 'Select a course to evaluate readiness.';
}

export default AdvisorPanel;
