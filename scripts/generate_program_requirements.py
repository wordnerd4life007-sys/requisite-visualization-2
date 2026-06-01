#!/usr/bin/env python3
"""Fetch and normalize UCSB Coursedog program requirement metadata."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import requests


CATALOG_ID = "mZXlGvYb30h2fSq3aYLn"
PROGRAM_SEARCH_URL = "https://app.coursedog.com/api/v1/cm/ucsb/programs/search/%24filters"
CATALOG_LIMIT = 50000
PROGRAM_COLUMNS = [
    "_id",
    "id",
    "name",
    "programGroupId",
    "degreeDesignation",
    "programType",
    "college",
    "department",
    "departments",
    "effectiveStartDate",
    "effectiveEndDate",
    "requisites",
    "documents",
    "requirementDocument",
]

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Origin": "https://catalog.ucsb.edu",
    "Referer": "https://catalog.ucsb.edu/programs",
    "User-Agent": "Mozilla/5.0",
}

FILTERS = {
    "filters": [
        {
            "id": "name-program",
            "condition": "field",
            "name": "name",
            "inputType": "text",
            "group": "program",
            "type": "isNotEmpty",
        }
    ],
    "condition": "and",
}


@dataclass(frozen=True)
class ProgramSummary:
    fetched_count: int
    selected_count: int
    undergraduate_count: int
    bachelor_count: int
    structured_requisite_count: int
    document_count: int


def build_program_url(effective_date: str) -> str:
    query = {
        "catalogId": CATALOG_ID,
        "skip": "0",
        "limit": str(CATALOG_LIMIT),
        "orderBy": "name",
        "effectiveDatesRange": f"{effective_date},{effective_date}",
        "ignoreEffectiveDating": "false",
        "columns": ",".join(PROGRAM_COLUMNS),
    }
    return f"{PROGRAM_SEARCH_URL}?{urlencode(query)}"


def fetch_program_records(effective_date: str | None = None) -> list[dict[str, Any]]:
    effective_date = effective_date or dt.date.today().isoformat()
    response = requests.post(build_program_url(effective_date), json=FILTERS, headers=HEADERS, timeout=120)
    response.raise_for_status()
    payload = response.json()
    return payload["data"] if isinstance(payload, dict) and isinstance(payload.get("data"), list) else []


def normalize_program_records(records: list[dict[str, Any]], catalog_year: str) -> tuple[list[dict[str, Any]], ProgramSummary]:
    normalized = [normalize_program_record(record, catalog_year) for record in records if program_name(record)]
    normalized.sort(key=lambda program: (program["name"], program["programId"]))

    undergraduate_count = sum(1 for program in normalized if program["level"] == "undergraduate")
    bachelor_count = sum(1 for program in normalized if program["degreeLevel"] == "bachelor")
    structured_requisite_count = sum(1 for program in normalized if program["hasStructuredRequirements"])
    document_count = sum(1 for program in normalized if program["documents"])

    return normalized, ProgramSummary(
        fetched_count=len(records),
        selected_count=len(normalized),
        undergraduate_count=undergraduate_count,
        bachelor_count=bachelor_count,
        structured_requisite_count=structured_requisite_count,
        document_count=document_count,
    )


def normalize_program_record(record: dict[str, Any], catalog_year: str) -> dict[str, Any]:
    requisites = record.get("requisites") if isinstance(record.get("requisites"), dict) else {}
    documents = normalize_documents(record)
    degree_designation = compact(record.get("degreeDesignation"))

    return {
        "programId": compact(record.get("programGroupId")) or compact(record.get("_id")) or compact(record.get("id")),
        "sourceRecordId": compact(record.get("_id")) or compact(record.get("id")),
        "catalogYear": catalog_year,
        "name": program_name(record),
        "college": compact(record.get("college")),
        "department": department_label(record),
        "level": program_level(record),
        "degreeDesignation": degree_designation,
        "degreeLevel": degree_level(record),
        "effectiveStartDate": compact(record.get("effectiveStartDate")),
        "effectiveEndDate": compact(record.get("effectiveEndDate")),
        "hasStructuredRequirements": bool(requisites),
        "structuredRequirementKeys": sorted(requisites.keys()),
        "documents": documents,
        "raw": record,
    }


def program_name(record: dict[str, Any]) -> str:
    return compact(record.get("name"))


def program_level(record: dict[str, Any]) -> str:
    value = f"{compact(record.get('programType'))} {compact(record.get('career'))}".lower()
    if "undergraduate" in value:
        return "undergraduate"
    if "graduate" in value:
        return "graduate"
    return "unknown"


def degree_level(record: dict[str, Any]) -> str:
    value = f"{compact(record.get('degreeDesignation'))} {program_name(record)}".lower()
    if "bachelor" in value or ", b." in value or value.endswith(" b.a.") or value.endswith(" b.s."):
        return "bachelor"
    if "minor" in value:
        return "minor"
    if "master" in value:
        return "master"
    if "doctor" in value or "ph.d" in value:
        return "doctoral"
    return "unknown"


def department_label(record: dict[str, Any]) -> str:
    direct = compact(record.get("department"))
    if direct:
        return direct

    departments = record.get("departments")
    if not isinstance(departments, list):
        return ""

    labels: list[str] = []
    for department in departments:
        if isinstance(department, dict):
            label = compact(department.get("name") or department.get("label") or department.get("title"))
        else:
            label = compact(department)
        if label and label not in labels:
            labels.append(label)
    return "; ".join(labels)


def normalize_documents(record: dict[str, Any]) -> list[dict[str, str]]:
    documents: list[dict[str, str]] = []
    raw_documents = record.get("documents")
    if isinstance(raw_documents, list):
        for item in raw_documents:
            document = normalize_document(item)
            if document:
                documents.append(document)

    requirement_document = normalize_document(record.get("requirementDocument"))
    if requirement_document:
        documents.append(requirement_document)

    deduped: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for document in documents:
        url = document.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            deduped.append(document)
    return deduped


def normalize_document(value: Any) -> dict[str, str] | None:
    if isinstance(value, str):
        url = compact(value)
        return {"name": "Requirement document", "url": url} if url else None
    if not isinstance(value, dict):
        return None

    url = compact(value.get("url") or value.get("href") or value.get("link"))
    if not url:
        return None
    return {
        "name": compact(value.get("name") or value.get("title")) or "Requirement document",
        "url": url,
    }


def compact(value: Any) -> str:
    return " ".join(str(value or "").split())


def parse_effective_date(value: str) -> str:
    try:
        return dt.date.fromisoformat(value).isoformat()
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected YYYY-MM-DD") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("backend") / "data" / "programs.json")
    parser.add_argument("--input-json", type=Path, help="Use a saved Coursedog program response or raw list.")
    parser.add_argument("--effective-date", type=parse_effective_date, default=dt.date.today().isoformat())
    parser.add_argument("--catalog-year", default="2025-2026")
    parser.add_argument("--limit", type=int, help="Optional limit for exploratory snapshots.")
    args = parser.parse_args()

    if args.input_json:
        payload = json.loads(args.input_json.read_text(encoding="utf-8"))
        records = payload.get("data", payload) if isinstance(payload, dict) else payload
    else:
        records = fetch_program_records(args.effective_date)

    if not isinstance(records, list):
        raise SystemExit("Program input must be a JSON list or an object with a data list.")
    if args.limit is not None:
        records = records[: max(0, args.limit)]

    programs, summary = normalize_program_records(records, args.catalog_year)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"programs": programs}, indent=2, sort_keys=True), encoding="utf-8")

    print(f"Effective date: {args.effective_date}")
    print(f"Catalog year: {args.catalog_year}")
    print(f"Fetched {summary.fetched_count} program records.")
    print(f"Wrote {summary.selected_count} normalized programs to {args.output}.")
    print(f"Undergraduate programs: {summary.undergraduate_count}")
    print(f"Bachelor-level programs: {summary.bachelor_count}")
    print(f"Structured requirement records: {summary.structured_requisite_count}")
    print(f"Programs with requirement documents: {summary.document_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
