CXX ?= g++
TARGET_BASE ?= requisite-visualization
BUILD_DIR ?= build
BACKEND_DIR ?= backend
SRC_DIR := $(BACKEND_DIR)/src
INCLUDE_DIR := $(BACKEND_DIR)/include

ifeq ($(OS),Windows_NT)
EXEEXT := .exe
RUN_CMD = ./$(TARGET)
POWERSHELL := C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
CLEAN_CMD = "$(POWERSHELL)" -NoProfile -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue '$(BUILD_DIR)'; exit 0"
MKDIR_BUILD = "$(POWERSHELL)" -NoProfile -Command "New-Item -ItemType Directory -Force '$(BUILD_DIR)' | Out-Null"
MKDIR_TARGET_DIR = "$(POWERSHELL)" -NoProfile -Command "New-Item -ItemType Directory -Force '$(@D)' | Out-Null"
API_LDLIBS := -lws2_32
MSYS2_UCRT_BIN ?= C:/msys64/ucrt64/bin
PG_ROOT ?= C:/PROGRA~1/POSTGR~1/18
ifneq ($(wildcard $(MSYS2_UCRT_BIN)/g++.exe),)
export PATH := $(MSYS2_UCRT_BIN);$(PATH)
endif
else
EXEEXT :=
RUN_CMD = ./$(TARGET)
CLEAN_CMD = $(RM) -r $(BUILD_DIR)
MKDIR_BUILD = mkdir -p $(BUILD_DIR)
MKDIR_TARGET_DIR = mkdir -p $(@D)
API_LDLIBS :=
PG_ROOT ?=
endif

PG_INCLUDE_DIR ?= $(if $(PG_ROOT),$(PG_ROOT)/include,)
PG_LIB_DIR ?= $(if $(PG_ROOT),$(PG_ROOT)/lib,)
PG_CPPFLAGS := $(if $(PG_INCLUDE_DIR),-I$(PG_INCLUDE_DIR),)
PG_LDFLAGS := $(if $(PG_LIB_DIR),-L$(PG_LIB_DIR),)
ifeq ($(OS),Windows_NT)
PG_LDLIBS ?= $(if $(PG_LIB_DIR),$(PG_LIB_DIR)/libpq.lib,-lpq)
else
PG_LDLIBS ?= -lpq
endif
ifeq ($(OS),Windows_NT)
API_LDLIBS := $(PG_LDLIBS) $(API_LDLIBS) -lsecur32 -lcrypt32
else
API_LDLIBS := $(PG_LDLIBS) $(API_LDLIBS)
endif

TARGET ?= $(BUILD_DIR)/$(TARGET_BASE)$(EXEEXT)
TEST_CPP_TARGET ?= $(BUILD_DIR)/test-graph$(EXEEXT)
TEST_API_CATALOG_TARGET ?= $(BUILD_DIR)/test-api-catalog$(EXEEXT)
API_TARGET ?= $(BUILD_DIR)/requisite-api$(EXEEXT)
PYTHON ?= python

CORE_SOURCES := $(filter-out $(SRC_DIR)/main.cpp,$(wildcard $(SRC_DIR)/*.cpp))
APP_SOURCES := $(SRC_DIR)/main.cpp $(CORE_SOURCES)
API_SOURCES := \
	$(SRC_DIR)/api/HttpServer.cpp \
	$(SRC_DIR)/api/ApiHandlers.cpp \
	$(SRC_DIR)/api/ApiJson.cpp \
	$(SRC_DIR)/api/CsvCatalog.cpp \
	$(SRC_DIR)/api/InMemoryCatalog.cpp \
	$(SRC_DIR)/api/PostgresCatalog.cpp \
	$(SRC_DIR)/DatabaseConfig.cpp \
	$(SRC_DIR)/PrerequisiteParser.cpp
APP_OBJECTS := $(patsubst $(SRC_DIR)/%.cpp,$(BUILD_DIR)/%.o,$(APP_SOURCES))
CORE_OBJECTS := $(patsubst $(SRC_DIR)/%.cpp,$(BUILD_DIR)/%.o,$(CORE_SOURCES))
API_OBJECTS := $(patsubst $(SRC_DIR)/%.cpp,$(BUILD_DIR)/%.o,$(API_SOURCES))
TEST_CPP_SOURCE := tests/cpp/test_graph.cpp
TEST_CPP_OBJECT := $(BUILD_DIR)/test_graph.o
TEST_API_CATALOG_SOURCE := tests/cpp/test_api_catalog.cpp
TEST_API_CATALOG_OBJECT := $(BUILD_DIR)/test_api_catalog.o
DEPS := $(APP_OBJECTS:.o=.d) $(TEST_CPP_OBJECT:.o=.d) $(TEST_API_CATALOG_OBJECT:.o=.d) $(API_OBJECTS:.o=.d)

CPPFLAGS ?= -MMD -MP -I$(INCLUDE_DIR) $(PG_CPPFLAGS)
CXXFLAGS ?= -std=c++17 -Wall -Wextra -pedantic -g

.PHONY: all api clean run test test-api-smoke test-api-smoke-postgres test-cpp test-python

all: $(TARGET)

$(TARGET): $(APP_OBJECTS)
	$(CXX) $(APP_OBJECTS) -o $@

api: $(API_TARGET)

$(API_TARGET): $(API_OBJECTS)
	$(CXX) $(API_OBJECTS) -o $@ $(PG_LDFLAGS) $(API_LDLIBS)

$(TEST_CPP_TARGET): $(TEST_CPP_OBJECT) $(CORE_OBJECTS)
	$(CXX) $(TEST_CPP_OBJECT) $(CORE_OBJECTS) -o $@

$(TEST_API_CATALOG_TARGET): $(TEST_API_CATALOG_OBJECT) $(BUILD_DIR)/api/CsvCatalog.o $(BUILD_DIR)/api/InMemoryCatalog.o $(BUILD_DIR)/PrerequisiteParser.o
	$(CXX) $(TEST_API_CATALOG_OBJECT) $(BUILD_DIR)/api/CsvCatalog.o $(BUILD_DIR)/api/InMemoryCatalog.o $(BUILD_DIR)/PrerequisiteParser.o -o $@

$(BUILD_DIR):
	$(MKDIR_BUILD)

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cpp | $(BUILD_DIR)
	$(MKDIR_TARGET_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@

$(TEST_CPP_OBJECT): $(TEST_CPP_SOURCE) | $(BUILD_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@

$(TEST_API_CATALOG_OBJECT): $(TEST_API_CATALOG_SOURCE) | $(BUILD_DIR)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@

run: $(TARGET)
	$(RUN_CMD)

test: test-cpp test-python

test-cpp: $(TEST_CPP_TARGET) $(TEST_API_CATALOG_TARGET)
	./$(TEST_CPP_TARGET)
	./$(TEST_API_CATALOG_TARGET)

test-python:
	$(PYTHON) -m unittest discover -s tests/python

test-api-smoke: api
	$(PYTHON) tests/api/test_api_smoke.py

test-api-smoke-postgres: api
	$(PYTHON) tests/api/test_api_smoke.py --data-source postgres

clean:
	$(CLEAN_CMD)

-include $(DEPS)
