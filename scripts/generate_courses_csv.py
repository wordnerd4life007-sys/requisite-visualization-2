#!/usr/bin/env python3
"""Generate courses.csv from UCSB's public Coursedog catalog feed."""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable
from urllib.parse import urlencode

import requests


CATALOG_ID = "mZXlGvYb30h2fSq3aYLn"
CATALOG_SEARCH_URL = "https://app.coursedog.com/api/v1/cm/ucsb/courses/search/%24filters"
CATALOG_LIMIT = 50000
CATALOG_COLUMNS = [
    "code",
    "courseGroupId",
    "subjectCode",
    "courseNumber",
    "longName",
    "globalCourseTitle",
    "name",
    "credits",
    "college",
    "departments",
    "requisites",
    "effectiveStartDate",
    "effectiveEndDate",
]

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://catalog.ucsb.edu",
    "Referer": "https://catalog.ucsb.edu/courses",
    "User-Agent": "Mozilla/5.0",
}

FILTERS = {
    "filters": [
        {
            "id": "description-course",
            "condition": "field",
            "name": "description",
            "inputType": "text",
            "group": "course",
            "type": "isNotEmpty",
        },
        {
            "id": "startTerm-course",
            "condition": "field",
            "name": "startTerm",
            "inputType": "text",
            "group": "course",
            "type": "isNotEmpty",
        },
        {
            "id": "HiPz3-course",
            "condition": "field",
            "name": "HiPz3",
            "inputType": "boolean",
            "group": "course",
            "type": "isNot",
            "value": True,
            "customField": True,
        },
    ],
    "id": "HXkaROAK",
    "condition": "and",
}

@dataclass(frozen=True)
class CatalogSummary:
    fetched_count: int
    selected_count: int
    duplicate_ids: list[str] = field(default_factory=list)
    college_counts: Counter = field(default_factory=Counter)
    subject_counts: Counter = field(default_factory=Counter)
    department_counts: Counter = field(default_factory=Counter)
    flag_counts: Counter = field(default_factory=Counter)
    blank_name_fallbacks: int = 0
    blank_credit_count: int = 0
    nonstandard_credit_count: int = 0


NAME_MAP = [
    (r"\bElectrical\s+and\s+Computer\s+Engineering\b", "ECE"),
    (r"\bElectrical\s+Engineering\b", "ECE"),
    (r"\bComputer\s*Science\b", "CMPSC"),
    (r"\bComp\.?\s*Sci\.?\b", "CMPSC"),
    (r"\bChemical\s+Engineering\b", "CH E"),
    (r"\bChemical\s+Engr\b", "CH E"),
    (r"\bMechanical\s+Engineering\b", "ME"),
    (r"\bMechanical\s+Engr\b", "ME"),
    (r"\bEngineering\b", "ENGR"),
    (r"\bEngr\b", "ENGR"),
    (r"\bMathematics\b", "MATH"),
    (r"\bMath\b", "MATH"),
    (r"\bChemistry\b", "CHEM"),
    (r"\bChem\b", "CHEM"),
    (r"\bPhysics\b", "PHYS"),
    (r"\bPhys\b", "PHYS"),
    (r"\bStatistics\s+and\s+Applied\s+Probability\b", "PSTAT"),
    (r"\bStatistics\b", "PSTAT"),
    (r"\bMaterials\b", "MATRL"),
    (r"\bBioengineering\b", "BIOE"),
    (
        r"\bMolecular\s*,?\s*Cellular\s*(?:and|&)\s*Developmental\s*Biology\b",
        "MCDB",
    ),
    (r"\bWriting\b", "WRIT"),
    (r"\bCS\b", "CMPSC"),
    (r"\bEE\b", "ECE"),
]


