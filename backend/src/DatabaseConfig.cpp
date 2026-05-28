#include "DatabaseConfig.h"

#include <cstdlib>
#include <sstream>
#include <string>
#include <vector>

namespace {
bool hasEnvValue(const char* name) {
    const char* value = std::getenv(name);
    return value != nullptr && !std::string(value).empty();
}

std::string envOrDefault(const char* name, const std::string& fallback) {
    const char* value = std::getenv(name);
    if (value == nullptr || std::string(value).empty()) {
        return fallback;
    }

    return value;
}

std::string envOrDefault(const char* primary, const char* fallbackName, const std::string& fallback) {
    if (hasEnvValue(primary)) {
        return envOrDefault(primary, fallback);
    }

    return envOrDefault(fallbackName, fallback);
}

bool parsePort(const std::string& rawValue, int& port) {
    try {
        std::size_t parsedChars = 0;
        const int parsedPort = std::stoi(rawValue, &parsedChars);
        if (parsedChars != rawValue.size() || parsedPort < 1 || parsedPort > 65535) {
            return false;
        }

        port = parsedPort;
        return true;
    } catch (...) {
        return false;
    }
}

int envPortOrDefault(const char* primary, const char* fallbackName, int fallback) {
    std::string rawValue;
    if (hasEnvValue(primary)) {
        rawValue = envOrDefault(primary, "");
    } else if (hasEnvValue(fallbackName)) {
        rawValue = envOrDefault(fallbackName, "");
    } else {
        return fallback;
    }

    int port = 0;
    return parsePort(rawValue, port) ? port : 0;
}

std::string redactedUrl(const std::string& url) {
    const std::size_t schemeEnd = url.find("://");
    if (schemeEnd == std::string::npos) {
        return url;
    }

    const std::size_t userInfoStart = schemeEnd + 3;
    const std::size_t at = url.find('@', userInfoStart);
    if (at == std::string::npos) {
        return url;
    }

    const std::size_t passwordSeparator = url.find(':', userInfoStart);
    if (passwordSeparator == std::string::npos || passwordSeparator > at) {
        return url;
    }

    return url.substr(0, passwordSeparator + 1) + "****" + url.substr(at);
}

std::string redactPasswordKeywords(const std::string& connectionInfo) {
    std::string redacted = connectionInfo;
    std::size_t searchFrom = 0;
    const std::string passwordKey = "password=";

    while (searchFrom < redacted.size()) {
        const std::size_t keyStart = redacted.find(passwordKey, searchFrom);
        if (keyStart == std::string::npos) {
            break;
        }

        const std::size_t valueStart = keyStart + passwordKey.size();
        const std::size_t valueEnd = redacted.find_first_of(" \t\r\n&;", valueStart);
        if (valueEnd == std::string::npos) {
            redacted.replace(valueStart, std::string::npos, "****");
            break;
        }

        redacted.replace(valueStart, valueEnd - valueStart, "****");
        searchFrom = valueStart + 4;
    }

    return redacted;
}

std::string redactConnectionInfo(const std::string& connectionInfo) {
    return redactPasswordKeywords(redactedUrl(connectionInfo));
}

bool startsWith(const std::string& value, const std::string& prefix) {
    return value.rfind(prefix, 0) == 0;
}
}

DatabaseConfig DatabaseConfig::fromEnvironment() {
    DatabaseConfig config;
    config.databaseUrl = envOrDefault("DATABASE_URL", "");
    // DB_* values are app-specific overrides; POSTGRES_* values match docker-compose.yml.
    config.host = envOrDefault("DB_HOST", "POSTGRES_HOST", "localhost");
    config.port = envPortOrDefault("DB_PORT", "POSTGRES_PORT", 5432);
    config.name = envOrDefault("DB_NAME", "POSTGRES_DB", "requisite_visualization");
    config.user = envOrDefault("DB_USER", "POSTGRES_USER", "requisite_user");
    config.password = envOrDefault("DB_PASSWORD", "POSTGRES_PASSWORD", "");
    return config;
}

bool DatabaseConfig::hasDatabaseUrl() const {
    return !databaseUrl.empty();
}

bool DatabaseConfig::isValid() const {
    return validationErrors().empty();
}

std::vector<std::string> DatabaseConfig::validationErrors() const {
    std::vector<std::string> errors;

    if (hasDatabaseUrl()) {
        if (!startsWith(databaseUrl, "postgresql://") && !startsWith(databaseUrl, "postgres://")) {
            errors.push_back("DATABASE_URL must start with postgresql:// or postgres://");
        }

        return errors;
    }

    if (host.empty()) {
        errors.push_back("database host must not be empty");
    }

    if (port < 1 || port > 65535) {
        errors.push_back("database port must be between 1 and 65535");
    }

    if (name.empty()) {
        errors.push_back("database name must not be empty");
    }

    if (user.empty()) {
        errors.push_back("database user must not be empty");
    }

    return errors;
}

std::string DatabaseConfig::safeConnectionUri() const {
    if (hasDatabaseUrl()) {
        return redactConnectionInfo(databaseUrl);
    }

    std::ostringstream uri;
    uri << "postgresql://";
    if (!user.empty()) {
        uri << user;
        if (!password.empty()) {
            uri << ":****";
        }
        uri << "@";
    }
    uri << host << ":" << port << "/" << name;
    return uri.str();
}

std::string DatabaseConfig::libpqConnectionString(bool includePassword) const {
    if (hasDatabaseUrl()) {
        return includePassword ? databaseUrl : redactConnectionInfo(databaseUrl);
    }

    std::ostringstream connection;
    connection << "host=" << host
               << " port=" << port
               << " dbname=" << name
               << " user=" << user;

    if (!password.empty()) {
        connection << " password=" << (includePassword ? password : "****");
    }

    return connection.str();
}
