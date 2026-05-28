#include "Graph.h"

#include <cctype>
#include <climits>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <queue>
#include <sstream>
#include <unordered_map>
#include <vector>

namespace {
    std::string trim(const std::string& value) {
        size_t start = 0;
        while (start < value.size() && std::isspace(static_cast<unsigned char>(value[start]))) {
            ++start;
        }

        size_t end = value.size();
        while (end > start && std::isspace(static_cast<unsigned char>(value[end - 1]))) {
            --end;
        }

        return value.substr(start, end - start);
    }

    std::vector<std::string> parseCsvRow(const std::string& line) {
        std::vector<std::string> fields;
        std::string field;
        bool in_quotes = false;

        for (size_t i = 0; i < line.size(); ++i) {
            char current = line[i];

            if (in_quotes) {
                if (current == '"') {
                    if (i + 1 < line.size() && line[i + 1] == '"') {
                        field.push_back('"');
                        ++i;
                    } else {
                        in_quotes = false;
                    }
                } else {
                    field.push_back(current);
                }
            } else if (current == '"') {
                in_quotes = true;
            } else if (current == ',') {
                fields.push_back(field);
                field.clear();
            } else {
                field.push_back(current);
            }
        }

        fields.push_back(field);
        return fields;
    }

    std::ifstream openCoursesFile() {
        const char* override_path = std::getenv("COURSES_CSV_PATH");
        const std::vector<std::string> candidate_paths = {
            override_path == nullptr ? "" : override_path,
            "backend/data/courses.csv",
            "data/courses.csv",
            "courses.csv",
        };

        for (const std::string& path : candidate_paths) {
            if (path.empty()) {
                continue;
            }

            std::ifstream file(path);
            if (file.is_open()) {
                return file;
            }
        }

        return {};
    }
}

Graph::Graph(){
     adj = std::unordered_map<std::string, std::vector<std::string>>();

}

void Graph::buildGraph(){
    std::ifstream file = openCoursesFile();
    if(!file.is_open()){
        std::cerr << "Error opening courses CSV file!" << std::endl;
        return;
    }

    adj.clear();

    std::string line = "";
    while(std::getline(file, line)){
        std::vector<std::string> fields = parseCsvRow(line);
        if (fields.empty()) {
            continue;
        }

        std::string course_id = trim(fields[0]);

        if (course_id == "id" || course_id.empty()) {
            continue;
        }

        adj[course_id];
        std::vector<std::string> prereqs;
        if (fields.size() >= 5) {
            prereqs = ParsePrereqGroups(fields[4]).allPrereqs();
        }

        for (const std::string& prereq : prereqs) {
            adj[prereq].push_back(course_id);
        }
    }

}

    //bfs to find the shortest path between two courses
int Graph::ShortestPathLength(const std::string& start, const std::string& end) const {
    std::unordered_map<std::string, bool> visited;
    std::unordered_map<std::string, int> distance;
    std::queue<std::string> q;

    for (const auto& pair : adj) {
        visited[pair.first] = false;
        distance[pair.first] = INT_MAX;
    }

    visited[start] = true;
    distance[start] = 0;
    q.push(start);

    while (!q.empty()) {
        std::string current = q.front();
        q.pop();

        auto neighbors = adj.find(current);
        if (neighbors == adj.end()) {
            continue;
        }

        for (const std::string& neighbor : neighbors->second) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                distance[neighbor] = distance[current] + 1;
                q.push(neighbor);
            }
        }
    }

    auto end_distance = distance.find(end);
    return end_distance == distance.end() || end_distance->second == INT_MAX ? -1 : end_distance->second;
}

int Graph::CountPaths(const std::string& start, const std::string& end) const {
    return ShortestPathLength(start, end);
}

PrereqGroups Graph::grabPreReqGroups(const std::string& id) const {
    std::ifstream file = openCoursesFile();
    if(!file.is_open()){
        std::cerr << "Error opening courses CSV file!" << std::endl;
        return {};
    }
    std::string line = "";

    while(std::getline(file, line)){
        std::vector<std::string> fields = parseCsvRow(line);
        if (fields.size() < 5) {
            continue;
        }

        std::string course_id = trim(fields[0]);

        if (course_id == "id") {
            continue;
        }

        if(course_id == id){
            return ParsePrereqGroups(fields[4]);
        }
    }

    return {};
}

std::vector<std::string> Graph::grabPreReqs(const std::string& id) const {
    return grabPreReqGroups(id).allPrereqs();
}
