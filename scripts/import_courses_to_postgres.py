#!/usr/bin/env python3
"""Validate and optionally import generated courses.csv into PostgreSQL."""

from __future__ import annotations

import argparse
import csv
import os
import re
import subprocess
import sys
import tempfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path


REQUIRED_HEADERS = ["id", "name", "credits", "college", "prereqs"]
OPTIONAL_METADATA_HEADERS = ["subject", "department", "description"]
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV_PATH = REPO_ROOT / "backend" / "data" / "courses.csv"
DEFAULT_ENV_PATH = REPO_ROOT / ".env"


@dataclass(frozen=True)
class CourseRow:
    line_number: int
    course_id: str
    name: str
    credits: str
    college: str
    prereqs: str
    subject: str = ""
    department: str = ""
    description: str = ""


@dataclass(frozen=True)
class PrerequisiteGroup:
    course_id: str
    group_position: int
    group_kind: str


@dataclass(frozen=True)
class PrerequisiteOption:
    course_id: str
    group_position: int
    option_position: int
    prerequisite_id: str


@dataclass(frozen=True)
class ImportPlan:
    courses: list[CourseRow]
    groups: list[PrerequisiteGroup]
    options: list[PrerequisiteOption]
    errors: list[str]
    headers: list[str]


def compact_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip())


def split_options(value: str) -> list[str]:
    return [compact_spaces(part) for part in value.split(",") if compact_spaces(part)]


def parse_prerequisites(course: CourseRow) -> tuple[list[PrerequisiteGroup], list[PrerequisiteOption], list[str]]:
    raw = course.prereqs.strip()
    if not raw:
        return [], [], []

    errors: list[str] = []
    groups: list[PrerequisiteGroup] = []
    options: list[PrerequisiteOption] = []

    if raw.count("|") > 1:
        return [], [], [f"line {course.line_number}: {course.course_id} has more than one prerequisite pipe"]

    required_part, separator, alternative_part = raw.partition("|")
    group_position = 1

    required_options = split_options(required_part)
    if required_options:
        groups.append(PrerequisiteGroup(course.course_id, group_position, "all"))
        add_options(course, group_position, required_options, options, errors)
        group_position += 1

    if separator:
        for alternative_group in alternative_part.split(";"):
            alternative_options = split_options(alternative_group)
            if not alternative_options:
                continue
            groups.append(PrerequisiteGroup(course.course_id, group_position, "any"))
            add_options(course, group_position, alternative_options, options, errors)
            group_position += 1

    return groups, options, errors


def add_options(
    course: CourseRow,
    group_position: int,
    prerequisite_ids: list[str],
    options: list[PrerequisiteOption],
    errors: list[str],
) -> None:
    seen_in_group: set[str] = set()
    for option_position, prerequisite_id in enumerate(prerequisite_ids, start=1):
        if prerequisite_id == course.course_id:
            errors.append(f"line {course.line_number}: {course.course_id} references itself")
        if prerequisite_id in seen_in_group:
            errors.append(
                f"line {course.line_number}: {course.course_id} repeats {prerequisite_id} "
                f"in group {group_position}"
            )
        seen_in_group.add(prerequisite_id)
        options.append(
            PrerequisiteOption(
                course_id=course.course_id,
                group_position=group_position,
                option_position=option_position,
                prerequisite_id=prerequisite_id,
            )
        )


def read_csv(csv_path: Path) -> ImportPlan:
    errors: list[str] = []
    courses: list[CourseRow] = []
    groups: list[PrerequisiteGroup] = []
    options: list[PrerequisiteOption] = []

    with csv_path.open(newline="", encoding="utf-8-sig") as input_file:
        reader = csv.DictReader(input_file)
        headers = reader.fieldnames or []
        missing_headers = [header for header in REQUIRED_HEADERS if header not in headers]
        if missing_headers:
            return ImportPlan(
                courses=[],
                groups=[],
                options=[],
                errors=[f"missing CSV headers: {', '.join(missing_headers)}"],
                headers=headers,
            )

        seen_course_ids: dict[str, int] = {}
        for row in reader:
            course = CourseRow(
                line_number=reader.line_num,
                course_id=compact_spaces(row.get("id") or ""),
                name=(row.get("name") or "").strip(),
                credits=(row.get("credits") or "").strip(),
                college=(row.get("college") or "").strip(),
                prereqs=(row.get("prereqs") or "").strip(),
                subject=compact_spaces(row.get("subject") or ""),
                department=compact_spaces(row.get("department") or ""),
                description=compact_spaces(row.get("description") or ""),
            )

            if not course.course_id:
                errors.append(f"line {course.line_number}: blank course id")
            elif course.course_id in seen_course_ids:
                errors.append(
                    f"line {course.line_number}: duplicate course id {course.course_id} "
                    f"(first seen on line {seen_course_ids[course.course_id]})"
                )
            else:
                seen_course_ids[course.course_id] = course.line_number

            if not course.name:
                errors.append(f"line {course.line_number}: {course.course_id or '<blank>'} has blank name")
            if not course.college:
                errors.append(f"line {course.line_number}: {course.course_id or '<blank>'} has blank college")

            parsed_groups, parsed_options, prereq_errors = parse_prerequisites(course)
            groups.extend(parsed_groups)
            options.extend(parsed_options)
            errors.extend(prereq_errors)
            courses.append(course)

    return ImportPlan(courses=courses, groups=groups, options=options, errors=errors, headers=headers)


