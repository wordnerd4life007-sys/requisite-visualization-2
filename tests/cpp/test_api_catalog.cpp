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

    return failures == 0 ? 0 : 1;
}
