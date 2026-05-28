#include "PrerequisiteParser.h"

#include <cctype>
#include <sstream>

namespace {
    std::string trim(const std::string& value) {
        size_t start = 0;
        while (start < value.size() && std::isspace(static_cast<unsigned char>(value[start]))) {
            ++start;
        }

        size_t end = value.size();
        while (end > start && std::isspace(static_cast<unsigned char>(value[end - 1]))) {
            --end;
        }

        return value.substr(start, end - start);
    }

    std::vector<std::string> splitCourseList(const std::string& value) {
        std::vector<std::string> courses;
        std::stringstream ss(value);
        std::string course;

        while (std::getline(ss, course, ',')) {
            course = trim(course);
            if (!course.empty()) {
                courses.push_back(course);
            }
        }

        return courses;
    }
}

std::vector<std::string> PrereqGroups::allPrereqs() const {
    std::vector<std::string> prereqs = andPrereqs;

    for (const std::vector<std::string>& group : orGroups) {
        prereqs.insert(prereqs.end(), group.begin(), group.end());
    }

    return prereqs;
}

PrereqGroups ParsePrereqGroups(const std::string& prereq_str) {
    PrereqGroups groups;
    std::string prereqs = trim(prereq_str);

    if (prereqs.empty()) {
        return groups;
    }

    size_t separator = prereqs.find('|');
    std::string and_section = separator == std::string::npos
        ? prereqs
        : prereqs.substr(0, separator);

    groups.andPrereqs = splitCourseList(and_section);

    if (separator == std::string::npos) {
        return groups;
    }

    std::string or_section = prereqs.substr(separator + 1);
    std::stringstream or_stream(or_section);
    std::string semicolon_group;

    while (std::getline(or_stream, semicolon_group, ';')) {
        std::stringstream legacy_pipe_stream(semicolon_group);
        std::string pipe_group;

        while (std::getline(legacy_pipe_stream, pipe_group, '|')) {
            std::vector<std::string> alternatives = splitCourseList(pipe_group);
            if (!alternatives.empty()) {
                groups.orGroups.push_back(alternatives);
            }
        }
    }

    return groups;
}