def is_positive_integer(value: str) -> bool:
    return bool(re.fullmatch(r"[1-9][0-9]*", value))


def summarize_coverage(label: str, values: list[str], has_column: bool, limit: int = 8) -> str:
    if not has_column:
        return f"{label} coverage: not available (CSV column not present)"

    counts = Counter(value for value in values if value)
    blank_count = sum(1 for value in values if not value)
    if not counts:
        return f"{label} coverage: 0 values, blank rows: {blank_count}"

    rendered = ", ".join(f"{name}={count}" for name, count in counts.most_common(limit))
    remaining = len(counts) - limit
    if remaining > 0:
        rendered += f", ... {remaining} more"
    return f"{label} coverage: {len(counts)} values, blank rows: {blank_count}; {rendered}"


def summarize_presence(label: str, values: list[str], has_column: bool) -> str:
    if not has_column:
        return f"{label} coverage: not available (CSV column not present)"

    blank_count = sum(1 for value in values if not value)
    return f"{label} coverage: {len(values) - blank_count} rows, blank rows: {blank_count}"


def build_summary(plan: ImportPlan, csv_path: Path) -> list[str]:
    course_ids = {course.course_id for course in plan.courses}
    courses_with_prereqs = {option.course_id for option in plan.options}
    external_options = [option for option in plan.options if option.prerequisite_id not in course_ids]
    external_ids = sorted({option.prerequisite_id for option in external_options})
    blank_credit_count = sum(1 for course in plan.courses if course.credits == "")
    nonstandard_credit_count = sum(
        1 for course in plan.courses if course.credits != "" and not is_positive_integer(course.credits)
    )
    any_group_count = sum(1 for group in plan.groups if group.group_kind == "any")
    all_group_count = sum(1 for group in plan.groups if group.group_kind == "all")
    has_subject_column = OPTIONAL_METADATA_HEADERS[0] in plan.headers
    has_department_column = OPTIONAL_METADATA_HEADERS[1] in plan.headers
    has_description_column = OPTIONAL_METADATA_HEADERS[2] in plan.headers

    return [
        f"CSV path: {csv_path}",
        f"Courses: {len(plan.courses)}",
        summarize_coverage("College", [course.college for course in plan.courses], True),
        summarize_coverage("Subject", [course.subject for course in plan.courses], has_subject_column),
        summarize_coverage("Department", [course.department for course in plan.courses], has_department_column),
        summarize_presence("Description", [course.description for course in plan.courses], has_description_column),
        f"Courses with prerequisites: {len(courses_with_prereqs)}",
        f"Prerequisite groups: {len(plan.groups)} ({all_group_count} all, {any_group_count} any)",
        f"Prerequisite options: {len(plan.options)}",
        f"External prerequisite option refs: {len(external_options)}",
        f"Distinct external prerequisite ids: {len(external_ids)}",
        f"Blank credit values: {blank_credit_count}",
        f"Nonstandard nonblank credit values: {nonstandard_credit_count}",
    ]


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def values_insert(table_name: str, columns: list[str], rows: list[tuple[object, ...]]) -> str:
    if not rows:
        return f"-- No rows for {table_name}.\n"

    column_sql = ", ".join(columns)
    lines = [f"INSERT INTO {table_name} ({column_sql}) VALUES"]
    rendered_rows = []
    for row in rows:
        rendered_values = []
        for value in row:
            if isinstance(value, int):
                rendered_values.append(str(value))
            else:
                rendered_values.append(sql_literal(str(value)))
        rendered_rows.append("    (" + ", ".join(rendered_values) + ")")
    lines.append(",\n".join(rendered_rows) + ";")
    return "\n".join(lines) + "\n"


