LIBS += -lxpcom \
	-lnspr4 \
	-framework Foundation \
	-framework Security

SOURCES += src/MacOSKeychainModule.cpp \
	src/MacOSKeychainUtils.cpp \
	src/MacOSKeychainItem.mm \
	src/MacOSKeychainService.mm

XPI_COMPONENT_FILES += src/MacOSKeychainStorage.js


