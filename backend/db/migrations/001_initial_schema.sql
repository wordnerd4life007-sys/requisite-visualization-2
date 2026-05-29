BEGIN;

CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    credits TEXT NOT NULL DEFAULT '',
    college TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT courses_id_not_blank CHECK (btrim(id) <> ''),
    CONSTRAINT courses_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT courses_college_not_blank CHECK (btrim(college) <> '')
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT '';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_credits_check;
ALTER TABLE courses ALTER COLUMN credits TYPE TEXT USING credits::text;
ALTER TABLE courses ALTER COLUMN credits SET DEFAULT '';
ALTER TABLE courses ALTER COLUMN credits SET NOT NULL;

CREATE TABLE IF NOT EXISTS course_prerequisite_groups (
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    group_position INTEGER NOT NULL CHECK (group_position > 0),
    group_kind TEXT NOT NULL CHECK (group_kind IN ('all', 'any')),
    PRIMARY KEY (course_id, group_position)
);

CREATE TABLE IF NOT EXISTS course_prerequisite_options (
    course_id TEXT NOT NULL,
    group_position INTEGER NOT NULL,
    option_position INTEGER NOT NULL CHECK (option_position > 0),
    prerequisite_id TEXT NOT NULL,
    PRIMARY KEY (course_id, group_position, option_position),
    UNIQUE (course_id, group_position, prerequisite_id),
    FOREIGN KEY (course_id, group_position)
        REFERENCES course_prerequisite_groups (course_id, group_position)
        ON DELETE CASCADE,
    CONSTRAINT course_prerequisite_options_prerequisite_not_blank CHECK (btrim(prerequisite_id) <> ''),
    CONSTRAINT course_prerequisite_options_no_self_reference CHECK (course_id <> prerequisite_id)
);

CREATE INDEX IF NOT EXISTS idx_course_prerequisite_options_prerequisite_id
    ON course_prerequisite_options (prerequisite_id);

CREATE INDEX IF NOT EXISTS idx_courses_subject
    ON courses (subject);

CREATE INDEX IF NOT EXISTS idx_courses_college
    ON courses (college);

CREATE OR REPLACE VIEW course_prerequisites AS
SELECT
    groups.course_id,
    groups.group_position,
    groups.group_kind,
    options.option_position,
    options.prerequisite_id
FROM course_prerequisite_groups AS groups
JOIN course_prerequisite_options AS options
    ON options.course_id = groups.course_id
    AND options.group_position = groups.group_position;

CREATE OR REPLACE VIEW course_dependency_edges AS
SELECT
    prerequisite_id AS source_course_id,
    course_id AS target_course_id
FROM course_prerequisite_options;

COMMENT ON TABLE courses IS 'Course catalog rows: id, name, description, raw catalog credits text, college, subject, and department.';
COMMENT ON COLUMN courses.credits IS 'Catalog credit value as emitted by the CSV; blank and nonnumeric values are allowed.';
COMMENT ON COLUMN courses.subject IS 'Catalog subject label used by API filters and graph metadata.';
COMMENT ON COLUMN courses.department IS 'Catalog department label used by API metadata responses.';
COMMENT ON COLUMN courses.description IS 'Catalog course description used by API metadata responses and free-text search.';
COMMENT ON TABLE course_prerequisite_groups IS 'Prerequisite expression groups. all groups require every option; any groups require one option.';
COMMENT ON TABLE course_prerequisite_options IS 'Prerequisite course ids inside each requirement group. prerequisite_id may reference courses outside this local catalog.';
COMMENT ON VIEW course_prerequisites IS 'Expanded prerequisite rows with group semantics preserved.';
COMMENT ON VIEW course_dependency_edges IS 'Graph-friendly prerequisite-to-course edge view that intentionally flattens group semantics.';

COMMIT;
