#include "api/InMemoryCatalog.h"

#include <algorithm>
#include <cctype>
#include <queue>
#include <sstream>
#include <unordered_set>

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

std::string toUpper(std::string value) {
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
        return static_cast<char>(std::toupper(ch));
    });
    return value;
}

bool containsCaseInsensitive(const std::string& haystack, const std::string& needle) {
    return toLower(haystack).find(toLower(needle)) != std::string::npos;
}

void appendUnique(std::vector<std::string>& values, std::unordered_set<std::string>& seen, const std::string& value) {
    if (seen.insert(value).second) {
        values.push_back(value);
    }
}

} // namespace

std::string normalizeCourseId(const std::string& id) {
    std::stringstream input(trim(id));
    std::string part;
    std::vector<std::string> parts;
    while (input >> part) {
        parts.push_back(part);
    }

    std::ostringstream normalized;
    for (std::size_t i = 0; i < parts.size(); ++i) {
        if (i > 0) {
            normalized << " ";
        }
        normalized << toUpper(parts[i]);
    }
    return normalized.str();
}

std::string deriveSubject(const std::string& id) {
    const std::string normalized = normalizeCourseId(id);
    const std::size_t separator = normalized.find(' ');
    if (separator != std::string::npos) {
        return normalized.substr(0, separator);
    }

    std::size_t end = 0;
    while (end < normalized.size() && !std::isdigit(static_cast<unsigned char>(normalized[end]))) {
        ++end;
    }
    return normalized.substr(0, end);
}

std::string normalizeSubject(const std::string& subject) {
    return toUpper(trim(subject));
}

std::string normalizeCollege(const std::string& college) {
    return toLower(trim(college));
}

const std::string& InMemoryCatalog::sourcePath() const {
    return sourcePath_;
}

std::size_t InMemoryCatalog::size() const {
    return courses_.size();
}

const CourseRecord* InMemoryCatalog::findCourse(const std::string& id) const {
    const auto found = courses_.find(normalizeCourseId(id));
    return found == courses_.end() ? nullptr : &found->second.course;
}

bool InMemoryCatalog::containsCourse(const std::string& id) const {
    return findCourse(id) != nullptr;
}

std::vector<CourseRecord> InMemoryCatalog::searchCourses(const CourseSearchFilters& filters) const {
    std::vector<CourseRecord> results;
    if (filters.limit == 0) {
        return results;
    }

    results.reserve(std::min(filters.limit, courseOrder_.size()));

    for (const std::string& id : courseOrder_) {
        const auto found = courses_.find(id);
        if (found == courses_.end()) {
            continue;
        }

        if (!courseMatchesFilters(found->second.course, filters)) {
            continue;
        }

        results.push_back(found->second.course);
        if (results.size() >= filters.limit) {
            break;
        }
    }

    return results;
}

std::vector<PrerequisiteGroup> InMemoryCatalog::prerequisiteGroupsFor(const std::string& id) const {
    const auto found = courses_.find(normalizeCourseId(id));
    return found == courses_.end() ? std::vector<PrerequisiteGroup>{} : found->second.prerequisiteGroups;
}

std::vector<std::string> InMemoryCatalog::flattenedPrerequisitesFor(const std::string& id) const {
    std::vector<std::string> flattened;
    std::unordered_set<std::string> seen;

    for (const PrerequisiteGroup& group : prerequisiteGroupsFor(id)) {
        for (const PrerequisiteOption& option : group.options) {
            appendUnique(flattened, seen, option.courseId);
        }
    }

    return flattened;
}

std::vector<DependentRelationship> InMemoryCatalog::dependentsFor(const std::string& id) const {
    const auto found = dependentsByPrerequisite_.find(normalizeCourseId(id));
    return found == dependentsByPrerequisite_.end() ? std::vector<DependentRelationship>{} : found->second;
}

GraphResult InMemoryCatalog::graphFor(
    const std::string& rootCourseId,
    const std::string& direction,
    int depth,
    const std::unordered_set<std::string>& subjects,
    const std::unordered_set<std::string>& colleges
) const {
    GraphResult graph;
    graph.rootCourseId = normalizeCourseId(rootCourseId);
    graph.direction = direction;
    graph.depth = depth;

    std::queue<std::pair<std::string, int>> pending;
    std::unordered_map<std::string, int> distances;
    std::unordered_set<std::string> nodesAdded;
    std::unordered_set<std::string> edgesAdded;

    const auto addNode = [&](const std::string& courseId) {
        if (nodesAdded.insert(courseId).second) {
            graph.nodes.push_back(nodeFor(courseId));
        }
    };

    const auto addEdge = [&](const GraphEdge& edge) {
        const std::string key = edge.from + "\n" + edge.to + "\n" + edge.groupType + "\n" + std::to_string(edge.groupIndex);
        if (edgesAdded.insert(key).second) {
            graph.edges.push_back(edge);
        }
    };

    addNode(graph.rootCourseId);
    pending.push({graph.rootCourseId, 0});
    distances[graph.rootCourseId] = 0;

    while (!pending.empty()) {
        const std::string current = pending.front().first;
        const int currentDepth = pending.front().second;
        pending.pop();

        if (currentDepth >= depth) {
            continue;
        }

        if (direction == "prerequisites" || direction == "both") {
            for (const PrerequisiteGroup& group : prerequisiteGroupsFor(current)) {
                for (const PrerequisiteOption& option : group.options) {
                    if (!graphNodeAllowed(option.courseId, false, subjects, colleges)) {
                        continue;
                    }

                    addNode(option.courseId);
                    addEdge({option.courseId, current, "prerequisite", group.groupType, group.groupIndex});

                    if (distances.find(option.courseId) == distances.end()) {
                        distances[option.courseId] = currentDepth + 1;
                        pending.push({option.courseId, currentDepth + 1});
                    }
                }
            }
        }

        if (direction == "dependents" || direction == "both") {
            for (const DependentRelationship& dependent : dependentsFor(current)) {
                if (!graphNodeAllowed(dependent.courseId, false, subjects, colleges)) {
                    continue;
                }

                addNode(dependent.courseId);
                addEdge({current, dependent.courseId, "prerequisite", dependent.groupType, dependent.groupIndex});

                if (distances.find(dependent.courseId) == distances.end()) {
                    distances[dependent.courseId] = currentDepth + 1;
                    pending.push({dependent.courseId, currentDepth + 1});
                }
            }
        }
    }

    return graph;
}

