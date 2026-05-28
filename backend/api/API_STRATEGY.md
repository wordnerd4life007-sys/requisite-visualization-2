# API Strategy

This lane owns the API and integration boundary. The first implementation should keep the JSON contracts stable before choosing or adding an HTTP server dependency.

## Runtime Approach

- Start with transport-independent C++ response models and serialization helpers under `backend/include/api/` and `backend/src/api/`.
- Serve API handlers through a catalog interface. `PostgresCatalog` and `CsvCatalog` both populate the same in-memory search/graph model.
- Default runtime is `API_DATA_SOURCE=postgres`, which snapshots PostgreSQL into memory at startup. `API_DATA_SOURCE=csv` keeps the generated CSV path available for tests and local fallback work.
- The first HTTP runtime is a minimal standalone C++ socket server in `backend/src/api/HttpServer.cpp`. It binds to `127.0.0.1`, defaults to port `8080`, and can be moved to a web framework later if API complexity grows.
- The server loads `.env` without overriding existing shell variables. In CSV mode it reads `COURSES_CSV_PATH` when set, otherwise it falls back to `backend/data/courses.csv`, `data/courses.csv`, and `courses.csv`.
- The generated CSV remains the ingestion artifact: Coursedog -> CSV -> PostgreSQL import -> API startup snapshot.

## Database Environment Precedence

`DatabaseConfig` supports both app-oriented `DB_*` names and Docker Compose-oriented `POSTGRES_*` names:

1. `DATABASE_URL` is the complete connection override and takes precedence in connection-string builders.
2. When `DATABASE_URL` is absent, `DB_*` variables take precedence over matching `POSTGRES_*` variables.
3. `POSTGRES_*` variables are fallbacks so local Docker Compose settings can drive the app without duplicate values.
4. Built-in local defaults are used only when neither naming style is set.

Mapped component variables:

| Config field | Preferred | Fallback | Default |
| --- | --- | --- | --- |
| host | `DB_HOST` | `POSTGRES_HOST` | `localhost` |
| port | `DB_PORT` | `POSTGRES_PORT` | `5432` |
| database | `DB_NAME` | `POSTGRES_DB` | `requisite_visualization` |
| user | `DB_USER` | `POSTGRES_USER` | `requisite_user` |
| password | `DB_PASSWORD` | `POSTGRES_PASSWORD` | empty |

Secrets must not be logged. Redacted connection strings may show usernames, hostnames, ports, and database names, but password values must be replaced with `****`.

## Catalog Source Selection

`API_DATA_SOURCE` controls the runtime source:

- `postgres` is the default and requires imported catalog data.
- `csv` reads the generated CSV directly and is intended for fixture tests and local fallback work.

Both sources must produce the same JSON contracts below.

## Initial Endpoints

The proposed first API surface is read-only:

```text
GET /health
GET /courses
GET /courses/:id
GET /courses/:id/prerequisites
GET /courses/:id/dependents
GET /graph?course=CMPSC%2016&direction=both&depth=3
```

Query behavior:

- `/courses` supports optional `q`, `subjects`, `colleges`, and `limit` query parameters. `subject` and `college` are accepted as aliases. `limit` defaults to `100` and may be as high as `20000` so the frontend can populate full-catalog filters.
- `:id` uses the normalized catalog id such as `CMPSC 16`.
- `direction` accepts `prerequisites`, `dependents`, or `both`.
- `depth` defaults to `1` and should have a conservative maximum.
- `/graph` supports optional `subjects` and `colleges` filters. The root course is always included when found.
- `/paths` is still planned, but is not part of the first implemented server.

## JSON Contracts

Course summary:

```json
{
  "id": "CMPSC 16",
  "name": "Problem Solving With Computers I",
  "credits": 4,
  "college": "College of Engineering",
  "department": null,
  "subject": "CMPSC"
}
```

Course detail:

```json
{
  "id": "CMPSC 16",
  "name": "Problem Solving With Computers I",
  "credits": 4,
  "college": "College of Engineering",
  "department": null,
  "subject": "CMPSC",
  "prerequisiteGroups": [
    {
      "groupType": "all",
      "groupIndex": 0,
      "options": [
        { "courseId": "MATH 3A", "external": true }
      ]
    }
  ]
}
```

Prerequisite response:

```json
{
  "courseId": "CMPSC 16",
  "groups": [
    {
      "groupType": "any",
      "groupIndex": 0,
      "options": [
        { "courseId": "CMPSC 8", "external": false },
        { "courseId": "ECE 15", "external": false }
      ]
    }
  ],
  "flattenedCourseIds": ["CMPSC 8", "ECE 15"]
}
```

Dependent response:

```json
{
  "courseId": "CMPSC 16",
  "relationships": [
    {
      "courseId": "CMPSC 24",
      "groupType": "all",
      "groupIndex": 0,
      "external": false
    }
  ],
  "flattenedCourseIds": ["CMPSC 24"]
}
```

Graph response:

```json
{
  "rootCourseId": "CMPSC 16",
  "direction": "both",
  "depth": 3,
  "nodes": [
    {
      "id": "CMPSC 16",
      "label": "CMPSC 16",
      "name": "Problem Solving With Computers I",
      "external": false,
      "college": "College of Engineering",
      "department": null,
      "subject": "CMPSC"
    }
  ],
  "edges": [
    {
      "from": "CMPSC 8",
      "to": "CMPSC 16",
      "relationship": "prerequisite",
      "groupType": "any",
      "groupIndex": 0
    }
  ]
}
```

Graph edge `relationship` is `prerequisite` when the edge is part of the rooted prerequisite traversal and `dependent` when the edge is part of the rooted dependent traversal. A `both` graph is the union of those two rooted traversals; it does not expand from a dependent course back into that course's other prerequisites.

Path response:

```json
{
  "from": "CMPSC 8",
  "to": "CMPSC 189A",
  "reachable": true,
  "distance": 4,
  "courseIds": ["CMPSC 8", "CMPSC 16", "CMPSC 24", "CMPSC 130A", "CMPSC 189A"]
}
```

Error response:

```json
{
  "error": {
    "code": "course_not_found",
    "message": "Course not found."
  }
}
```

## Handoffs

- Lane 1 should provide stable in-memory queries for direct prerequisites, recursive prerequisites, dependents, graph neighborhoods, and shortest path reconstruction.
- Lane 2 should settle external prerequisite storage before the PostgreSQL-backed adapter becomes the source for grouped prerequisite responses.
- Lane 4 should keep normal runtime on `fetch()` calls and use `frontend/src/data/mockCatalog.ts` only as a development fixture if needed.
- Lane 5 should keep API smoke and catalog contract tests aligned with these response contracts.
