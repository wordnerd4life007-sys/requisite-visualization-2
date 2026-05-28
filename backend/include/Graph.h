#pragma once

#include "PrerequisiteParser.h"

#include <string>
#include <unordered_map>
#include <vector>

class Graph{
    private:
        std::unordered_map<std::string, std::vector<std::string>> adj;

    public: 
        Graph();

        Graph(std::unordered_map<std::string, std::vector<std::string>> adj) : adj(adj) {}
        
        void buildGraph();
        int ShortestPathLength(const std::string& start, const std::string& end) const;
        int CountPaths(const std::string& start, const std::string& end) const;

        PrereqGroups grabPreReqGroups(const std::string& id) const;
        std::vector<std::string>  grabPreReqs(const std::string& id) const;

};