void InMemoryCatalog::replaceCatalog(
    const std::string& sourcePath,
    const std::vector<CourseRecord>& courses,
    const std::unordered_map<std::string, std::vector<PrerequisiteGroup>>& prerequisiteGroupsByCourse
) {
    std::vector<std::string> newCourseOrder;
    std::unordered_map<std::string, StoredCourse> newCourses;

    for (CourseRecord course : courses) {
        course.id = normalizeCourseId(course.id);
        if (course.id.empty()) {
            continue;
        }

        course.subject = normalizeSubject(course.subject);
        if (course.subject.empty()) {
            course.subject = deriveSubject(course.id);
        }

        const bool isNewCourse = newCourses.find(course.id) == newCourses.end();
        if (isNewCourse) {
            newCourseOrder.push_back(course.id);
        }

        StoredCourse stored;
        stored.course = course;

        const auto groups = prerequisiteGroupsByCourse.find(course.id);
        if (groups != prerequisiteGroupsByCourse.end()) {
            stored.prerequisiteGroups = groups->second;
            for (PrerequisiteGroup& group : stored.prerequisiteGroups) {
                for (PrerequisiteOption& option : group.options) {
                    option.courseId = normalizeCourseId(option.courseId);
                }
            }
        }

        newCourses[course.id] = stored;
    }

    for (auto& entry : newCourses) {
        for (PrerequisiteGroup& group : entry.second.prerequisiteGroups) {
            std::vector<PrerequisiteOption> normalizedOptions;
            for (PrerequisiteOption option : group.options) {
                option.courseId = normalizeCourseId(option.courseId);
                if (option.courseId.empty()) {
                    continue;
                }
                option.external = newCourses.find(option.courseId) == newCourses.end();
                normalizedOptions.push_back(option);
            }
            group.options = normalizedOptions;
        }
    }

    sourcePath_ = sourcePath;
    courseOrder_ = newCourseOrder;
    courses_ = newCourses;
    rebuildDependents();
}

void InMemoryCatalog::rebuildDependents() {
    dependentsByPrerequisite_.clear();

    for (const std::string& courseId : courseOrder_) {
        const auto found = courses_.find(courseId);
        if (found == courses_.end()) {
            continue;
        }

        for (const PrerequisiteGroup& group : prerequisiteGroupsFor(courseId)) {
            for (const PrerequisiteOption& option : group.options) {
                dependentsByPrerequisite_[option.courseId].push_back({
                    courseId,
                    group.groupType,
                    group.groupIndex,
                    false,
                });
            }
        }
    }
}

bool InMemoryCatalog::courseMatchesFilters(const CourseRecord& course, const CourseSearchFilters& filters) const {
    if (!filters.query.empty()
        && !containsCaseInsensitive(course.id, filters.query)
        && !containsCaseInsensitive(course.name, filters.query)
        && !containsCaseInsensitive(course.subject, filters.query)
        && !containsCaseInsensitive(course.college, filters.query)
        && !containsCaseInsensitive(course.department, filters.query)) {
        return false;
    }

    if (!filters.subjects.empty() && filters.subjects.find(normalizeSubject(course.subject)) == filters.subjects.end()) {
        return false;
    }

    if (!filters.colleges.empty() && filters.colleges.find(normalizeCollege(course.college)) == filters.colleges.end()) {
        return false;
    }

    return true;
}

bool InMemoryCatalog::graphNodeAllowed(
    const std::string& courseId,
    bool isRoot,
    const std::unordered_set<std::string>& subjects,
    const std::unordered_set<std::string>& colleges
) const {
    if (isRoot) {
        return true;
    }

    const CourseRecord* course = findCourse(courseId);
    const std::string subject = course == nullptr ? deriveSubject(courseId) : normalizeSubject(course->subject);
    const std::string college = course == nullptr ? "" : normalizeCollege(course->college);

    if (!subjects.empty() && subjects.find(subject) == subjects.end()) {
        return false;
    }

    if (!colleges.empty() && colleges.find(college) == colleges.end()) {
        return false;
    }

    return true;
}

GraphNode InMemoryCatalog::nodeFor(const std::string& courseId) const {
    const CourseRecord* course = findCourse(courseId);
    if (course == nullptr) {
        return {courseId, courseId, "", true, "", "", deriveSubject(courseId)};
    }

    return {
        course->id,
        course->id,
        course->name,
        false,
        course->college,
        course->department,
        course->subject,
    };
}

} // namespace api
