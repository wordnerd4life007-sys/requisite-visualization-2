import type {
  ApiErrorBody,
  CourseDetail,
  CourseRelationshipResponse,
  CourseSummary,
  GraphDirection,
  PathResponse,
  PrerequisiteGroupType,
  GraphResponse,
} from '../types';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? DEFAULT_API_BASE_URL;

type QueryParamValue = string | number | string[] | undefined;

interface CourseListParams extends Record<string, QueryParamValue> {
  q?: string;
  subject?: string;
  colleges?: string[];
  limit?: number;
}

interface GraphParams {
  course: string;
  direction: GraphDirection;
  depth: number;
  subject?: string;
  colleges?: string[];
}

interface ApiPrerequisiteOption {
  courseId?: unknown;
  external?: unknown;
}

interface ApiPrerequisiteGroup {
  groupType?: unknown;
  groupIndex?: unknown;
  options?: unknown;
}

interface ApiCourseDetail extends CourseSummary {
  prerequisiteGroups?: unknown;
}

interface ApiPrerequisiteResponse {
  courseId?: unknown;
  groups?: unknown;
  flattenedCourseIds?: unknown;
}

interface ApiDependentRelationship {
  courseId?: unknown;
  groupType?: unknown;
  groupIndex?: unknown;
  external?: unknown;
}

interface ApiDependentResponse {
  courseId?: unknown;
  relationships?: unknown;
  flattenedCourseIds?: unknown;
}

interface ApiPathResponse {
  from?: unknown;
  to?: unknown;
  reachable?: unknown;
  distance?: unknown;
  courseIds?: unknown;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export async function listCourses(params: CourseListParams = {}, signal?: AbortSignal): Promise<CourseSummary[]> {
  const payload = await fetchJson<unknown>('/courses', params, signal);
  const courses = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.courses)
      ? payload.courses
      : null;

  if (!courses) {
    throw new ApiError('Unexpected course list response.', 'invalid_response', 0);
  }

  return courses.map(normalizeCourseSummary);
}

export async function getCourse(courseId: string, signal?: AbortSignal): Promise<CourseDetail> {
  return normalizeCourseDetail(await fetchJson<ApiCourseDetail>(`/courses/${encodeURIComponent(courseId)}`, {}, signal));
}

export async function getPrerequisites(
  courseId: string,
  signal?: AbortSignal,
): Promise<CourseRelationshipResponse> {
  return normalizePrerequisiteResponse(
    await fetchJson<ApiPrerequisiteResponse>(`/courses/${encodeURIComponent(courseId)}/prerequisites`, {}, signal),
  );
}

export async function getDependents(courseId: string, signal?: AbortSignal): Promise<CourseRelationshipResponse> {
  return normalizeDependentResponse(
    await fetchJson<ApiDependentResponse>(`/courses/${encodeURIComponent(courseId)}/dependents`, {}, signal),
  );
}

export async function getGraph(params: GraphParams, signal?: AbortSignal): Promise<GraphResponse> {
  return fetchJson<GraphResponse>(
    '/graph',
    {
      course: params.course,
      direction: params.direction,
      depth: params.depth,
      subject: params.subject,
      colleges: params.colleges,
    },
    signal,
  );
}

export async function getPath(from: string, to: string, signal?: AbortSignal): Promise<PathResponse> {
  return normalizePathResponse(
    await fetchJson<ApiPathResponse>(
      '/paths',
      {
        from: normalizeCourseIdInput(from),
        to: normalizeCourseIdInput(to),
      },
      signal,
    ),
  );
}

async function fetchJson<T>(
  path: string,
  params: Record<string, QueryParamValue>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(path, `${API_BASE_URL}/`);

  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        url.searchParams.set(key, value.join(','));
      }
    } else if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const apiError = toApiError(payload);
    throw new ApiError(apiError.message, apiError.code, response.status);
  }

  return payload as T;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('API returned invalid JSON.', 'invalid_json', response.status);
  }
}

function toApiError(payload: unknown): { code: string; message: string } {
  if (isApiErrorBody(payload)) {
    return payload.error;
  }

  return {
    code: 'request_failed',
    message: 'API request failed.',
  };
}

