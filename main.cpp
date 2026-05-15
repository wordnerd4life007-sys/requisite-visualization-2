#include "Graph.h"
#include "Course.h"
#include <iostream>

int main() {
    std::unordered_map<std::string, std::vector<std::string>> adj;
    Graph graph(adj);

    std::cout << "hello" << std::endl;
    std::vector<std::string> prereqs = graph.grabPreReqs("CMPSC 64");
    for (const std::string& prereq : prereqs) {
        std::cout << prereq << std::endl;
    }
    return 0;
}