def build_catalog_url(effective_date: str) -> str:
    query = {
        "catalogId": CATALOG_ID,
        "skip": "0",
        "limit": str(CATALOG_LIMIT),
        "orderBy": "code",
        "formatDependents": "false",
        "effectiveDatesRange": f"{effective_date},{effective_date}",
        "ignoreEffectiveDating": "false",
        "columns": ",".join(CATALOG_COLUMNS),
    }
    return f"{CATALOG_SEARCH_URL}?{urlencode(query)}"


def fetch_catalog_records(effective_date: str | None = None) -> list[dict]:
    effective_date = effective_date or dt.date.today().isoformat()
    response = requests.post(build_catalog_url(effective_date), json=FILTERS, headers=HEADERS, timeout=120)
    response.raise_for_status()
    return response.json()["data"]


def normalize_subject(subject: str) -> str:
    subject = " ".join(subject.upper().split())
    if subject == "CMPSCW":
        return "CMPSC W"
    return subject


def course_id(subject: str, number: str) -> str:
    subject = normalize_subject(subject)
    number = number.upper().replace(" ", "")
    if subject.endswith(" W"):
        return f"{subject}{number}"
    return f"{subject} {number}"


def course_sort_key(course: dict) -> tuple[str, str, str, str]:
    return (
        normalize_subject(course.get("subjectCode") or ""),
        (course.get("courseNumber") or "").upper().replace(" ", ""),
        course.get("effectiveStartDate") or "",
        course.get("_id") or course.get("id") or "",
    )


def record_precedence_key(course: dict) -> tuple[str, str]:
    return (
        course.get("effectiveStartDate") or "",
        course.get("_id") or course.get("id") or "",
    )


def select_latest_records(records: list[dict], colleges: set[str] | None = None) -> tuple[list[dict], list[str]]:
    selected: dict[str, dict] = {}
    duplicate_ids: set[str] = set()

    for course in records:
        college = (course.get("college") or "").strip()
        if colleges is not None and college not in colleges:
            continue

        own_id = course_id(course.get("subjectCode") or "", course.get("courseNumber") or "")
        if own_id in selected:
            duplicate_ids.add(own_id)
            if record_precedence_key(course) <= record_precedence_key(selected[own_id]):
                continue
        selected[own_id] = course

    return sorted(selected.values(), key=course_sort_key), sorted(duplicate_ids)


def course_units(course: dict) -> str:
    credits = course.get("credits") or {}
    credit_hours = credits.get("creditHours") or {}
    value = credit_hours.get("min") or credits.get("numberOfCredits") or ""
    return str(value)


def is_standard_credit_value(value: str) -> bool:
    return bool(re.fullmatch(r"[1-9][0-9]*", value))


def course_name(course: dict, own_id: str) -> tuple[str, bool]:
    for key in ("longName", "name"):
        value = " ".join(str(course.get(key) or "").split())
        if value:
            return value, False

    global_title = " ".join(str(course.get("globalCourseTitle") or "").split())
    if global_title:
        _, separator, title = global_title.partition(" - ")
        value = title.strip() if separator else global_title
        if value:
            return value, True

    return own_id, True


def department_label(course: dict) -> str:
    departments = course.get("departments") or []
    labels: list[str] = []

    for department in departments:
        label = ""
        if isinstance(department, str):
            label = department
        elif isinstance(department, dict):
            for key in ("name", "label", "title", "code", "id", "value"):
                if department.get(key):
                    label = str(department[key])
                    break
        else:
            label = str(department)

        label = " ".join(label.split())
        if label:
            labels.append(label)

    return "; ".join(dedupe(labels))


