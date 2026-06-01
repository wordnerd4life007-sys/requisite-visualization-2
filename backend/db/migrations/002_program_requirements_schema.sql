BEGIN;

CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    college TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT '',
    degree_designation TEXT NOT NULL DEFAULT '',
    degree_level TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT programs_id_not_blank CHECK (btrim(id) <> ''),
    CONSTRAINT programs_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS program_versions (
    id BIGSERIAL PRIMARY KEY,
    program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    catalog_year TEXT NOT NULL,
    source_record_id TEXT NOT NULL DEFAULT '',
    effective_start_date DATE,
    effective_end_date DATE,
    has_structured_requirements BOOLEAN NOT NULL DEFAULT false,
    raw_source JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (program_id, catalog_year, source_record_id),
    CONSTRAINT program_versions_catalog_year_not_blank CHECK (btrim(catalog_year) <> '')
);

CREATE TABLE IF NOT EXISTS requirement_blocks (
    id BIGSERIAL PRIMARY KEY,
    program_version_id BIGINT NOT NULL REFERENCES program_versions(id) ON DELETE CASCADE,
    source_key TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    rule_kind TEXT NOT NULL DEFAULT 'manual_review',
    minimum_courses INTEGER,
    minimum_units NUMERIC(6, 2),
    notes TEXT NOT NULL DEFAULT '',
    parser_confidence TEXT NOT NULL DEFAULT 'raw',
    position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0)
);

CREATE TABLE IF NOT EXISTS requirement_options (
    id BIGSERIAL PRIMARY KEY,
    requirement_block_id BIGINT NOT NULL REFERENCES requirement_blocks(id) ON DELETE CASCADE,
    course_id TEXT,
    course_set_id TEXT,
    option_label TEXT NOT NULL DEFAULT '',
    option_kind TEXT NOT NULL DEFAULT 'course',
    position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0),
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_sets (
    id TEXT PRIMARY KEY,
    catalog_year TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    raw_source JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT course_sets_id_not_blank CHECK (btrim(id) <> ''),
    CONSTRAINT course_sets_catalog_year_not_blank CHECK (btrim(catalog_year) <> '')
);

CREATE TABLE IF NOT EXISTS program_documents (
    id BIGSERIAL PRIMARY KEY,
    program_version_id BIGINT NOT NULL REFERENCES program_versions(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL,
    document_kind TEXT NOT NULL DEFAULT 'requirements_pdf',
    parser_status TEXT NOT NULL DEFAULT 'source_attachment',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT program_documents_url_not_blank CHECK (btrim(url) <> '')
);

CREATE INDEX IF NOT EXISTS idx_program_versions_catalog_year
    ON program_versions (catalog_year);

CREATE INDEX IF NOT EXISTS idx_requirement_options_course_id
    ON requirement_options (course_id);

COMMENT ON TABLE programs IS 'UCSB academic programs and majors, separate from course catalog rows.';
COMMENT ON TABLE program_versions IS 'Catalog-year/effective-date version snapshots for program requirements.';
COMMENT ON TABLE requirement_blocks IS 'Normalized or manually reviewed degree requirement blocks.';
COMMENT ON TABLE requirement_options IS 'Course or course-set options inside a requirement block.';
COMMENT ON TABLE course_sets IS 'Coursedog course-set source records used by program requirements.';
COMMENT ON TABLE program_documents IS 'Source requirement PDFs or catalog documents attached to program versions.';

COMMIT;
