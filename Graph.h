#pragma once

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
#include <queue>
#include <climits>

class Graph{
    private:
        std::unordered_map<std::string, std::vector<std::string>> adj;

    public: 
        Graph();

        Graph(std::unordered_map<std::string, std::vector<std::string>> adj) : adj(adj) {}
        
        void buildGraph();
        int CountPaths(std::string start, std::string end);

        std::vector<std::string>  grabPreReqs(std::string id);

};
