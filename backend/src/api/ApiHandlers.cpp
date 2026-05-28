#include "api/ApiHandlers.h"

#include "api/ApiJson.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <sstream>
#include <string>
#include <unordered_set>

namespace api {
namespace {

constexpr std::size_t DefaultCourseLimit = 100;
constexpr std::size_t MaxCourseLimit = 20000;
constexpr int DefaultGraphDepth = 1;
constexpr int MaxGraphDepth = 6;

std::string toLower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    return value;
}

bool startsWith(const std::string& value, const std::string& prefix) {
    return value.size() >= prefix.size() && value.compare(0, prefix.size(), prefix) == 0;
}

bool endsWith(const std::string& value, const std::string& suffix) {
    return value.size() >= suffix.size()
        && value.compare(value.size() - suffix.size(), suffix.size(), suffix) == 0;
}

int hexValue(char ch) {
    if (ch >= '0' && ch <= '9') {
        return ch - '0';
    }
    if (ch >= 'a' && ch <= 'f') {
        return ch - 'a' + 10;
    }
    if (ch >= 'A' && ch <= 'F') {
        return ch - 'A' + 10;
    }
    return -1;
}

std::string urlDecode(const std::string& value, bool plusAsSpace) {
    std::string decoded;
    decoded.reserve(value.size());

    for (std::size_t i = 0; i < value.size(); ++i) {
        const char ch = value[i];
        if (ch == '%' && i + 2 < value.size()) {
            const int high = hexValue(value[i + 1]);
            const int low = hexValue(value[i + 2]);
            if (high >= 0 && low >= 0) {
                decoded.push_back(static_cast<char>((high << 4) + low));
                i += 2;
                continue;
            }
        }

        if (plusAsSpace && ch == '+') {
            decoded.push_back(' ');
        } else {
            decoded.push_back(ch);
        }
    }

    return decoded;
}

std::pair<std::string, std::string> splitTarget(const std::string& target) {
    const std::size_t separator = target.find('?');
    if (separator == std::string::npos) {
        return {target, ""};
    }
    return {target.substr(0, separator), target.substr(separator + 1)};
}

ApiHandlers::QueryParams parseQueryString(const std::string& queryString) {
    ApiHandlers::QueryParams query;
    std::size_t start = 0;

    while (start <= queryString.size()) {
        const std::size_t end = queryString.find('&', start);
        const std::string part = queryString.substr(
            start,
            end == std::string::npos ? std::string::npos : end - start
        );

        if (!part.empty()) {
            const std::size_t equals = part.find('=');
            const std::string rawKey = equals == std::string::npos ? part : part.substr(0, equals);
            const std::string rawValue = equals == std::string::npos ? "" : part.substr(equals + 1);
            query[toLower(urlDecode(rawKey, true))].push_back(urlDecode(rawValue, true));
        }

        if (end == std::string::npos) {
            break;
        }
        start = end + 1;
    }

    return query;
}

std::string firstValue(const ApiHandlers::QueryParams& query, const std::string& name) {
    const auto found = query.find(name);
    if (found == query.end() || found->second.empty()) {
        return "";
    }
    return found->second.front();
}

std::vector<std::string> allValues(
    const ApiHandlers::QueryParams& query,
    const std::string& primaryName,
    const std::string& fallbackName
) {
    std::vector<std::string> values;

    const auto append = [&](const std::string& name) {
        const auto found = query.find(name);
        if (found == query.end()) {
            return;
        }
        values.insert(values.end(), found->second.begin(), found->second.end());
    };

    append(primaryName);
    append(fallbackName);
    return values;
}

std::vector<std::string> splitCommaValues(const std::vector<std::string>& values) {
    std::vector<std::string> result;

    for (const std::string& value : values) {
        std::stringstream stream(value);
        std::string part;
        while (std::getline(stream, part, ',')) {
            std::size_t start = 0;
            while (start < part.size() && std::isspace(static_cast<unsigned char>(part[start]))) {
                ++start;
            }

            std::size_t end = part.size();
            while (end > start && std::isspace(static_cast<unsigned char>(part[end - 1]))) {
                --end;
            }

            const std::string trimmed = part.substr(start, end - start);
            if (!trimmed.empty()) {
                result.push_back(trimmed);
            }
        }
    }

    return result;
}

bool parseUnsignedLimit(
    const std::string& value,
    std::size_t defaultValue,
    std::size_t maximum,
    std::size_t& parsed
) {
    if (value.empty()) {
        parsed = defaultValue;
        return true;
    }

    char* end = nullptr;
    const unsigned long result = std::strtoul(value.c_str(), &end, 10);
    if (end == value.c_str() || *end != '\0' || result > maximum) {
        return false;
    }

    parsed = static_cast<std::size_t>(result);
    return true;
}

bool parseDepth(const std::string& value, int& depth) {
    if (value.empty()) {
        depth = DefaultGraphDepth;
        return true;
    }

    char* end = nullptr;
    const long result = std::strtol(value.c_str(), &end, 10);
    if (end == value.c_str() || *end != '\0' || result < 0 || result > MaxGraphDepth) {
        return false;
    }

    depth = static_cast<int>(result);
    return true;
}

ApiResponse jsonResponse(int status, const std::string& body) {
    ApiResponse response;
    response.status = status;
    response.body = body;
    return response;
}

ApiResponse errorResponse(int status, const std::string& code, const std::string& message) {
    return jsonResponse(status, jsonError(code, message));
}

std::vector<std::string> uniqueStrings(const std::vector<std::string>& values) {
    std::vector<std::string> result;
    std::unordered_set<std::string> seen;
    for (const std::string& value : values) {
        if (seen.insert(value).second) {
            result.push_back(value);
        }
    }
    return result;
}

} // namespace

