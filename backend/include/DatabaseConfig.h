#pragma once

#include <string>
#include <vector>

struct DatabaseConfig {
    std::string databaseUrl;
    std::string host;
    int port = 0;
    std::string name;
    std::string user;
    std::string password;

    static DatabaseConfig fromEnvironment();

    bool hasDatabaseUrl() const;
    bool isValid() const;
    std::vector<std::string> validationErrors() const;
    std::string safeConnectionUri() const;
    std::string libpqConnectionString(bool includePassword = false) const;
};
