#include "Graph.h"

#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

namespace {
int failures = 0;

void setCoursesCsvPath() {
    const std::string fixture_path = "tests/fixtures/courses_graph.csv";
#ifdef _WIN32
    if (_putenv_s("COURSES_CSV_PATH", fixture_path.c_str()) != 0) {
#else
    if (setenv("COURSES_CSV_PATH", fixture_path.c_str(), 1) != 0) {
#endif
        std::cerr << "Failed to set COURSES_CSV_PATH" << std::endl;
        std::exit(1);
    }
}

template <typename T>
void expectEqual(const std::string& label, const T& actual, const T& expected) {
    if (actual == expected) {
        std::cout << "PASS: " << label << std::endl;
        return;
    }

    ++failures;
    std::cout << "FAIL: " << label << ": expected " << expected
              << ", got " << actual << std::endl;
}

void expectVectorEqual(
    const std::string& label,
    const std::vector<std::string>& actual,
    const std::vector<std::string>& expected
) {
    if (actual == expected) {
        std::cout << "PASS: " << label << std::endl;
        return;
    }

    ++failures;
    std::cout << "FAIL: " << label << std::endl;
    std::cout << "  expected:";
    for (const std::string& value : expected) {
        std::cout << " [" << value << "]";
    }
    std::cout << std::endl;
    std::cout << "  got:";
    for (const std::string& value : actual) {
        std::cout << " [" << value << "]";
    }
    std::cout << std::endl;
}

void expectGroupEqual(
    const std::string& label,
    const std::vector<std::vector<std::string>>& actual,
    const std::vector<std::vector<std::string>>& expected
) {
    if (actual == expected) {
        std::cout << "PASS: " << label << std::endl;
        return;
    }

    ++failures;
    std::cout << "FAIL: " << label << std::endl;
    std::cout << "  expected group count: " << expected.size()
              << ", got: " << actual.size() << std::endl;
}
}

int main() {
    setCoursesCsvPath();

    Graph graph;
    graph.buildGraph();

    expectEqual("shortest path through required prerequisites",
        graph.CountPaths("CMPSC 8", "CMPSC 32"), 3);
    expectEqual("shortest path uses flattened OR prerequisite edges",
        graph.CountPaths("MATH 8", "CMPSC 170"), 1);
    expectEqual("unreachable course returns -1",
        graph.CountPaths("CMPSC 5A", "CMPSC 32"), -1);

    expectVectorEqual("direct prerequisite list",
        graph.grabPreReqs("CMPSC 24"),
        {"CMPSC 16"});

    const PrereqGroups groups = graph.grabPreReqGroups("CMPSC 170");
    expectVectorEqual("required prerequisite group is preserved",
        groups.andPrereqs,
        {"CMPSC 40", "CMPSC 32"});
    expectGroupEqual("alternative prerequisite groups are preserved",
        groups.orGroups,
        {
            {"MATH 8", "PSTAT 120A"},
            {"ECE 139", "PSTAT 120B"},
        });
    if (groups.orGroups.size() == 2) {
        expectVectorEqual("alternative group index 0 stays first",
            groups.orGroups[0],
            {"MATH 8", "PSTAT 120A"});
        expectVectorEqual("alternative group index 1 stays second",
            groups.orGroups[1],
            {"ECE 139", "PSTAT 120B"});
    } else {
        ++failures;
        std::cout << "FAIL: alternative group index coverage requires exactly two groups" << std::endl;
    }
    expectVectorEqual("flattened prerequisite list includes required and alternatives",
        groups.allPrereqs(),
        {"CMPSC 40", "CMPSC 32", "MATH 8", "PSTAT 120A", "ECE 139", "PSTAT 120B"});

    return failures == 0 ? 0 : 1;
}