function isApiErrorBody(payload: unknown): payload is ApiErrorBody {
  return (
    isObject(payload) &&
    isObject(payload.error) &&
    typeof payload.error.code === 'string' &&
    typeof payload.error.message === 'string'
  );
}

function normalizeCourseDetail(course: ApiCourseDetail): CourseDetail {
  return {
    ...normalizeCourseSummary(course),
    prerequisiteGroups: normalizeGroups(course.prerequisiteGroups),
  };
}

function normalizeCourseSummary(course: CourseSummary): CourseSummary {
  return {
    id: course.id,
    name: course.name,
    description: typeof course.description === 'string' ? course.description : undefined,
    credits: course.credits ?? null,
    college: course.college,
    department: course.department ?? null,
    subject: course.subject || course.id.split(' ')[0] || course.id,
  };
}

function normalizePrerequisiteResponse(response: ApiPrerequisiteResponse): CourseRelationshipResponse {
  const courseId = typeof response.courseId === 'string' ? response.courseId : '';

  return {
    courseId,
    groups: normalizeGroups(response.groups),
    flattenedCourseIds: normalizeStringArray(response.flattenedCourseIds),
  };
}

function normalizeDependentResponse(response: ApiDependentResponse): CourseRelationshipResponse {
  const courseId = typeof response.courseId === 'string' ? response.courseId : '';
  const relationships = Array.isArray(response.relationships) ? response.relationships : [];

  return {
    courseId,
    groups: relationships.map((relationship, index) => normalizeDependentRelationship(relationship, index)),
    flattenedCourseIds: normalizeStringArray(response.flattenedCourseIds),
  };
}

function normalizePathResponse(response: ApiPathResponse): PathResponse {
  if (typeof response.from !== 'string' || typeof response.to !== 'string') {
    throw new ApiError('Unexpected path response.', 'invalid_response', 0);
  }

  const distance = typeof response.distance === 'number' && Number.isFinite(response.distance)
    ? response.distance
    : -1;

  return {
    from: response.from,
    to: response.to,
    reachable: Boolean(response.reachable),
    distance,
    courseIds: normalizeStringArray(response.courseIds),
  };
}

function normalizeGroups(value: unknown): CourseRelationshipResponse['groups'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((group, index) => normalizeGroup(group, index));
}

function normalizeGroup(value: unknown, index: number): CourseRelationshipResponse['groups'][number] {
  if (!isObject(value)) {
    throw new ApiError('Unexpected relationship group response.', 'invalid_response', 0);
  }

  const group = value as ApiPrerequisiteGroup;

  return {
    type: normalizeGroupType(group.groupType),
    groupIndex: normalizeGroupIndex(group.groupIndex, index),
    options: normalizeOptions(group.options),
  };
}

function normalizeOptions(value: unknown): CourseRelationshipResponse['groups'][number]['options'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((option) => {
    if (!isObject(option)) {
      throw new ApiError('Unexpected relationship option response.', 'invalid_response', 0);
    }

    const apiOption = option as ApiPrerequisiteOption;

    if (typeof apiOption.courseId !== 'string') {
      throw new ApiError('Unexpected relationship option response.', 'invalid_response', 0);
    }

    return {
      courseId: apiOption.courseId,
      external: Boolean(apiOption.external),
    };
  });
}

function normalizeDependentRelationship(value: unknown, index: number): CourseRelationshipResponse['groups'][number] {
  if (!isObject(value)) {
    throw new ApiError('Unexpected dependent relationship response.', 'invalid_response', 0);
  }

  const relationship = value as ApiDependentRelationship;

  if (typeof relationship.courseId !== 'string') {
    throw new ApiError('Unexpected dependent relationship response.', 'invalid_response', 0);
  }

  return {
    type: normalizeGroupType(relationship.groupType),
    groupIndex: normalizeGroupIndex(relationship.groupIndex, index),
    options: [
      {
        courseId: relationship.courseId,
        external: Boolean(relationship.external),
      },
    ],
  };
}

function normalizeGroupType(value: unknown): PrerequisiteGroupType {
  if (value === 'all' || value === 'any') {
    return value;
  }

  throw new ApiError('Unexpected relationship group type.', 'invalid_response', 0);
}

function normalizeGroupIndex(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeCourseIdInput(value: string): string {
  return value.trim().split(/\s+/).join(' ');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