ApiHandlers::ApiHandlers(const CourseCatalog& catalog)
    : catalog_(catalog) {}

ApiResponse ApiHandlers::handleRequest(const std::string& method, const std::string& target) const {
    if (method == "OPTIONS") {
        ApiResponse response;
        response.status = 204;
        response.body = "";
        return response;
    }

    if (method != "GET") {
        return errorResponse(405, "method_not_allowed", "Only GET and OPTIONS are supported.");
    }

    const auto split = splitTarget(target);
    const std::string path = split.first.empty() ? "/" : split.first;
    const QueryParams query = parseQueryString(split.second);

    if (path == "/health") {
        std::ostringstream body;
        body << "{\"status\":\"ok\",\"source\":" << jsonString(catalog_.sourcePath())
             << ",\"courseCount\":" << catalog_.size()
             << "}";
        return jsonResponse(200, body.str());
    }

    if (path == "/courses") {
        return handleCourses(query);
    }

    if (startsWith(path, "/courses/")) {
        return handleCourseRoute(path);
    }

    if (path == "/graph") {
        return handleGraph(query);
    }

    return errorResponse(404, "not_found", "Endpoint not found.");
}

ApiResponse ApiHandlers::handleCourses(const QueryParams& query) const {
    std::string errorCode;
    std::string errorMessage;
    CourseSearchFilters filters = parseCourseFilters(query, errorCode, errorMessage);
    if (!errorCode.empty()) {
        return errorResponse(400, errorCode, errorMessage);
    }

    const std::vector<CourseRecord> courses = catalog_.searchCourses(filters);
    std::ostringstream body;
    body << "{\"courses\":[";
    for (std::size_t i = 0; i < courses.size(); ++i) {
        if (i > 0) {
            body << ",";
        }
        body << courseSummaryJson(courses[i]);
    }
    body << "],\"count\":" << courses.size()
         << ",\"limit\":" << filters.limit
         << "}";
    return jsonResponse(200, body.str());
}

