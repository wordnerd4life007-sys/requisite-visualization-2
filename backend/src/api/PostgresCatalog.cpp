#include "api/PostgresCatalog.h"

#include <libpq-fe.h>

#include <cctype>
#include <cstdlib>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace api {
namespace {

struct ConnectionHandle {
    PGconn* value = nullptr;

    ~ConnectionHandle() {
        if (value != nullptr) {
            PQfinish(value);
        }
    }
};

struct ResultHandle {
    PGresult* value = nullptr;

    ~ResultHandle() {
        if (value != nullptr) {
            PQclear(value);
        }
    }
};

std::string pgValue(PGresult* result, int row, int column) {
    if (PQgetisnull(result, row, column)) {
        return "";
    }
    return PQgetvalue(result, row, column);
}

std::optional<double> parseCredits(const std::string& value) {
    if (value.empty()) {
        return std::nullopt;
    }

    char* end = nullptr;
    const double parsed = std::strtod(value.c_str(), &end);
    if (end == value.c_str()) {
        return std::nullopt;
    }

    while (*end != '\0') {
        if (!std::isspace(static_cast<unsigned char>(*end))) {
            return std::nullopt;
        }
        ++end;
    }

    return parsed;
}

bool runTupleQuery(PGconn* connection, const std::string& sql, ResultHandle& result, std::string* errorMessage) {
    result.value = PQexec(connection, sql.c_str());
    if (PQresultStatus(result.value) == PGRES_TUPLES_OK) {
        return true;
    }

    if (errorMessage != nullptr) {
        *errorMessage = PQerrorMessage(connection);
    }
    return false;
}

} // namespace

bool PostgresCatalog::load(const DatabaseConfig& config, std::string* errorMessage) {
    if (!config.isValid()) {
        if (errorMessage != nullptr) {
            const std::vector<std::string> errors = config.validationErrors();
            *errorMessage = errors.empty() ? "Invalid database configuration." : errors.front();
        }
        return false;
    }

    ConnectionHandle connection;
    connection.value = PQconnectdb(config.libpqConnectionString(true).c_str());
    if (connection.value == nullptr || PQstatus(connection.value) != CONNECTION_OK) {
        if (errorMessage != nullptr) {
            *errorMessage = connection.value == nullptr
                ? "Unable to allocate PostgreSQL connection."
                : PQerrorMessage(connection.value);
        }
        return false;
    }

    ResultHandle coursesResult;
    if (!runTupleQuery(
            connection.value,
            "SELECT id, name, credits, college, subject, department "
            "FROM courses "
            "ORDER BY id",
            coursesResult,
            errorMessage
        )) {
        return false;
    }

    std::vector<CourseRecord> courses;
    courses.reserve(static_cast<std::size_t>(PQntuples(coursesResult.value)));
    for (int row = 0; row < PQntuples(coursesResult.value); ++row) {
        CourseRecord course;
        course.id = pgValue(coursesResult.value, row, 0);
        course.name = pgValue(coursesResult.value, row, 1);
        course.credits = parseCredits(pgValue(coursesResult.value, row, 2));
        course.college = pgValue(coursesResult.value, row, 3);
        course.subject = pgValue(coursesResult.value, row, 4);
        course.department = pgValue(coursesResult.value, row, 5);
        courses.push_back(course);
    }

    if (courses.empty()) {
        if (errorMessage != nullptr) {
            *errorMessage = "PostgreSQL catalog is empty. Import backend/data/courses.csv before starting the API.";
        }
        return false;
    }

    ResultHandle prereqResult;
    if (!runTupleQuery(
            connection.value,
            "SELECT groups.course_id, groups.group_position, groups.group_kind, "
            "options.option_position, options.prerequisite_id "
            "FROM course_prerequisite_groups AS groups "
            "JOIN course_prerequisite_options AS options "
            "ON options.course_id = groups.course_id "
            "AND options.group_position = groups.group_position "
            "ORDER BY groups.course_id, groups.group_position, options.option_position",
            prereqResult,
            errorMessage
        )) {
        return false;
    }

    std::unordered_map<std::string, std::vector<PrerequisiteGroup>> groupsByCourse;
    std::unordered_map<std::string, int> groupIndexes;
    std::unordered_map<std::string, int> nextAnyIndexByCourse;

    for (int row = 0; row < PQntuples(prereqResult.value); ++row) {
        const std::string courseId = normalizeCourseId(pgValue(prereqResult.value, row, 0));
        const std::string groupPosition = pgValue(prereqResult.value, row, 1);
        const std::string groupKind = pgValue(prereqResult.value, row, 2);
        const std::string prerequisiteId = normalizeCourseId(pgValue(prereqResult.value, row, 4));
        if (courseId.empty() || prerequisiteId.empty()) {
            continue;
        }

        const std::string groupKey = courseId + "\n" + groupPosition;
        auto groupIndexFound = groupIndexes.find(groupKey);
        if (groupIndexFound == groupIndexes.end()) {
            PrerequisiteGroup group;
            group.groupType = groupKind == "any" ? "any" : "all";
            group.groupIndex = group.groupType == "any" ? nextAnyIndexByCourse[courseId]++ : 0;
            groupsByCourse[courseId].push_back(group);
            const int insertedIndex = static_cast<int>(groupsByCourse[courseId].size() - 1);
            groupIndexes[groupKey] = insertedIndex;
            groupIndexFound = groupIndexes.find(groupKey);
        }

        groupsByCourse[courseId][static_cast<std::size_t>(groupIndexFound->second)].options.push_back({
            prerequisiteId,
            false,
        });
    }

    replaceCatalog(config.safeConnectionUri(), courses, groupsByCourse);
    return true;
}

} // namespace api
