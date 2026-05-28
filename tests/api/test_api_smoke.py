#!/usr/bin/env python3
"""Small API smoke check.

If API_BASE_URL is set, the script checks that already-running server.
Otherwise it starts build/requisite-api on a free localhost port and stops it
before exiting.
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import argparse
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import urlopen


REPO_ROOT = Path(__file__).resolve().parents[2]
API_BINARY = REPO_ROOT / "build" / ("requisite-api.exe" if os.name == "nt" else "requisite-api")
FIXTURE_CSV = REPO_ROOT / "tests" / "fixtures" / "courses_graph.csv"


def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


def fetch_json(base_url: str, path: str) -> dict:
    url = base_url.rstrip("/") + path
    try:
        with urlopen(url, timeout=3) as response:
            status = response.status
            body = response.read().decode("utf-8")
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise AssertionError(f"{url} returned HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise AssertionError(f"{url} request failed: {exc}") from exc

    if status != 200:
        raise AssertionError(f"{url} returned HTTP {status}")

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"{url} returned invalid JSON: {body}") from exc


def wait_for_health(base_url: str, process: subprocess.Popen | None) -> dict:
    deadline = time.monotonic() + 10
    last_error = ""

    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            stdout, stderr = process.communicate()
            raise AssertionError(
                "API server exited before becoming healthy.\n"
                f"stdout:\n{stdout}\n"
                f"stderr:\n{stderr}"
            )

        try:
            return fetch_json(base_url, "/health")
        except AssertionError as exc:
            last_error = str(exc)
            time.sleep(0.2)

    raise AssertionError(f"API server did not become healthy: {last_error}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run API smoke checks.")
    parser.add_argument(
        "--data-source",
        choices=("csv", "postgres"),
        default="csv",
        help="Data source to use when this script starts the API server. Ignored when API_BASE_URL is set.",
    )
    return parser.parse_args()


def start_server(data_source: str) -> tuple[str, subprocess.Popen, bool]:
    if not API_BINARY.exists():
        raise AssertionError(f"API binary not found: {API_BINARY}. Run mingw32-make api first.")

    port = find_free_port()
    env = os.environ.copy()
    env["API_PORT"] = str(port)
    env["API_DATA_SOURCE"] = data_source
    launched_fixture_server = data_source == "csv"
    if launched_fixture_server:
        env["COURSES_CSV_PATH"] = str(FIXTURE_CSV)

    process = subprocess.Popen(
        [str(API_BINARY)],
        cwd=REPO_ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return f"http://127.0.0.1:{port}", process, launched_fixture_server


def stop_server(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return

    process.terminate()
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def assert_course_summary(value: dict) -> str:
    course_id = value.get("id")
    if not isinstance(course_id, str) or not course_id:
        raise AssertionError(f"course summary missing id: {value}")
    for field in ("name", "college", "subject"):
        if field not in value:
            raise AssertionError(f"course summary missing {field}: {value}")
    return course_id


def main() -> int:
    args = parse_args()
    provided_base_url = os.environ.get("API_BASE_URL", "").strip()
    process: subprocess.Popen | None = None
    launched_fixture_server = False

    if provided_base_url:
        base_url = provided_base_url
    else:
        base_url, process, launched_fixture_server = start_server(args.data_source)

    try:
        health = wait_for_health(base_url, process)
        if health.get("status") != "ok":
            raise AssertionError(f"unexpected health response: {health}")
        if int(health.get("courseCount", 0)) < 1:
            raise AssertionError(f"health response reported no courses: {health}")

        courses = fetch_json(base_url, "/courses?limit=1")
        course_list = courses.get("courses")
        if not isinstance(course_list, list) or len(course_list) != 1:
            raise AssertionError(f"/courses?limit=1 returned unexpected payload: {courses}")
        course_id = assert_course_summary(course_list[0])

        detail = fetch_json(base_url, f"/courses/{quote(course_id, safe='')}")
        if detail.get("id") != course_id or "prerequisiteGroups" not in detail:
            raise AssertionError(f"course detail returned unexpected payload: {detail}")

        graph_course_id = "CMPSC 170" if launched_fixture_server else course_id
        graph = fetch_json(
            base_url,
            f"/graph?course={quote(graph_course_id, safe='')}&direction=prerequisites&depth=1",
        )
        for field in ("rootCourseId", "direction", "depth", "nodes", "edges"):
            if field not in graph:
                raise AssertionError(f"graph response missing {field}: {graph}")

        if launched_fixture_server:
            expected_edge = {
                "from": "MATH 8",
                "to": "CMPSC 170",
                "relationship": "prerequisite",
                "groupType": "any",
                "groupIndex": 0,
            }
            if expected_edge not in graph.get("edges", []):
                raise AssertionError(f"fixture graph did not preserve expected group-index edge: {graph}")

        print(f"PASS: API smoke checks passed for {base_url}")
        return 0
    finally:
        stop_server(process)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
