#include "api/ApiJson.h"

#include <cmath>
#include <iomanip>
#include <optional>
#include <sstream>
#include <string>

namespace api {
namespace {

std::string escapeJsonString(const std::string& value) {
    std::ostringstream escaped;

    for (unsigned char ch : value) {
        switch (ch) {
            case '"':
                escaped << "\\\"";
                break;
            case '\\':
                escaped << "\\\\";
                break;
            case '\b':
                escaped << "\\b";
                break;
            case '\f':
                escaped << "\\f";
                break;
            case '\n':
                escaped << "\\n";
                break;
            case '\r':
                escaped << "\\r";
                break;
            case '\t':
                escaped << "\\t";
                break;
            default:
                if (ch < 0x20) {
                    escaped << "\\u"
                            << std::hex << std::setw(4) << std::setfill('0')
                            << static_cast<int>(ch)
                            << std::dec << std::setfill(' ');
                } else {
                    escaped << static_cast<char>(ch);
                }
        }
    }

    return escaped.str();
}

std::string creditsJson(const std::optional<double>& credits) {
    if (!credits.has_value()) {
        return "null";
    }

    std::ostringstream out;
    const double value = credits.value();
    if (std::floor(value) == value) {
        out << static_cast<long long>(value);
    } else {
        out << value;
    }
    return out.str();
}

std::string courseFieldsJson(const CourseRecord& course, bool includeName) {
    std::ostringstream out;
    out << "\"id\":" << jsonString(course.id);
    if (includeName) {
        out << ",\"name\":" << jsonString(course.name);
    }
    out << ",\"credits\":" << creditsJson(course.credits)
        << ",\"college\":" << jsonStringOrNull(course.college)
        << ",\"department\":" << jsonStringOrNull(course.department)
        << ",\"subject\":" << jsonStringOrNull(course.subject);
    return out.str();
}

std::string optionJson(const PrerequisiteOption& option) {
    std::ostringstream out;
    out << "{\"courseId\":" << jsonString(option.courseId)
        << ",\"external\":" << (option.external ? "true" : "false")
        << "}";
    return out.str();
}

std::string groupJson(const PrerequisiteGroup& group) {
    std::ostringstream out;
    out << "{\"groupType\":" << jsonString(group.groupType)
        << ",\"groupIndex\":" << group.groupIndex
        << ",\"options\":[";

    for (std::size_t i = 0; i < group.options.size(); ++i) {
        if (i > 0) {
            out << ",";
        }
        out << optionJson(group.options[i]);
    }

    out << "]}";
    return out.str();
}

std::string stringArrayJson(const std::vector<std::string>& values) {
    std::ostringstream out;
    out << "[";
    for (std::size_t i = 0; i < values.size(); ++i) {
        if (i > 0) {
            out << ",";
        }
        out << jsonString(values[i]);
    }
    out << "]";
    return out.str();
}

} // namespace

std::string jsonString(const std::string& value) {
    return "\"" + escapeJsonString(value) + "\"";
}

std::string jsonStringOrNull(const std::string& value) {
    if (value.empty()) {
        return "null";
    }
    return jsonString(value);
}

std::string jsonError(const std::string& code, const std::string& message) {
    std::ostringstream out;
    out << "{\"error\":{\"code\":" << jsonString(code)
        << ",\"message\":" << jsonString(message)
        << "}}";
    return out.str();
}

std::string courseSummaryJson(const CourseRecord& course) {
    std::ostringstream out;
    out << "{" << courseFieldsJson(course, true) << "}";
    return out.str();
}

std::string courseDetailJson(
    const CourseRecord& course,
    const std::vector<PrerequisiteGroup>& prerequisiteGroups
) {
    std::ostringstream out;
    out << "{" << courseFieldsJson(course, true)
        << ",\"prerequisiteGroups\":" << prerequisiteGroupsJson(prerequisiteGroups)
        << "}";
    return out.str();
}

std::string prerequisiteGroupsJson(const std::vector<PrerequisiteGroup>& groups) {
    std::ostringstream out;
    out << "[";
    for (std::size_t i = 0; i < groups.size(); ++i) {
        if (i > 0) {
            out << ",";
        }
        out << groupJson(groups[i]);
    }
    out << "]";
    return out.str();
}

std::string prerequisiteResponseJson(
    const std::string& courseId,
    const std::vector<PrerequisiteGroup>& groups,
    const std::vector<std::string>& flattenedCourseIds
) {
    std::ostringstream out;
    out << "{\"courseId\":" << jsonString(courseId)
        << ",\"groups\":" << prerequisiteGroupsJson(groups)
        << ",\"flattenedCourseIds\":" << stringArrayJson(flattenedCourseIds)
        << "}";
    return out.str();
}

std::string dependentResponseJson(
    const std::string& courseId,
    const std::vector<DependentRelationship>& relationships,
    const std::vector<std::string>& flattenedCourseIds
) {
    std::ostringstream out;
    out << "{\"courseId\":" << jsonString(courseId)
        << ",\"relationships\":[";

    for (std::size_t i = 0; i < relationships.size(); ++i) {
        if (i > 0) {
            out << ",";
        }

        const DependentRelationship& relationship = relationships[i];
        out << "{\"courseId\":" << jsonString(relationship.courseId)
            << ",\"groupType\":" << jsonString(relationship.groupType)
            << ",\"groupIndex\":" << relationship.groupIndex
            << ",\"external\":" << (relationship.external ? "true" : "false")
            << "}";
    }

    out << "],\"flattenedCourseIds\":" << stringArrayJson(flattenedCourseIds)
        << "}";
    return out.str();
}

std::string graphResponseJson(const GraphResult& graph) {
    std::ostringstream out;
    out << "{\"rootCourseId\":" << jsonString(graph.rootCourseId)
        << ",\"direction\":" << jsonString(graph.direction)
        << ",\"depth\":" << graph.depth
        << ",\"nodes\":[";

    for (std::size_t i = 0; i < graph.nodes.size(); ++i) {
        if (i > 0) {
            out << ",";
        }

        const GraphNode& node = graph.nodes[i];
        out << "{\"id\":" << jsonString(node.id)
            << ",\"label\":" << jsonString(node.label)
            << ",\"name\":" << jsonStringOrNull(node.name)
            << ",\"external\":" << (node.external ? "true" : "false")
            << ",\"college\":" << jsonStringOrNull(node.college)
            << ",\"department\":" << jsonStringOrNull(node.department)
            << ",\"subject\":" << jsonStringOrNull(node.subject)
            << "}";
    }

    out << "],\"edges\":[";

    for (std::size_t i = 0; i < graph.edges.size(); ++i) {
        if (i > 0) {
            out << ",";
        }

        const GraphEdge& edge = graph.edges[i];
        out << "{\"from\":" << jsonString(edge.from)
            << ",\"to\":" << jsonString(edge.to)
            << ",\"relationship\":" << jsonString(edge.relationship)
            << ",\"groupType\":" << jsonString(edge.groupType)
            << ",\"groupIndex\":" << edge.groupIndex
            << "}";
    }

    out << "]}";
    return out.str();
}

} // namespace api
