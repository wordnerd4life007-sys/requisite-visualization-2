#pragma once

#include "api/ApiModels.h"

#include <cstddef>
#include <string>
#include <unordered_set>
#include <vector>

namespace api {

std::string normalizeCourseId(const std::string& id);
std::string deriveSubject(const std::string& id);
std::string normalizeSubject(const std::string& subject);
std::string normalizeCollege(const std::string& college);

class CourseCatalog {
public:
    virtual ~CourseCatalog() = default;

    virtual const std::string& sourcePath() const = 0;
    virtual std::size_t size() const = 0;

    virtual const CourseRecord* findCourse(const std::string& id) const = 0;
    virtual bool containsCourse(const std::string& id) const = 0;

    virtual std::vector<CourseRecord> searchCourses(const CourseSearchFilters& filters) const = 0;
    virtual std::vector<PrerequisiteGroup> prerequisiteGroupsFor(const std::string& id) const = 0;
    virtual std::vector<std::string> flattenedPrerequisitesFor(const std::string& id) const = 0;
    virtual std::vector<DependentRelationship> dependentsFor(const std::string& id) const = 0;
    virtual PathResult shortestPath(const std::string& fromCourseId, const std::string& toCourseId) const = 0;

    virtual GraphResult graphFor(
        const std::string& rootCourseId,
        const std::string& direction,
        int depth,
        const std::unordered_set<std::string>& subjects,
        const std::unordered_set<std::string>& colleges
    ) const = 0;
};

} // namespace api