def generate_sql(plan: ImportPlan) -> str:
    course_rows = [
        (
            course.course_id,
            course.name,
            course.credits,
            course.college,
            course.subject,
            course.department,
            course.description,
        )
        for course in plan.courses
    ]
    group_rows = [
        (group.course_id, group.group_position, group.group_kind)
        for group in plan.groups
    ]
    option_rows = [
        (option.course_id, option.group_position, option.option_position, option.prerequisite_id)
        for option in plan.options
    ]

    return "\n".join(
        [
            "BEGIN;",
            "",
            "CREATE TEMP TABLE import_courses (",
            "    id TEXT PRIMARY KEY,",
            "    name TEXT NOT NULL,",
            "    credits TEXT NOT NULL,",
            "    college TEXT NOT NULL,",
            "    subject TEXT NOT NULL,",
            "    department TEXT NOT NULL,",
            "    description TEXT NOT NULL",
            ") ON COMMIT DROP;",
            "",
            "CREATE TEMP TABLE import_course_prerequisite_groups (",
            "    course_id TEXT NOT NULL,",
            "    group_position INTEGER NOT NULL,",
            "    group_kind TEXT NOT NULL",
            ") ON COMMIT DROP;",
            "",
            "CREATE TEMP TABLE import_course_prerequisite_options (",
            "    course_id TEXT NOT NULL,",
            "    group_position INTEGER NOT NULL,",
            "    option_position INTEGER NOT NULL,",
            "    prerequisite_id TEXT NOT NULL",
            ") ON COMMIT DROP;",
            "",
            values_insert(
                "import_courses",
                ["id", "name", "credits", "college", "subject", "department", "description"],
                course_rows,
            ).rstrip(),
            "",
            values_insert(
                "import_course_prerequisite_groups",
                ["course_id", "group_position", "group_kind"],
                group_rows,
            ).rstrip(),
            "",
            values_insert(
                "import_course_prerequisite_options",
                ["course_id", "group_position", "option_position", "prerequisite_id"],
                option_rows,
            ).rstrip(),
            "",
            "DELETE FROM courses AS existing",
            "WHERE NOT EXISTS (",
            "    SELECT 1",
            "    FROM import_courses AS imported",
            "    WHERE imported.id = existing.id",
            ");",
            "",
            "DELETE FROM course_prerequisite_options AS options",
            "USING import_courses AS imported",
            "WHERE options.course_id = imported.id;",
            "",
            "DELETE FROM course_prerequisite_groups AS groups",
            "USING import_courses AS imported",
            "WHERE groups.course_id = imported.id;",
            "",
            "INSERT INTO courses (id, name, credits, college)",
            "SELECT id, name, credits, college",
            "FROM import_courses",
            "ON CONFLICT (id) DO UPDATE SET",
            "    name = EXCLUDED.name,",
            "    credits = EXCLUDED.credits,",
            "    college = EXCLUDED.college,",
            "    updated_at = now();",
            "",
            "DO $$",
            "BEGIN",
            "    IF EXISTS (",
            "        SELECT 1",
            "        FROM information_schema.columns",
            "        WHERE table_schema = 'public'",
            "            AND table_name = 'courses'",
            "            AND column_name = 'subject'",
            "    ) THEN",
            "        EXECUTE 'UPDATE courses SET subject = imported.subject FROM import_courses AS imported WHERE courses.id = imported.id';",
            "    END IF;",
            "",
            "    IF EXISTS (",
            "        SELECT 1",
            "        FROM information_schema.columns",
            "        WHERE table_schema = 'public'",
            "            AND table_name = 'courses'",
            "            AND column_name = 'department'",
            "    ) THEN",
            "        EXECUTE 'UPDATE courses SET department = imported.department FROM import_courses AS imported WHERE courses.id = imported.id';",
            "    END IF;",
            "",
            "    IF EXISTS (",
            "        SELECT 1",
            "        FROM information_schema.columns",
            "        WHERE table_schema = 'public'",
            "            AND table_name = 'courses'",
            "            AND column_name = 'description'",
            "    ) THEN",
            "        EXECUTE 'UPDATE courses SET description = imported.description FROM import_courses AS imported WHERE courses.id = imported.id';",
            "    END IF;",
            "END $$;",
            "",
            "INSERT INTO course_prerequisite_groups (course_id, group_position, group_kind)",
            "SELECT course_id, group_position, group_kind",
            "FROM import_course_prerequisite_groups;",
            "",
            "INSERT INTO course_prerequisite_options (course_id, group_position, option_position, prerequisite_id)",
            "SELECT course_id, group_position, option_position, prerequisite_id",
            "FROM import_course_prerequisite_options;",
            "",
            "COMMIT;",
            "",
        ]
    )


def read_dotenv(env_path: Path = DEFAULT_ENV_PATH) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        name = name.strip()
        value = value.strip().strip("\"'")
        if name:
            values[name] = value
    return values


