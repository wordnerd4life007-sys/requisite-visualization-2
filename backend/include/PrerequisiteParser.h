#pragma once

#include <string>
#include <vector>

struct PrereqGroups {
    std::vector<std::string> andPrereqs;
    std::vector<std::vector<std::string>> orGroups;

    std::vector<std::string> allPrereqs() const;
};

PrereqGroups ParsePrereqGroups(const std::string& prereq_str);
