#include "api/CsvCatalog.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <fstream>
#include <optional>
#include <sstream>
#include <unordered_map>
#include <vector>

namespace api {
namespace {

std::string trim(const std::string& value) {
    std::size_t start = 0;
    while (start < value.size() && std::isspace(static_cast<unsigned char>(value[start]))) {
        ++start;
    }

    std::size_t end = value.size();
    while (end > start && std::isspace(static_cast<unsigned char>(value[end - 1]))) {
        --end;
    }

    return value.substr(start, end - start);
}

std::string toLower(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::tolower(ch));
    });
    return value;
}

std::vector<std::string> parseCsvRow(const std::string& line) {
    std::vector<std::string> fields;
    std::string field;
    bool inQuotes = false;

    for (std::size_t i = 0; i < line.size(); ++i) {
        const char current = line[i];

        if (inQuotes) {
            if (current == '"') {
                if (i + 1 < line.size() && line[i + 1] == '"') {
                    field.push_back('"');
                    ++i;
                } else {
                    inQuotes = false;
                }
            } else {
                field.push_back(current);
            }
        } else if (current == '"') {
            inQuotes = true;
        } else if (current == ',') {
            fields.push_back(field);
            field.clear();
        } else {
            field.push_back(current);
        }
    }

    fields.push_back(field);
    return fields;
}

int columnIndex(
    const std::unordered_map<std::string, int>& headers,
    const std::string& name,
    int fallback
) {
    const auto found = headers.find(name);
    return found == headers.end() ? fallback : found->second;
}

std::string fieldAt(const std::vector<std::string>& fields, int index) {
    if (index < 0 || static_cast<std::size_t>(index) >= fields.size()) {
        return "";
    }
    return trim(fields[static_cast<std::size_t>(index)]);
}

std::optional<double> parseCredits(const std::string& value) {
    const std::string trimmed = trim(value);
    if (trimmed.empty()) {
        return std::nullopt;
    }

    char* end = nullptr;
    const double parsed = std::strtod(trimmed.c_str(), &end);
    if (end == trimmed.c_str()) {
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

std::vector<PrerequisiteGroup> groupsFromParsedPrerequisites(const PrereqGroups& parsed) {
    std::vector<PrerequisiteGroup> groups;

    if (!parsed.andPrereqs.empty()) {
        PrerequisiteGroup group;
        group.groupType = "all";
        group.groupIndex = 0;
        for (const std::string& prereqId : parsed.andPrereqs) {
            const std::string normalizedId = normalizeCourseId(prereqId);
            if (!normalizedId.empty()) {
                group.options.push_back({normalizedId, false});
            }
        }
        if (!group.options.empty()) {
            groups.push_back(group);
        }
    }

    for (std::size_t i = 0; i < parsed.orGroups.size(); ++i) {
        PrerequisiteGroup group;
        group.groupType = "any";
        group.groupIndex = static_cast<int>(i);

        for (const std::string& prereqId : parsed.orGroups[i]) {
            const std::string normalizedId = normalizeCourseId(prereqId);
            if (!normalizedId.empty()) {
                group.options.push_back({normalizedId, false});
            }
        }

        if (!group.options.empty()) {
            groups.push_back(group);
        }
    }

    return groups;
}

} // namespace

bool CsvCatalog::load(std::string* errorMessage) {
    const char* overridePath = std::getenv("COURSES_CSV_PATH");
    const std::vector<std::string> candidatePaths = {
        overridePath == nullptr ? "" : overridePath,
        "backend/data/courses.csv",
        "data/courses.csv",
        "courses.csv",
    };

    for (const std::string& path : candidatePaths) {
        if (path.empty()) {
            continue;
        }

        std::ifstream file(path);
        if (file.is_open()) {
            file.close();
            return loadFromFile(path, errorMessage);
        }
    }

    if (errorMessage != nullptr) {
        *errorMessage = "Unable to open courses CSV file.";
    }
    return false;
}

bool CsvCatalog::loadFromFile(const std::string& path, std::string* errorMessage) {
    std::ifstream file(path);
    if (!file.is_open()) {
        if (errorMessage != nullptr) {
            *errorMessage = "Unable to open courses CSV file.";
        }
        return false;
    }

    std::string headerLine;
    if (!std::getline(file, headerLine)) {
        if (errorMessage != nullptr) {
            *errorMessage = "Courses CSV file is empty.";
        }
        return false;
    }

    const std::vector<std::string> headerFields = parseCsvRow(headerLine);
    std::unordered_map<std::string, int> headers;
    for (std::size_t i = 0; i < headerFields.size(); ++i) {
        headers[toLower(trim(headerFields[i]))] = static_cast<int>(i);
    }

    const int idIndex = columnIndex(headers, "id", 0);
    const int nameIndex = columnIndex(headers, "name", 1);
    const int creditsIndex = columnIndex(headers, "credits", 2);
    const int collegeIndex = columnIndex(headers, "college", 3);
    const int prereqsIndex = columnIndex(headers, "prereqs", 4);
    const int subjectIndex = columnIndex(headers, "subject", -1);
    const int departmentIndex = columnIndex(headers, "department", -1);

    std::vector<CourseRecord> courses;
    std::unordered_map<std::string, std::vector<PrerequisiteGroup>> groupsByCourse;

    std::string line;
    while (std::getline(file, line)) {
        if (line.empty()) {
            continue;
        }

        const std::vector<std::string> fields = parseCsvRow(line);
        const std::string id = normalizeCourseId(fieldAt(fields, idIndex));
        if (id.empty() || toLower(id) == "id") {
            continue;
        }

        CourseRecord course;
        course.id = id;
        course.name = fieldAt(fields, nameIndex);
        course.credits = parseCredits(fieldAt(fields, creditsIndex));
        course.college = fieldAt(fields, collegeIndex);
        course.department = fieldAt(fields, departmentIndex);
        course.subject = normalizeSubject(fieldAt(fields, subjectIndex));

        courses.push_back(course);
        groupsByCourse[course.id] = groupsFromParsedPrerequisites(ParsePrereqGroups(fieldAt(fields, prereqsIndex)));
    }

    replaceCatalog(path, courses, groupsByCourse);
    return true;
}

std::string CsvCatalog::normalizeCourseId(const std::string& id) {
    return api::normalizeCourseId(id);
}

std::string CsvCatalog::deriveSubject(const std::string& id) {
    return api::deriveSubject(id);
}

std::string CsvCatalog::normalizeSubject(const std::string& subject) {
    return api::normalizeSubject(subject);
}

std::string CsvCatalog::normalizeCollege(const std::string& college) {
    return api::normalizeCollege(college);
}

} // namespace api
