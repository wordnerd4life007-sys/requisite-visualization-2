export type PrerequisiteGroupType = 'all' | 'any';
export type GraphDirection = 'prerequisites' | 'dependents' | 'both';
export type GraphLayoutMode = 'structured' | 'organic';
export type StudentCourseStatus = 'completed' | 'current' | 'planned';
export type ThemeMode = 'light' | 'dark';

export interface GraphTheme {
  completedFill: string;
  currentFill: string;
  edge: string;
  groupColors: readonly string[];
  hoverBorder: string;
  nodeBorder: string;
  nodeFill: string;
  nodeText: string;
  nodeTextOutline: string;
  plannedFill: string;
  rootBorder: string;
}

export interface CourseSummary {
  id: string;
  name: string;
  description?: string;
  credits: number | null;
  college: string;
  department: string | null;
  subject: string;
}

export interface PrerequisiteOption {
  courseId: string;
  external: boolean;
}

export interface PrerequisiteGroup {
  type: PrerequisiteGroupType;
  groupIndex: number;
  options: PrerequisiteOption[];
}

export interface CourseDetail extends CourseSummary {
  prerequisiteGroups: PrerequisiteGroup[];
}

export interface CourseRelationshipResponse {
  courseId: string;
  groups: PrerequisiteGroup[];
  flattenedCourseIds: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  name?: string;
  external: boolean;
  college?: string;
  department?: string | null;
  subject?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship: 'prerequisite' | 'dependent';
  groupType: PrerequisiteGroupType;
  groupIndex: number;
  external?: boolean;
}

export interface GraphResponse {
  rootCourseId: string;
  direction: GraphDirection;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PathResponse {
  from: string;
  to: string;
  reachable: boolean;
  distance: number;
  courseIds: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type GraphCommandAction = 'fit' | 'zoom-in' | 'zoom-out' | 'reset';

export interface GraphCommand {
  action: GraphCommandAction;
  nonce: number;
}

export interface StudentCourseRecord {
  courseId: string;
  status: StudentCourseStatus;
  term?: string;
  grade?: string;
  source: 'manual' | 'paste';
}

export interface StudentProfile {
  targetProgramId: string;
  catalogYear: string;
  courses: StudentCourseRecord[];
}
