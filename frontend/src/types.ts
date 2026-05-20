export type PrerequisiteGroupType = 'all' | 'any';
export type GraphDirection = 'prerequisites' | 'dependents' | 'both';

export interface CourseSummary {
  id: string;
  name: string;
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
