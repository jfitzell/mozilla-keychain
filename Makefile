# Environment config
GECKO_SDK := ../sdks/current
CC := c++

# Generated filenames
LIB_NAME := libmacoskeychain.dylib
XPI_NAME := macos-keychain.xpi
XPT_NAME := $(patsubst %.xpi,%.xpt,$(XPI_NAME))

# Directory used to build the XPI
XPI_DIR := xpi-staging

# Subdirectories (used to load sub-config files)
DIRS := public src

# Compiler configuration
CPP_WARNING_FLAGS := -Wall -Wpointer-arith -Woverloaded-virtual -Wsynth -Wno-ctor-dtor-privacy -Wno-non-virtual-dtor -Wcast-align -Wno-invalid-offsetof -Wno-long-long
CPP_ARCH_FLAGS := -arch i386 -arch ppc
CPP_FEATURE_FLAGS := -fPIC -fno-rtti -fno-exceptions -fno-strict-aliasing -fpascal-strings -fno-common -fshort-wchar

# Variables overridden by sub-configs
SOURCES :=
IDLS :=
INC_DIRS := -I$(GECKO_SDK)/include/ -I.

LIBS :=
LIB_DIRS := -L$(GECKO_SDK)/lib

XPI_ROOT_FILES := install.rdf chrome.manifest CHANGES
XPI_COMPONENT_FILES := $(LIB_NAME) $(XPT_NAME)


## BEGINNING OF RULES
#

.PHONY := default clean xpi

default: xpi

xpi : $(XPI_NAME)

clean:
	rm -rf $(LIB_NAME) $(OBJS) $(XPTS) $(IDL_HEADERS) $(DEPS) $(XPI_DIR) $(XPI_NAME) $(XPT_NAME)

# Include config.mk from each subdirectory
include $(patsubst %,%/config.mk,$(DIRS))


# Define variables that depend on stuff defined by sub-configs
CPPFLAGS := $(INC_DIRS) $(CPP_WARNING_FLAGS) $(CPP_ARCH_FLAGS) $(CPP_FEATURE_FLAGS) -pthread -DNO_X11

XPTS := $(IDLS:.idl=.xpt)
IDL_HEADERS := $(IDLS:.idl=.h)
OBJS := $(patsubst %.cpp,%.o, $(filter %.cpp,$(SOURCES))) \
	$(patsubst %.mm,%.o, $(filter %.mm,$(SOURCES)))
DEPS := $(OBJS:.o=.d)


# Include generated dependency files - this will create them if they don't exist
include $(DEPS)



$(LIB_NAME): $(OBJS)
	$(CC) -o $@ $(CPPFLAGS) $(LIB_DIRS) $(LIBS) $(GECKO_SDK)/lib/libxpcomglue_s.a -bundle $(OBJS)

%.h : %.idl
	$(GECKO_SDK)/bin/xpidl -m header -I $(GECKO_SDK)/idl -e $@ $<

%.xpt : %.idl
	$(GECKO_SDK)/bin/xpidl -m typelib -I $(GECKO_SDK)/idl -e $@ $<

%.o : %.mm
	$(CC) -c -o $@ $(CPPFLAGS) $< 

%.d: %.cpp
	./depend.sh `dirname $*.cpp` $(INC_DIRS) $*.cpp > $@

%.d: %.mm
	./depend.sh `dirname $*.mm` $(INC_DIRS) $*.mm > $@

$(XPT_NAME) : $(XPTS)
	$(GECKO_SDK)/bin/xpt_link $@ $^

$(XPI_DIR) : $(XPI_COMPONENT_FILES) $(XPI_ROOT_FILES)
	mkdir -p $(XPI_DIR)/
	touch $(XPI_DIR)
	cp $(XPI_ROOT_FILES) $(XPI_DIR)/
	mkdir -p $(XPI_DIR)/components/
	cp $(XPI_COMPONENT_FILES) $(XPI_DIR)/components/

$(XPI_NAME) : $(XPI_DIR)
	rm -f $(XPI_NAME)
	cd $(XPI_DIR) && zip -r $(CURDIR)/$(XPI_NAME) *