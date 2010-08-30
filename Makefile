# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Keychain Services Integration Extension for Mozilla.
#
# The Initial Developer of the Original Code is
# Julian Fitzell <jfitzell@gmail.com>.
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

# Environment config
GECKO_SDK := ../sdks/xulrunner-sdk-2.0b5pre-i386
GECKO2 := yes

CC := g++

# Generated filenames
LIB_NAME := libmacoskeychain.dylib
XPI_NAME := macos-keychain.xpi
XPT_NAME := $(patsubst %.xpi,%.xpt,$(XPI_NAME))

# Directory used to build the XPI
XPI_DIR := xpi-staging

# Subdirectories (used to load sub-config files)
DIRS := public src

# Compiler configuration
# Warning flags
FLAGS += -Wall -Wpointer-arith -Woverloaded-virtual -Wsynth -Wno-ctor-dtor-privacy -Wno-non-virtual-dtor -Wcast-align -Wno-invalid-offsetof -Wno-long-long

# CPU Arch flags
FLAGS += -arch i386 -mmacosx-version-min=10.5 -isysroot /Developer/SDKs/MacOSX10.5.sdk
#FLAGS += -arch ppc

# Feature flags
FLAGS += -fPIC -fno-rtti -fno-exceptions -fno-strict-aliasing -fpascal-strings -fno-common -fshort-wchar


# Variables overridden by sub-configs
SOURCES :=
IDLS :=
INC_DIRS := -I$(GECKO_SDK)/include/ -I.

LIBS := 
LIB_DIRS := -L$(GECKO_SDK)/lib

XPI_ROOT_FILES := install.rdf chrome.manifest CHANGES
XPI_COMPONENT_FILES := $(LIB_NAME) $(XPT_NAME)
XPI_PREFS := prefs.js

ifdef GECKO2
# Enable GECKO 2.0 support in MacOSKeychainModule.cpp
FLAGS += -DGECKO_2
INC_DIRS += -include mozilla-config.h
# Disable moz_malloc for GECKO 1.9.x compatibility
FLAGS += -DMOZ_NO_MOZALLOC
GLUELIB := libxpcomglue_s_nomozalloc.a
#Seemed to need this for building with Gecko 2.0 without -DMOZ_NO_MOZALLOC
#LIBS += -lmozalloc
else #GECKO2
GLUELIB := libxpcomglue_s.a
endif #GECKO2


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
CPPFLAGS := $(INC_DIRS) $(FLAGS) -pthread -DNO_X11

XPTS := $(IDLS:.idl=.xpt)
IDL_HEADERS := $(IDLS:.idl=.h)
OBJS := $(patsubst %.cpp,%.o, $(filter %.cpp,$(SOURCES))) \
	$(patsubst %.mm,%.o, $(filter %.mm,$(SOURCES)))
DEPS := $(OBJS:.o=.d)


# Include generated dependency files - this will create them if they don't exist
include $(DEPS)



$(LIB_NAME): $(OBJS)
	$(CC) -o $@ $(CPPFLAGS) $(LIB_DIRS) $(LIBS) $(GECKO_SDK)/lib/$(GLUELIB) -bundle $(OBJS)

%.h : %.idl
	$(GECKO_SDK)/bin/xpidl -m header -I $(GECKO_SDK)/idl -e $@ $<

%.xpt : %.idl
	$(GECKO_SDK)/bin/xpidl -m typelib -I $(GECKO_SDK)/idl -e $@ $<

%.o : %.mm
	$(CC) -c -o $@ $(CPPFLAGS) $< 

%.d: %.cpp
	./depend.sh `dirname $*.cpp` $(INC_DIRS) $(CPPFLAGS) $*.cpp > $@

%.d: %.mm
	./depend.sh `dirname $*.mm` $(INC_DIRS) $(CPPFLAGS) $*.mm > $@

$(XPT_NAME) : $(XPTS)
	$(GECKO_SDK)/bin/xpt_link $@ $^

$(XPI_DIR) : $(XPI_COMPONENT_FILES) $(XPI_ROOT_FILES) $(XPI_PREFS)
	mkdir -p $(XPI_DIR)/
	touch $(XPI_DIR)
	cp $(XPI_ROOT_FILES) $(XPI_DIR)/
	mkdir -p $(XPI_DIR)/components/
	cp $(XPI_COMPONENT_FILES) $(XPI_DIR)/components/
	mkdir -p $(XPI_DIR)/defaults/preferences/
	cp $(XPI_PREFS) $(XPI_DIR)/defaults/preferences/

$(XPI_NAME) : $(XPI_DIR)
	rm -f $(XPI_NAME)
	cd $(XPI_DIR) && zip -r $(CURDIR)/$(XPI_NAME) *
