import type {
  CourseDetail,
  CourseRelationshipResponse,
  PrerequisiteGroup,
  StudentCourseRecord,
  StudentCourseStatus,
  StudentProfile,
} from '../types';

export const emptyStudentProfile: StudentProfile = {
  catalogYear: '2025-2026',
  courses: [],
  targetProgramId: '',
};

const coursePattern = /\b([A-Z]{2,}(?:\s*W)?)\s*[- ]?\s*(\d{1,3}[A-Z]{0,3})\b/g;
const localStorageKey = 'requisite-visualization.student-profile.v1';

export interface ParsedCourseRecord {
  courseId: string;
  term?: string;
  grade?: string;
}

export interface GroupEvaluation {
  group: PrerequisiteGroup;
  status: 'satisfied' | 'in_progress' | 'planned' | 'missing';
  satisfiedCourseIds: string[];
  missingCourseIds: string[];
}

export interface CourseReadiness {
  status: 'completed' | 'ready' | 'in_progress' | 'planned' | 'blocked' | 'unknown';
  groups: GroupEvaluation[];
  missingCourseIds: string[];
}

export function loadStudentProfile(): StudentProfile {
  try {
    const raw = window.localStorage.getItem(localStorageKey);
    if (!raw) {
      return emptyStudentProfile;
    }

    return normalizeProfile(JSON.parse(raw) as Partial<StudentProfile>);
  } catch {
    return emptyStudentProfile;
  }
}

export function saveStudentProfile(profile: StudentProfile) {
  window.localStorage.setItem(localStorageKey, JSON.stringify(normalizeProfile(profile)));
}

export function normalizeCourseId(value: string): string {
  return value.trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' ').toUpperCase();
}

export function parseCourseHistoryText(value: string): ParsedCourseRecord[] {
  const records = new Map<string, ParsedCourseRecord>();
  const lines = value.split(/\r?\n/);

  lines.forEach((line) => {
    let match: RegExpExecArray | null;
    coursePattern.lastIndex = 0;

    while ((match = coursePattern.exec(line)) !== null) {
      const courseId = normalizeCourseId(`${match[1]} ${match[2]}`);
      if (!records.has(courseId)) {
        records.set(courseId, {
          courseId,
          grade: extractGrade(line),
          term: extractTerm(line),
        });
      }
    }
  });

  return Array.from(records.values()).sort((left, right) =>
    left.courseId.localeCompare(right.courseId, undefined, { numeric: true }),
  );
}

export function upsertCourseRecord(
  profile: StudentProfile,
  courseId: string,
  status: StudentCourseStatus,
  source: StudentCourseRecord['source'] = 'manual',
): StudentProfile {
  const normalizedId = normalizeCourseId(courseId);
  if (!normalizedId) {
    return profile;
  }

  const existing = profile.courses.find((course) => course.courseId === normalizedId);
  const courses = existing
    ? profile.courses.map((course) => (course.courseId === normalizedId ? { ...course, source, status } : course))
    : [...profile.courses, { courseId: normalizedId, source, status }];

  return normalizeProfile({ ...profile, courses });
}

export function removeCourseRecord(profile: StudentProfile, courseId: string): StudentProfile {
  return normalizeProfile({
    ...profile,
    courses: profile.courses.filter((course) => course.courseId !== courseId),
  });
}

export function courseStatusMap(profile: StudentProfile): Map<string, StudentCourseStatus> {
  return new Map(profile.courses.map((course) => [course.courseId, course.status]));
}

export function courseIdsForStatus(profile: StudentProfile, status: StudentCourseStatus): Set<string> {
  return new Set(profile.courses.filter((course) => course.status === status).map((course) => course.courseId));
}