def raw_requisite_text(course: dict) -> str:
    requisites = course.get("requisites") or {}
    freeform = requisites.get("requisitesFreeform") or {}
    return freeform.get("value") or ""


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = re.sub(r"<\s*(br|/p|/div|/li)\s*/?>", "; ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value).replace("\xa0", " ")
    value = value.replace("\u2013", "-").replace("\u2014", "-")
    value = value.replace("\u2019", "'")
    return re.sub(r"\s+", " ", value).strip()


def standardize_subject_names(text: str) -> str:
    for pattern, replacement in NAME_MAP:
        text = re.sub(pattern, replacement, text, flags=re.I)
    return text


def strip_non_course_requirements(text: str) -> str:
    text = re.sub(r"(?i)\bpre[- ]?requisites?\s*:\s*", "", text)
    text = re.sub(r"(?i)\(\s*may be taken concurrently(?:[^)]*)\)", " ", text)
    text = re.sub(
        r"(?i)\bmay be taken concurrently(?:\s+with\s+[A-Z ]+\d+[A-Z]*)?",
        " ",
        text,
    )
    text = re.sub(
        r"(?i)\bwith\s+(?:a\s+)?(?:minimum\s+)?(?:letter\s+)?grade\s+of\s+"
        r"[A-F][+-]?\s*(?:or\s+better)?(?:\s+in\s+each(?:\s+of\s+those\s+courses)?)?",
        " ",
        text,
    )
    text = re.sub(
        r"(?i)\bwith\s+minimum\s+grade\s+of\s+[A-F][+-]?\s*(?:or\s+better)?",
        " ",
        text,
    )
    text = re.sub(
        r"(?i)\bminimum\s+grade\s+of\s+[A-F][+-]?\s*(?:or\s+better)?",
        " ",
        text,
    )
    text = re.sub(r"(?i)\bmust\s+be\s+concurrently\s+enrolled\s+in\b", "", text)
    text = re.sub(
        r"(?i)(?:,?\s*or\s+)?(?:consent|permission)\s+of\s+(?:the\s+)?instructor",
        " ",
        text,
    )
    text = re.sub(r"(?i)(?:,?\s*or\s+)?instructor\s+(?:permission|consent)", " ", text)
    text = re.sub(
        r"(?i)(?:,?\s*or\s+)?significant\s+prior\s+programming\s+experience",
        " ",
        text,
    )
    text = re.sub(r"(?i)(?:,?\s*or\s+)?equivalent(?:\s+course(?:work)?)?", " ", text)
    text = re.sub(r"(?i)(?:,?\s*or\s+)?similar\s+course(?:work)?", " ", text)
    text = re.sub(r"(?i)\bopen\s+to\s+[^.;]*?(?:majors?|students)\s+only\b", " ", text)
    text = re.sub(r"(?i)\bnot\s+open\s+for\s+credit\s+[^.;]*", " ", text)
    text = re.sub(r"(?i)\bfor\s+undergraduates\s*,?", " ", text)
    text = re.sub(r"(?i)\b(?:upper[- ]division|graduate|senior|junior)\s+standing\b", " ", text)
    text = re.sub(r"(?i)\bcompletion\s+of\s+\d+\s+upper[- ]division\s+courses\s+in\s+[^.;]*", " ", text)
    text = re.sub(r"(?i)\badmission\s+to\s+[^.;]*", " ", text)
    return re.sub(r"\s+", " ", text).strip(" ;,.")


def normalize_matched_subject(value: str, subjects: Iterable[str]) -> str:
    compact = value.upper().replace(" ", "")
    for subject in subjects:
        normalized = normalize_subject(subject)
        if compact == normalized.replace(" ", ""):
            return normalized
    return normalize_subject(value)


def expand_number(number: str) -> list[str]:
    number = number.upper().replace(" ", "")
    parts = [part for part in re.split(r"-+", number) if part]
    if len(parts) == 1:
        return parts

    first = parts[0]
    match = re.match(r"^(\d+)([A-Z]*)$", first)
    if not match:
        return parts

    base, first_suffix = match.groups()
    if (
        len(parts) == 2
        and len(first_suffix) == 1
        and re.fullmatch(r"[A-Z]", parts[1])
        and first_suffix <= parts[1]
    ):
        return [base + chr(code) for code in range(ord(first_suffix), ord(parts[1]) + 1)]

    expanded = [first]
    for part in parts[1:]:
        if re.match(r"^\d+", part):
            expanded.append(part)
        else:
            expanded.append(base + part)
    return expanded


def token_pattern(subjects: Iterable[str]) -> re.Pattern:
    variants = []
    for subject in subjects:
        normalized = normalize_subject(subject)
        if normalized:
            variants.append(re.escape(normalized).replace(r"\ ", r"\s*"))
            variants.append(re.escape(normalized.replace(" ", "")))
    for extra in ("CMPSC W", "CMPSCW", "CH E W", "CHEW", "ENGR W", "ENGRW", "ME W", "MEW"):
        variants.append(re.escape(extra).replace(r"\ ", r"\s*"))
    subject_re = "|".join(sorted(set(variants), key=len, reverse=True))
    return re.compile(
        rf"(?P<subj>{subject_re})\s*(?P<num>\d{{1,3}}[A-Z]{{0,3}}"
        rf"(?:\s*-\s*(?:\d{{1,3}})?[A-Z]{{1,3}})*)"
        rf"|(?P<bare>\b\d{{1,3}}[A-Z]{{0,3}}(?:\s*-\s*(?:\d{{1,3}})?[A-Z]{{1,3}})*\b)",
        re.I,
    )


def expand_bare_letter_refs(text: str, subjects: Iterable[str]) -> str:
    subject_re = "|".join(
        sorted(
            set(re.escape(normalize_subject(subject)).replace(r"\ ", r"\s*") for subject in subjects),
            key=len,
            reverse=True,
        )
    )
    if not subject_re:
        return text
    pattern = re.compile(
        rf"(?P<subj>{subject_re})\s+(?P<base>\d{{1,3}})(?P<suffix>[A-Z]{{1,3}})"
        rf"\s+(?P<conn>and|or)\s+(?!(?:{subject_re})\s*\d)"
        rf"(?P<bare>[A-Z]{{1,3}})\b",
        re.I,
    )
    previous = None
    iterations = 0
    while previous != text and iterations < 5:
        iterations += 1
        previous = text

        def replace_bare_suffix(match: re.Match) -> str:
            if not match.group("bare").isupper():
                return match.group(0)
            return (
                f"{match.group('subj')} {match.group('base')}{match.group('suffix')} "
                f"{match.group('conn')} {match.group('subj')} {match.group('base')}{match.group('bare')}"
            )

        text = pattern.sub(
            replace_bare_suffix,
            text,
        )
    return text


def dedupe(values: Iterable[str]) -> list[str]:
    seen = set()
    output = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            output.append(value)
    return output


def extract_courses(fragment: str, compiled_token: re.Pattern, subjects: Iterable[str]) -> list[str]:
    courses = []
    last_subject = ""
    for match in compiled_token.finditer(fragment):
        if match.group("subj"):
            last_subject = normalize_matched_subject(match.group("subj"), subjects)
            numbers = expand_number(match.group("num"))
        else:
            if not last_subject:
                continue
            before = fragment[max(0, match.start() - 35) : match.start()].lower()
            if re.search(r"(maximum|minimum|unit|units|completion of|coursework)\s+$", before):
                continue
            numbers = expand_number(match.group("bare"))

        courses.extend(course_id(last_subject, number) for number in numbers)
    return dedupe(courses)


def has_or(fragment: str) -> bool:
    return bool(re.search(r"(?i)\bor\b|/", fragment))


def remove_trailing(values: list[str], suffix: list[str]) -> bool:
    if suffix and values[-len(suffix) :] == suffix:
        del values[-len(suffix) :]
        return True
    return False


def parse_prereqs(raw: str, compiled_token: re.Pattern, subjects: Iterable[str]) -> tuple[list[str], list[list[str]], list[str]]:
    flags = []
    text = strip_non_course_requirements(standardize_subject_names(clean_text(raw)))
    if not text:
        return [], [], flags

    text = expand_bare_letter_refs(text, subjects)
    if re.search(r"(?i)\bat\s+least\s+one\b|\bamong\s+the\s+following\b|\bone\s+of\s+the\s+following\b", text):
        flags.append("at_least_one")
    if re.search(r"(?i)\bor\b", text) and re.search(r"(?i)\band\b", text) and "-" in text:
        flags.append("complex_bundle_or")

    and_prereqs: list[str] = []
    or_groups: list[list[str]] = []
    last_clause_courses: list[str] = []

    for raw_clause in re.split(r"[.;]", text):
        clause = raw_clause.strip(" ,")
        if not clause:
            continue

        leading_or = bool(re.match(r"(?i)^or\b", clause))
        clause = re.sub(r"(?i)^or\b\s*,?\s*", "", clause).strip()
        if not clause:
            continue

        marker = re.search(
            r"(?i)(?:at\s+least\s+one\s+(?:class\s+)?among\s+the\s+following|"
            r"one\s+of\s+the\s+following)\s*:",
            clause,
        )
        if marker:
            before = re.sub(r"(?i)\band\s*$", "", clause[: marker.start()]).strip(" ,")
            after = clause[marker.end() :].strip(" ,")
            before_courses = extract_courses(before, compiled_token, subjects)
            after_courses = extract_courses(after, compiled_token, subjects)
            if before_courses:
                if has_or(before):
                    or_groups.append(before_courses)
                else:
                    and_prereqs.extend(before_courses)
            if after_courses:
                or_groups.append(after_courses)
            last_clause_courses = before_courses + after_courses
            continue

        normalized_clause = re.sub(r"(?i),\s*or\s+", " or ", clause)
        parts = [normalized_clause]
        if has_or(normalized_clause):
            parts = [
                part.strip(" ,")
                for part in re.split(r"\s*,\s*|\s+\band\b\s+", normalized_clause, flags=re.I)
                if part.strip(" ,")
            ]

        clause_courses: list[str] = []
        for part in parts:
            part_courses = extract_courses(part, compiled_token, subjects)
            if not part_courses:
                continue

            if leading_or and last_clause_courses:
                removed = remove_trailing(and_prereqs, last_clause_courses)
                if removed:
                    flags.append("leading_or_bundle")
                or_groups.append(dedupe(last_clause_courses + part_courses))
                leading_or = False
            elif has_or(part):
                or_groups.append(part_courses)
            else:
                and_prereqs.extend(part_courses)
            clause_courses.extend(part_courses)

        if clause_courses:
            last_clause_courses = clause_courses

    return dedupe(and_prereqs), [group for group in (dedupe(group) for group in or_groups) if group], flags


def remove_self_reference(
    own_id: str, and_prereqs: list[str], or_groups: list[list[str]]
) -> tuple[list[str], list[list[str]]]:
    and_prereqs = [course for course in and_prereqs if course != own_id]
    or_groups = [[course for course in group if course != own_id] for group in or_groups]
    return and_prereqs, [group for group in or_groups if group]


def format_prereqs(and_prereqs: list[str], or_groups: list[list[str]]) -> str:
    parts = []
    if and_prereqs:
        parts.append(", ".join(and_prereqs))
    if or_groups:
        parts.append("| " + "; ".join(", ".join(group) for group in or_groups))
    return " ".join(parts)


def generate_rows(records: list[dict], colleges: set[str] | None = None) -> tuple[list[list[str]], CatalogSummary]:
    subjects = sorted(
        {normalize_subject(record.get("subjectCode") or "") for record in records if record.get("subjectCode")}
    )
    compiled_token = token_pattern(subjects)
    rows = []
    flag_counts: Counter = Counter()
    college_counts: Counter = Counter()
    subject_counts: Counter = Counter()
    department_counts: Counter = Counter()
    blank_name_fallbacks = 0
    blank_credit_count = 0
    nonstandard_credit_count = 0

    selected_records, duplicate_ids = select_latest_records(records, colleges)

    for course in selected_records:
        own_id = course_id(course.get("subjectCode") or "", course.get("courseNumber") or "")
        name, used_name_fallback = course_name(course, own_id)
        credits = course_units(course)
        college = (course.get("college") or "").strip()
        subject = normalize_subject(course.get("subjectCode") or "")
        department = department_label(course)
        and_prereqs, or_groups, flags = parse_prereqs(raw_requisite_text(course), compiled_token, subjects)
        and_prereqs, or_groups = remove_self_reference(own_id, and_prereqs, or_groups)
        flag_counts.update(flags)
        college_counts[college] += 1
        subject_counts[subject] += 1
        if department:
            department_counts[department] += 1
        if used_name_fallback:
            blank_name_fallbacks += 1
        if credits == "":
            blank_credit_count += 1
        elif not is_standard_credit_value(credits):
            nonstandard_credit_count += 1

        rows.append(
            [
                own_id,
                name,
                credits,
                college,
                format_prereqs(and_prereqs, or_groups),
                subject,
                department,
            ]
        )

    return rows, CatalogSummary(
        fetched_count=len(records),
        selected_count=len(rows),
        duplicate_ids=duplicate_ids,
        college_counts=college_counts,
        subject_counts=subject_counts,
        department_counts=department_counts,
        flag_counts=flag_counts,
        blank_name_fallbacks=blank_name_fallbacks,
        blank_credit_count=blank_credit_count,
        nonstandard_credit_count=nonstandard_credit_count,
    )


def write_courses_csv(rows: list[list[str]], output_path: Path) -> None:
    with output_path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(["id", "name", "credits", "college", "prereqs", "subject", "department"])
        writer.writerows(rows)


def parse_effective_date(value: str) -> str:
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected YYYY-MM-DD") from exc


def print_counts(label: str, counts: Counter, limit: int = 12) -> None:
    if not counts:
        print(f"{label}: none")
        return

    rendered = ", ".join(f"{name}={count}" for name, count in counts.most_common(limit))
    remaining = len(counts) - limit
    if remaining > 0:
        rendered += f", ... {remaining} more"
    print(f"{label}: {rendered}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        default=str(Path("backend") / "data" / "courses.csv"),
        help="Path to write. Defaults to backend/data/courses.csv.",
    )
    parser.add_argument(
        "--college",
        action="append",
        help="Optional exact college/school label to include. Repeat to include multiple. Defaults to all UCSB catalog rows.",
    )
    parser.add_argument(
        "--effective-date",
        type=parse_effective_date,
        default=dt.date.today().isoformat(),
        help="Catalog effective date in YYYY-MM-DD format. Defaults to today.",
    )
    args = parser.parse_args()

    college_filter = {college.strip() for college in args.college if college.strip()} if args.college else None
    records = fetch_catalog_records(args.effective_date)
    rows, summary = generate_rows(records, college_filter)
    write_courses_csv(rows, Path(args.output))

    scope = "all UCSB catalog rows" if college_filter is None else "college filter: " + ", ".join(sorted(college_filter))
    print(f"Effective date: {args.effective_date}")
    print(f"Fetched {summary.fetched_count} active catalog courses.")
    print(f"Wrote {summary.selected_count} courses ({scope}) to {args.output}.")
    if summary.duplicate_ids:
        sample = ", ".join(summary.duplicate_ids[:12])
        suffix = "" if len(summary.duplicate_ids) <= 12 else f", ... {len(summary.duplicate_ids) - 12} more"
        print(f"Deduplicated normalized course ids: {len(summary.duplicate_ids)} ({sample}{suffix})")
    print_counts("Colleges", summary.college_counts)
    print_counts("Subjects", summary.subject_counts)
    print_counts("Departments", summary.department_counts)
    print(
        "Credit notes: "
        f"blank={summary.blank_credit_count}, "
        f"nonstandard_nonblank={summary.nonstandard_credit_count}"
    )
    if summary.blank_name_fallbacks:
        print(f"Name fallbacks applied: {summary.blank_name_fallbacks}")
    if summary.flag_counts:
        print("Prereq conversion notes: " + ", ".join(f"{name}={count}" for name, count in summary.flag_counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
