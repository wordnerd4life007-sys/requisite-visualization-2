import type {
  CourseDetail,
  CourseRelationshipResponse,
  GraphDirection,
  GraphEdge,
  GraphNode,
  GraphResponse,
  PrerequisiteGroup,
} from '../types';

type MockPrerequisiteGroup = Omit<PrerequisiteGroup, 'groupIndex'> & { groupIndex?: number };
type MockCourseDetail = Omit<CourseDetail, 'prerequisiteGroups'> & {
  prerequisiteGroups: MockPrerequisiteGroup[];
};

const courseFixtures: MockCourseDetail[] = [
  {
    id: 'CMPSC 8',
    name: 'Introduction to Computer Science',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'any',
        options: [
          { courseId: 'MATH 3A', external: true },
          { courseId: 'MATH 2A', external: true },
        ],
      },
    ],
  },
  {
    id: 'CMPSC 16',
    name: 'Problem Solving With Computers I',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'any',
        options: [
          { courseId: 'CMPSC 8', external: false },
          { courseId: 'ECE 15', external: false },
        ],
      },
    ],
  },
  {
    id: 'CMPSC 24',
    name: 'Problem Solving With Computers II',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 16', external: false }],
      },
    ],
  },
  {
    id: 'CMPSC 32',
    name: 'Object Oriented Design and Implementation',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 24', external: false }],
      },
    ],
  },
  {
    id: 'CMPSC 40',
    name: 'Foundations of Computer Science',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 16', external: false }],
      },
      {
        type: 'any',
        options: [
          { courseId: 'MATH 4A', external: true },
          { courseId: 'MATH 6A', external: true },
        ],
      },
    ],
  },
  {
    id: 'CMPSC 130A',
    name: 'Data Structures and Algorithms I',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [
          { courseId: 'CMPSC 24', external: false },
          { courseId: 'CMPSC 40', external: false },
        ],
      },
    ],
  },
  {
    id: 'CMPSC 138',
    name: 'Automata and Formal Languages',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 40', external: false }],
      },
    ],
  },
  {
    id: 'CMPSC 156',
    name: 'Advanced Applications Programming',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 32', external: false }],
      },
    ],
  },
  {
    id: 'CMPSC 165A',
    name: 'Artificial Intelligence',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 130A', external: false }],
      },
      {
        type: 'any',
        options: [
          { courseId: 'PSTAT 120A', external: true },
          { courseId: 'MATH 8', external: true },
        ],
      },
    ],
  },
  {
    id: 'CMPSC 189A',
    name: 'Capstone Project I',
    credits: 4,
    college: 'ENGR',
    department: 'Computer Science',
    subject: 'CMPSC',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'CMPSC 130A', external: false }],
      },
    ],
  },
  {
    id: 'ECE 15',
    name: 'Introduction to Computer Programming',
    credits: 4,
    college: 'ENGR',
    department: 'Electrical and Computer Engineering',
    subject: 'ECE',
    prerequisiteGroups: [
      {
        type: 'all',
        options: [{ courseId: 'MATH 3A', external: true }],
      },
    ],
  },
  {
    id: 'ECE 152A',
    name: 'Digital Design Principles',
    credits: 4,
    college: 'ENGR',
    department: 'Electrical and Computer Engineering',
    subject: 'ECE',
    prerequisiteGroups: [
      {
        type: 'any',
        options: [
          { courseId: 'CMPSC 16', external: false },
          { courseId: 'ECE 15', external: false },
        ],
      },
    ],
  },
];

export const courses: CourseDetail[] = courseFixtures.map((course) => ({
  ...course,
  prerequisiteGroups: course.prerequisiteGroups.map((group, groupIndex) => ({
    ...group,
    groupIndex: group.groupIndex ?? groupIndex,
  })),
}));

const courseById = new Map(courses.map((course) => [course.id, course]));

export function getSubjects(): string[] {
  return Array.from(new Set(courses.map((course) => course.id.split(' ')[0]))).sort();
}

export function getCourseById(courseId: string): CourseDetail | undefined {
  return courseById.get(courseId);
}

export function getCourseSubject(courseId: string): string {
  return courseId.split(' ')[0] ?? courseId;
}