export function evaluateCourseReadiness(
  course: CourseDetail | null,
  prerequisites: CourseRelationshipResponse | null,
  profile: StudentProfile,
): CourseReadiness {
  if (!course) {
    return { groups: [], missingCourseIds: [], status: 'unknown' };
  }

  const statuses = courseStatusMap(profile);
  const selectedStatus = statuses.get(course.id);
  if (selectedStatus === 'completed') {
    return { groups: [], missingCourseIds: [], status: 'completed' };
  }

  const groups = (prerequisites?.groups ?? course.prerequisiteGroups).map((group) => evaluateGroup(group, statuses));
  const missingCourseIds = Array.from(new Set(groups.flatMap((group) => group.missingCourseIds))).sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );

  if (selectedStatus === 'current') {
    return { groups, missingCourseIds, status: 'in_progress' };
  }

  if (selectedStatus === 'planned') {
    return { groups, missingCourseIds, status: 'planned' };
  }

  if (groups.length === 0 || groups.every((group) => group.status === 'satisfied')) {
    return { groups, missingCourseIds, status: 'ready' };
  }

  return { groups, missingCourseIds, status: 'blocked' };
}

function evaluateGroup(group: PrerequisiteGroup, statuses: Map<string, StudentCourseStatus>): GroupEvaluation {
  const completed = group.options.filter((option) => statuses.get(option.courseId) === 'completed').map((option) => option.courseId);
  const current = group.options.filter((option) => statuses.get(option.courseId) === 'current').map((option) => option.courseId);
  const planned = group.options.filter((option) => statuses.get(option.courseId) === 'planned').map((option) => option.courseId);

  if (group.type === 'all') {
    const missing = group.options
      .filter((option) => !option.external && statuses.get(option.courseId) !== 'completed')
      .map((option) => option.courseId);

    if (missing.length === 0) {
      return { group, missingCourseIds: [], satisfiedCourseIds: completed, status: 'satisfied' };
    }

    if (current.length > 0) {
      return { group, missingCourseIds: missing, satisfiedCourseIds: completed, status: 'in_progress' };
    }

    if (planned.length > 0) {
      return { group, missingCourseIds: missing, satisfiedCourseIds: completed, status: 'planned' };
    }

    return { group, missingCourseIds: missing, satisfiedCourseIds: completed, status: 'missing' };
  }

  if (completed.length > 0) {
    return { group, missingCourseIds: [], satisfiedCourseIds: completed, status: 'satisfied' };
  }

  const missing = group.options.filter((option) => !option.external).map((option) => option.courseId);
  if (current.length > 0) {
    return { group, missingCourseIds: missing, satisfiedCourseIds: current, status: 'in_progress' };
  }

  if (planned.length > 0) {
    return { group, missingCourseIds: missing, satisfiedCourseIds: planned, status: 'planned' };
  }

  return { group, missingCourseIds: missing, satisfiedCourseIds: [], status: 'missing' };
}

function normalizeProfile(profile: Partial<StudentProfile>): StudentProfile {
  const courses = Array.isArray(profile.courses) ? profile.courses : [];

  return {
    catalogYear: profile.catalogYear || emptyStudentProfile.catalogYear,
    courses: courses
      .map(normalizeRecord)
      .filter((record): record is StudentCourseRecord => record !== null)
      .sort((left, right) => left.courseId.localeCompare(right.courseId, undefined, { numeric: true })),
    targetProgramId: profile.targetProgramId || '',
  };
}

function normalizeRecord(value: Partial<StudentCourseRecord>): StudentCourseRecord | null {
  const courseId = normalizeCourseId(value.courseId || '');
  if (!courseId) {
    return null;
  }

  const status = value.status === 'current' || value.status === 'planned' ? value.status : 'completed';
  return {
    courseId,
    grade: value.grade,
    source: value.source === 'paste' ? 'paste' : 'manual',
    status,
    term: value.term,
  };
}

function extractGrade(line: string): string | undefined {
  const match = line.match(/\b([ABCDF][+-]?|P|NP|S|U)\b/);
  return match?.[1];
}

function extractTerm(line: string): string | undefined {
  const match = line.match(/\b(Fall|Winter|Spring|Summer)\s+20\d{2}\b/i);
  return match?.[0];
}
