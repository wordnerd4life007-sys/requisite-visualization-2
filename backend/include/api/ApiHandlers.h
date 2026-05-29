#pragma once

#include "api/Catalog.h"

#include <string>
#include <unordered_map>
#include <vector>

namespace api {

class ApiHandlers {
public:
    using QueryParams = std::unordered_map<std::string, std::vector<std::string>>;

    explicit ApiHandlers(const CourseCatalog& catalog);

    ApiResponse handleRequest(const std::string& method, const std::string& target) const;

private:
    const CourseCatalog& catalog_;

    ApiResponse handleCourses(const QueryParams& query) const;
    ApiResponse handleCourseRoute(const std::string& path) const;
    ApiResponse handleGraph(const QueryParams& query) const;
    ApiResponse handlePaths(const QueryParams& query) const;

    CourseSearchFilters parseCourseFilters(const QueryParams& query, std::string& errorCode, std::string& errorMessage) const;
};

} // namespace api
