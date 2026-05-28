#pragma once

#include "DatabaseConfig.h"
#include "api/InMemoryCatalog.h"

#include <string>

namespace api {

class PostgresCatalog : public InMemoryCatalog {
public:
    bool load(const DatabaseConfig& config, std::string* errorMessage = nullptr);
};

} // namespace api
