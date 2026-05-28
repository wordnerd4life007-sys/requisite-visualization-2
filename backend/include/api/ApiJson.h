#pragma once

#include "api/ApiModels.h"

#include <string>
#include <vector>

namespace api {

std::string jsonString(const std::string& value);
std::string jsonStringOrNull(const std::string& value);
std::string jsonError(const std::string& code, const std::string& message);

std::string courseSummaryJson(const CourseRecord& course);
std::string courseDetailJson(
    const CourseRecord& course,
    const std::vector<PrerequisiteGroup>& prerequisiteGroups
);
std::string prerequisiteGroupsJson(const std::vector<PrerequisiteGroup>& groups);
std::string prerequisiteResponseJson(
    const std::string& courseId,
    const std::vector<PrerequisiteGroup>& groups,
    const std::vector<std::string>& flattenedCourseIds
);
std::string dependentResponseJson(
    const std::string& courseId,
    const std::vector<DependentRelationship>& relationships,
    const std::vector<std::string>& flattenedCourseIds
);
std::string graphResponseJson(const GraphResult& graph);

} // namespace api
