#pragma once

#include "PrerequisiteParser.h"
#include "api/InMemoryCatalog.h"

#include <string>

namespace api {

class CsvCatalog : public InMemoryCatalog {
public:
    bool load(std::string* errorMessage = nullptr);
    bool loadFromFile(const std::string& path, std::string* errorMessage = nullptr);

    static std::string normalizeCourseId(const std::string& id);
    static std::string deriveSubject(const std::string& id);
    static std::string normalizeSubject(const std::string& subject);
    static std::string normalizeCollege(const std::string& college);
};

} // namespace api