def connection_value(name: str, dotenv: dict[str, str], fallback_name: str | None = None) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    if name in dotenv and dotenv[name].strip():
        return dotenv[name].strip()
    if fallback_name is not None:
        return connection_value(fallback_name, dotenv)
    return ""


def apply_with_psql(sql: str, args: argparse.Namespace) -> int:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".sql", delete=False) as temp_file:
        temp_file.write(sql)
        temp_path = Path(temp_file.name)

    dotenv = read_dotenv()
    database_url = connection_value("DATABASE_URL", dotenv)
    host = args.host or connection_value("DB_HOST", dotenv, "POSTGRES_HOST")
    port = args.port or connection_value("DB_PORT", dotenv, "POSTGRES_PORT")
    username = args.username or connection_value("DB_USER", dotenv, "POSTGRES_USER")
    dbname = args.dbname or connection_value("DB_NAME", dotenv, "POSTGRES_DB")
    password = connection_value("DB_PASSWORD", dotenv, "POSTGRES_PASSWORD")

    command = [args.psql]
    if database_url and not any([args.host, args.port, args.username, args.dbname]):
        command.append(database_url)
    else:
        if host:
            command.extend(["--host", host])
        if port:
            command.extend(["--port", port])
        if username:
            command.extend(["--username", username])
        if dbname:
            command.extend(["--dbname", dbname])
    command.extend(args.psql_arg or [])
    command.extend(["-v", "ON_ERROR_STOP=1", "-f", str(temp_path)])

    env = os.environ.copy()
    if password and not env.get("PGPASSWORD"):
        env["PGPASSWORD"] = password

    try:
        completed = subprocess.run(command, check=False, env=env)
        return completed.returncode
    finally:
        temp_path.unlink(missing_ok=True)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate and optionally import backend/data/courses.csv into PostgreSQL.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python scripts/import_courses_to_postgres.py --dry-run
  python scripts/import_courses_to_postgres.py --sql-output import_courses.sql
  python scripts/import_courses_to_postgres.py --apply --host localhost --username postgres --dbname requisite_visualization

Dry-run validation uses only the Python standard library and does not require
Docker, psql, or a DB driver. Applying requires psql. The script does not read
.env; supply connection details through psql defaults, PG* environment
variables, .pgpass, or the non-secret psql flags above.

CSV columns subject, department, and description are optional. When present, dry-run reports
coverage. Generated SQL carries them through a temp table and updates matching
courses columns only if those columns already exist.
""",
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"Path to generated courses.csv. Defaults to {DEFAULT_CSV_PATH}.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and print counts without writing SQL or connecting to PostgreSQL. This is the default.",
    )
    parser.add_argument(
        "--sql-output",
        type=Path,
        help="Write idempotent PostgreSQL import SQL to this path after validation.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the generated import SQL with psql. Requires psql on PATH unless --psql points elsewhere.",
    )
    parser.add_argument("--psql", default="psql", help="psql executable to use with --apply.")
    parser.add_argument("--host", help="Optional psql host for --apply.")
    parser.add_argument("--port", help="Optional psql port for --apply.")
    parser.add_argument("--username", help="Optional psql username for --apply.")
    parser.add_argument("--dbname", help="Optional psql database name for --apply.")
    parser.add_argument(
        "--psql-arg",
        action="append",
        help="Additional psql argument for --apply. Repeat for multiple arguments.",
    )
    args = parser.parse_args(argv)
    if args.dry_run and (args.sql_output or args.apply):
        parser.error("--dry-run cannot be combined with --sql-output or --apply")
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    csv_path = args.csv.resolve()

    if not csv_path.exists():
        print(f"CSV file not found: {csv_path}", file=sys.stderr)
        return 1

    plan = read_csv(csv_path)
    for line in build_summary(plan, csv_path):
        print(line)

    if plan.errors:
        print("", file=sys.stderr)
        print(f"Validation failed with {len(plan.errors)} error(s):", file=sys.stderr)
        for error in plan.errors[:20]:
            print(f"- {error}", file=sys.stderr)
        if len(plan.errors) > 20:
            print(f"- ... {len(plan.errors) - 20} more", file=sys.stderr)
        return 1

    print("Validation: passed")

    if args.sql_output or args.apply:
        sql = generate_sql(plan)
        if args.sql_output:
            args.sql_output.write_text(sql, encoding="utf-8")
            print(f"SQL written: {args.sql_output}")
        if args.apply:
            try:
                return apply_with_psql(sql, args)
            except FileNotFoundError:
                print(f"psql executable not found: {args.psql}", file=sys.stderr)
                return 1

    if args.dry_run or not args.apply:
        print("Dry run only: no database changes were made.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
