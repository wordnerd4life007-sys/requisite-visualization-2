#include "api/CsvCatalog.h"

#include <iostream>
#include <string>
#include <vector>

namespace {
int failures = 0;

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

void expectTrue(const std::string& label, bool condition) {
    if (condition) {
        std::cout << "PASS: " << label << std::endl;
        return;
    }

    ++failures;
    std::cout << "FAIL: " << label << std::endl;
}

void expectOptionIds(
    const std::string& label,
    const std::vector<api::PrerequisiteOption>& options,
    const std::vector<std::string>& expected
) {
    std::vector<std::string> actual;
    for (const api::PrerequisiteOption& option : options) {
        actual.push_back(option.courseId);
    }

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

bool hasGraphEdge(
    const api::GraphResult& graph,
    const std::string& from,
    const std::string& to,
    const std::string& groupType,
    int groupIndex
) {
    for (const api::GraphEdge& edge : graph.edges) {
        if (edge.from == from
            && edge.to == to
            && edge.groupType == groupType
            && edge.groupIndex == groupIndex) {
            return true;
        }
    }

    return false;
}

bool hasGraphEdgeWithRelationship(
    const api::GraphResult& graph,
    const std::string& from,
    const std::string& to,
    const std::string& relationship,
    const std::string& groupType,
    int groupIndex
) {
    for (const api::GraphEdge& edge : graph.edges) {
        if (edge.from == from
            && edge.to == to
            && edge.relationship == relationship
            && edge.groupType == groupType
            && edge.groupIndex == groupIndex) {
            return true;
        }
    }

    return false;
}

bool hasGraphNode(const api::GraphResult& graph, const std::string& courseId) {
    for (const api::GraphNode& node : graph.nodes) {
        if (node.id == courseId) {
            return true;
        }
    }

    return false;
}
} // namespace

int main() {
    api::CsvCatalog catalog;
    std::string error;

    if (!catalog.loadFromFile("tests/fixtures/courses_graph.csv", &error)) {
        std::cerr << "Failed to load fixture catalog: " << error << std::endl;
        return 1;
    }

    expectEqual("fixture course count", catalog.size(), static_cast<std::size_t>(10));

    const api::CourseRecord* course = catalog.findCourse("cmpsc 170");
    expectTrue("course lookup normalizes ids", course != nullptr);
    if (course != nullptr) {
        expectEqual("subject falls back from course id", course->subject, std::string("CMPSC"));
        expectEqual("college metadata loads", course->college, std::string("College of Engineering"));
        expectEqual(
            "description metadata loads",
            course->description,
            std::string("Advanced graph traversal prerequisite planning sample")
        );
    }

    api::CourseSearchFilters descriptionFilters;
    descriptionFilters.query = "prerequisite planning";
    descriptionFilters.limit = 5;
    const std::vector<api::CourseRecord> descriptionMatches = catalog.searchCourses(descriptionFilters);
    expectEqual("description search returns one match", descriptionMatches.size(), static_cast<std::size_t>(1));
    if (!descriptionMatches.empty()) {
        expectEqual("description search finds target course", descriptionMatches[0].id, std::string("CMPSC 170"));
    }

    const std::vector<api::PrerequisiteGroup> groups = catalog.prerequisiteGroupsFor("CMPSC 170");
    expectEqual("required and alternative groups are exposed", groups.size(), static_cast<std::size_t>(3));

    if (groups.size() == 3) {
        expectEqual("required group type", groups[0].groupType, std::string("all"));
        expectEqual("required group index starts at zero", groups[0].groupIndex, 0);
        expectOptionIds("required group option order", groups[0].options, {"CMPSC 40", "CMPSC 32"});

        expectEqual("first alternative group type", groups[1].groupType, std::string("any"));
        expectEqual("first alternative group preserves index", groups[1].groupIndex, 0);
        expectOptionIds("first alternative group option order", groups[1].options, {"MATH 8", "PSTAT 120A"});
        expectTrue("external alternative options are marked", groups[1].options[0].external && groups[1].options[1].external);

        expectEqual("second alternative group type", groups[2].groupType, std::string("any"));
        expectEqual("second alternative group preserves index", groups[2].groupIndex, 1);
        expectOptionIds("second alternative group option order", groups[2].options, {"ECE 139", "PSTAT 120B"});
    }

    const api::GraphResult graph = catalog.graphFor("CMPSC 170", "prerequisites", 1, {}, {});
    expectTrue(
        "graph edge keeps first alternative group index",
        hasGraphEdge(graph, "MATH 8", "CMPSC 170", "any", 0)
    );
    expectTrue(
        "graph edge keeps second alternative group index",
        hasGraphEdge(graph, "ECE 139", "CMPSC 170", "any", 1)
    );

    const api::GraphResult bothGraph = catalog.graphFor("CMPSC 8", "both", 2, {}, {});
    expectTrue(
        "dependent graph edge is labeled dependent",
        hasGraphEdgeWithRelationship(bothGraph, "CMPSC 8", "CMPSC 16", "dependent", "any", 0)
    );
    expectTrue(
        "both graph does not include sibling prerequisites of a dependent",
        !hasGraphNode(bothGraph, "ENGR 3") && !hasGraphNode(bothGraph, "ECE 3")
    );

    const api::PathResult reachablePath = catalog.shortestPath("CMPSC 8", "CMPSC 170");
    expectTrue("dependent path reports reachable target", reachablePath.reachable);
    expectEqual("dependent path distance counts edges", reachablePath.distance, 3);
    expectTrue(
        "dependent path includes expected course ids",
        reachablePath.courseIds.size() == 4
            && reachablePath.courseIds.front() == "CMPSC 8"
            && reachablePath.courseIds.back() == "CMPSC 170"
    );

    const api::PathResult unreachablePath = catalog.shortestPath("CMPSC 170", "CMPSC 8");
    expectTrue("reverse prerequisite path is not reachable", !unreachablePath.reachable);
    expectEqual("unreachable path distance is negative", unreachablePath.distance, -1);
    expectTrue("unreachable path has no course ids", unreachablePath.courseIds.empty());

    return failures == 0 ? 0 : 1;
}
