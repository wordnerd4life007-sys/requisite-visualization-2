CXX ?= g++
TARGET_BASE ?= requisite-visualization

ifeq ($(OS),Windows_NT)
EXEEXT := .exe
RUN_CMD = ./$(TARGET)
POWERSHELL := C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
CLEAN_CMD = "$(POWERSHELL)" -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue '*.o','*.d','$(TARGET)'; exit 0"
else
EXEEXT :=
RUN_CMD = ./$(TARGET)
CLEAN_CMD = $(RM) $(OBJECTS) $(DEPS) $(TARGET)
endif

TARGET ?= $(TARGET_BASE)$(EXEEXT)

SOURCES := main.cpp Graph.cpp Course.cpp
OBJECTS := $(SOURCES:.cpp=.o)
DEPS := $(OBJECTS:.o=.d)

CPPFLAGS ?= -MMD -MP
CXXFLAGS ?= -std=c++17 -Wall -Wextra -pedantic -g

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CXX) $(OBJECTS) -o $@

%.o: %.cpp
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@

run: $(TARGET)
	$(RUN_CMD)

clean:
	$(CLEAN_CMD)

-include $(DEPS)