ApiResponse ApiHandlers::handleCourseRoute(const std::string& path) const {
    constexpr const char* CoursesPrefix = "/courses/";
    constexpr const char* PrerequisitesSuffix = "/prerequisites";
    constexpr const char* DependentsSuffix = "/dependents";

    std::string remainder = path.substr(std::string(CoursesPrefix).size());
    std::string encodedId;
    enum class DetailKind { Course, Prerequisites, Dependents };
    DetailKind detailKind = DetailKind::Course;

    if (endsWith(remainder, PrerequisitesSuffix)) {
        encodedId = remainder.substr(0, remainder.size() - std::string(PrerequisitesSuffix).size());
        detailKind = DetailKind::Prerequisites;
    } else if (endsWith(remainder, DependentsSuffix)) {
        encodedId = remainder.substr(0, remainder.size() - std::string(DependentsSuffix).size());
        detailKind = DetailKind::Dependents;
    } else if (remainder.find('/') == std::string::npos) {
        encodedId = remainder;
    } else {
        return errorResponse(404, "not_found", "Endpoint not found.");
    }

    const std::string courseId = normalizeCourseId(urlDecode(encodedId, false));
    const CourseRecord* course = catalog_.findCourse(courseId);
    if (course == nullptr) {
        return errorResponse(404, "course_not_found", "Course not found.");
    }

    if (detailKind == DetailKind::Course) {
        return jsonResponse(200, courseDetailJson(*course, catalog_.prerequisiteGroupsFor(courseId)));
    }

    if (detailKind == DetailKind::Prerequisites) {
        return jsonResponse(
            200,
            prerequisiteResponseJson(
                courseId,
                catalog_.prerequisiteGroupsFor(courseId),
                catalog_.flattenedPrerequisitesFor(courseId)
            )
        );
    }

    const std::vector<DependentRelationship> dependents = catalog_.dependentsFor(courseId);
    std::vector<std::string> flattened;
    flattened.reserve(dependents.size());
    for (const DependentRelationship& dependent : dependents) {
        flattened.push_back(dependent.courseId);
    }

    return jsonResponse(
        200,
        dependentResponseJson(courseId, dependents, uniqueStrings(flattened))
    );
}

ApiResponse ApiHandlers::handleGraph(const QueryParams& query) const {
    const std::string courseId = normalizeCourseId(firstValue(query, "course"));
    if (courseId.empty()) {
        return errorResponse(400, "missing_course", "The course query parameter is required.");
    }

    if (!catalog_.containsCourse(courseId)) {
        return errorResponse(404, "course_not_found", "Course not found.");
    }

    std::string direction = toLower(firstValue(query, "direction"));
    if (direction.empty()) {
        direction = "both";
    }

    if (direction != "prerequisites" && direction != "dependents" && direction != "both") {
        return errorResponse(400, "invalid_direction", "Direction must be prerequisites, dependents, or both.");
    }

    int depth = DefaultGraphDepth;
    if (!parseDepth(firstValue(query, "depth"), depth)) {
        return errorResponse(400, "invalid_depth", "Depth must be between 0 and 6.");
    }

    std::unordered_set<std::string> subjects;
    for (const std::string& subject : splitCommaValues(allValues(query, "subjects", "subject"))) {
        subjects.insert(normalizeSubject(subject));
    }

    std::unordered_set<std::string> colleges;
    for (const std::string& college : splitCommaValues(allValues(query, "colleges", "college"))) {
        colleges.insert(normalizeCollege(college));
    }

    return jsonResponse(200, graphResponseJson(catalog_.graphFor(courseId, direction, depth, subjects, colleges)));
}

CourseSearchFilters ApiHandlers::parseCourseFilters(
    const QueryParams& query,
    std::string& errorCode,
    std::string& errorMessage
) const {
    CourseSearchFilters filters;
    filters.query = firstValue(query, "q");

    if (!parseUnsignedLimit(firstValue(query, "limit"), DefaultCourseLimit, MaxCourseLimit, filters.limit)) {
        errorCode = "invalid_limit";
        errorMessage = "Limit must be between 0 and 20000.";
        return filters;
    }

    for (const std::string& subject : splitCommaValues(allValues(query, "subjects", "subject"))) {
        filters.subjects.insert(normalizeSubject(subject));
    }

    for (const std::string& college : splitCommaValues(allValues(query, "colleges", "college"))) {
        filters.colleges.insert(normalizeCollege(college));
    }

    return filters;
}

} // namespace api
