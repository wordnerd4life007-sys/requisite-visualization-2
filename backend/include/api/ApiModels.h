#pragma once

#include <optional>
#include <string>
#include <unordered_set>
#include <vector>

namespace api {

struct CourseRecord {
    std::string id;
    std::string name;
    std::optional<double> credits;
    std::string college;
    std::string department;
    std::string subject;
};

struct PrerequisiteOption {
    std::string courseId;
    bool external = false;
};

struct PrerequisiteGroup {
    std::string groupType;
    int groupIndex = 0;
    std::vector<PrerequisiteOption> options;
};

struct DependentRelationship {
    std::string courseId;
    std::string groupType;
    int groupIndex = 0;
    bool external = false;
};

struct CourseSearchFilters {
    std::string query;
    std::unordered_set<std::string> subjects;
    std::unordered_set<std::string> colleges;
    std::size_t limit = 100;
};

struct GraphNode {
    std::string id;
    std::string label;
    std::string name;
    bool external = false;
    std::string college;
    std::string department;
    std::string subject;
};

struct GraphEdge {
    std::string from;
    std::string to;
    std::string relationship;
    std::string groupType;
    int groupIndex = 0;
};

struct GraphResult {
    std::string rootCourseId;
    std::string direction;
    int depth = 1;
    std::vector<GraphNode> nodes;
    std::vector<GraphEdge> edges;
};

struct ApiResponse {
    int status = 200;
    std::string body;
    std::string contentType = "application/json";
};

} // namespace api
