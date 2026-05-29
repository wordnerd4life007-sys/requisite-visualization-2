#pragma once

#include "api/Catalog.h"

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace api {

class InMemoryCatalog : public CourseCatalog {
public:
    const std::string& sourcePath() const override;
    std::size_t size() const override;

    const CourseRecord* findCourse(const std::string& id) const override;
    bool containsCourse(const std::string& id) const override;

    std::vector<CourseRecord> searchCourses(const CourseSearchFilters& filters) const override;
    std::vector<PrerequisiteGroup> prerequisiteGroupsFor(const std::string& id) const override;
    std::vector<std::string> flattenedPrerequisitesFor(const std::string& id) const override;
    std::vector<DependentRelationship> dependentsFor(const std::string& id) const override;
    PathResult shortestPath(const std::string& fromCourseId, const std::string& toCourseId) const override;

    GraphResult graphFor(
        const std::string& rootCourseId,
        const std::string& direction,
        int depth,
        const std::unordered_set<std::string>& subjects,
        const std::unordered_set<std::string>& colleges
    ) const override;

protected:
    void replaceCatalog(
        const std::string& sourcePath,
        const std::vector<CourseRecord>& courses,
        const std::unordered_map<std::string, std::vector<PrerequisiteGroup>>& prerequisiteGroupsByCourse
    );

private:
    struct StoredCourse {
        CourseRecord course;
        std::vector<PrerequisiteGroup> prerequisiteGroups;
    };

    std::string sourcePath_;
    std::vector<std::string> courseOrder_;
    std::unordered_map<std::string, StoredCourse> courses_;
    std::unordered_map<std::string, std::vector<DependentRelationship>> dependentsByPrerequisite_;

    void rebuildDependents();
    bool courseMatchesFilters(const CourseRecord& course, const CourseSearchFilters& filters) const;
    bool graphNodeAllowed(
        const std::string& courseId,
        bool isRoot,
        const std::unordered_set<std::string>& subjects,
        const std::unordered_set<std::string>& colleges
    ) const;
    GraphNode nodeFor(const std::string& courseId) const;
};

} // namespace api
