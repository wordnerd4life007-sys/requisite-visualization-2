#include "Graph.h"
#include "DatabaseConfig.h"
#include <iostream>

void testCountPaths(Graph& graph, const std::string& start, const std::string& end, int expected) {
    int actual = graph.CountPaths(start, end);
    std::cout << (actual == expected ? "PASS: " : "FAIL: ")
              << start << " -> " << end << ": expected " << expected
              << ", got " << actual << std::endl;
}

int main() {
    DatabaseConfig dbConfig = DatabaseConfig::fromEnvironment();
    std::cout << "database config: " << dbConfig.safeConnectionUri() << std::endl;

    std::unordered_map<std::string, std::vector<std::string>> adj;
    Graph total(adj);

    total.buildGraph();

    std::cout << "hello" << std::endl;
    std::vector<std::string> prereqs = total.grabPreReqs("CMPSC 64");
    for (const std::string& prereq : prereqs) {
        std::cout << prereq << std::endl;
    }

    testCountPaths(total, "CMPSC 5A", "CMPSC 5B", 1);
    testCountPaths(total, "CMPSC 16", "CMPSC 32", 2);
    testCountPaths(total, "CMPSC 24", "CMPSC 170", 2);
    testCountPaths(total, "CMPSC 5B", "CMPSC 5A", -1);
    testCountPaths(total, "CMPSC 8", "CMPSC 189A", 4);
    

    return 0;
}