export function filterCourses(query: string, subject: string): CourseDetail[] {
  const normalizedQuery = query.trim().toLowerCase();

  return courses
    .filter((course) => subject === 'all' || getCourseSubject(course.id) === subject)
    .filter((course) => {
      if (!normalizedQuery) {
        return true;
      }

      return `${course.id} ${course.name}`.toLowerCase().includes(normalizedQuery);
    })
    .sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}

export function getPrerequisites(courseId: string): CourseRelationshipResponse {
  const course = getCourseById(courseId);
  const groups = course?.prerequisiteGroups ?? [];

  return {
    courseId,
    groups,
    flattenedCourseIds: flattenGroups(groups),
  };
}

export function getDependents(courseId: string): CourseRelationshipResponse {
  const groups: PrerequisiteGroup[] = [];

  for (const course of courses) {
    course.prerequisiteGroups.forEach((group) => {
      const matchingOptions = group.options.filter((option) => option.courseId === courseId);

      if (matchingOptions.length > 0) {
        groups.push({
          type: group.type,
          groupIndex: group.groupIndex,
          options: [{ courseId: course.id, external: false }],
        });
      }
    });
  }

  return {
    courseId,
    groups,
    flattenedCourseIds: flattenGroups(groups),
  };
}

export function buildGraphResponse(
  rootCourseId: string,
  direction: GraphDirection,
  depth: number,
  subject: string,
): GraphResponse {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphEdge>();
  const visitedPrerequisites = new Set<string>();
  const visitedDependents = new Set<string>();

  const includeBySubject = (courseId: string) => {
    if (subject === 'all' || !courseById.has(courseId)) {
      return true;
    }

    return getCourseSubject(courseId) === subject || courseId === rootCourseId;
  };

  const addNode = (courseId: string, external: boolean) => {
    if (!includeBySubject(courseId)) {
      return;
    }

    const course = getCourseById(courseId);

    nodeMap.set(courseId, {
      id: courseId,
      label: courseId,
      name: course?.name,
      external: external || !course,
    });
  };

  const addEdge = (edge: GraphEdge) => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      return;
    }

    edgeMap.set(
      `${edge.from}->${edge.to}:${edge.relationship}:${edge.groupIndex}:${edge.groupType}`,
      edge,
    );
  };

  const walkPrerequisites = (courseId: string, remainingDepth: number) => {
    if (remainingDepth <= 0 || visitedPrerequisites.has(`${courseId}:${remainingDepth}`)) {
      return;
    }

    visitedPrerequisites.add(`${courseId}:${remainingDepth}`);
    const course = getCourseById(courseId);

    if (!course) {
      return;
    }

    course.prerequisiteGroups.forEach((group) => {
      group.options.forEach((option) => {
        addNode(option.courseId, option.external);
        addEdge({
          from: option.courseId,
          to: courseId,
          relationship: 'prerequisite',
          groupType: group.type,
          groupIndex: group.groupIndex,
        });

        if (!option.external) {
          walkPrerequisites(option.courseId, remainingDepth - 1);
        }
      });
    });
  };

  const walkDependents = (courseId: string, remainingDepth: number) => {
    if (remainingDepth <= 0 || visitedDependents.has(`${courseId}:${remainingDepth}`)) {
      return;
    }

    visitedDependents.add(`${courseId}:${remainingDepth}`);

    for (const course of courses) {
      course.prerequisiteGroups.forEach((group) => {
        group.options.forEach((option) => {
          if (option.courseId !== courseId) {
            return;
          }

          addNode(course.id, false);
          addEdge({
            from: courseId,
            to: course.id,
            relationship: 'dependent',
            groupType: group.type,
            groupIndex: group.groupIndex,
          });
          walkDependents(course.id, remainingDepth - 1);
        });
      });
    }
  };

  addNode(rootCourseId, false);

  if (direction === 'prerequisites' || direction === 'both') {
    walkPrerequisites(rootCourseId, depth);
  }

  if (direction === 'dependents' || direction === 'both') {
    walkDependents(rootCourseId, depth);
  }

  return {
    rootCourseId,
    direction,
    depth,
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

function flattenGroups(groups: PrerequisiteGroup[]): string[] {
  return Array.from(new Set(groups.flatMap((group) => group.options.map((option) => option.courseId))));
}
