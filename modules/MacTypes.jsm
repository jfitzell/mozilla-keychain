Components.utils.import('resource://gre/modules/ctypes.jsm');

const EXPORTED_SYMBOLS = ['MacTypes'];

var MacTypes = {};

MacTypes.noErr = 0;

MacTypes.Boolean = ctypes.unsigned_char;
MacTypes.UInt8 = ctypes.uint8_t;
MacTypes.SInt8 = ctypes.int8_t;
MacTypes.UInt16 = ctypes.uint16_t;
MacTypes.SInt16 = ctypes.int16_t;
MacTypes.UInt32 = ctypes.uint32_t;
MacTypes.SInt32 = ctypes.int32_t;
MacTypes.FourCharCode = MacTypes.UInt32;
MacTypes.OSType = MacTypes.FourCharCode;
MacTypes.OSStatus = MacTypes.SInt32;
MacTypes.UTF32Char = MacTypes.UInt32;
MacTypes.UniChar = ctypes.jschar; // uint16 with automatic conversion
MacTypes.UTF16Char = ctypes.jschar; // uint16 with automatic conversion
MacTypes.UTF8Char = ctypes.char; // uint8 with automatic conversion

MacTypes.stringFromFourCharCode = function(uint32) {
	return String.fromCharCode(
		uint32 >> 24,
		(uint32 >> 16) & 0xFF,
		(uint32 >> 8) & 0xFF,
		uint32 & 0xFF);
};

MacTypes.fourCharCodeFromString = function(string) {
	return (string.charCodeAt(0) << 24) + (string.charCodeAt(1) << 16)
		+ (string.charCodeAt(2) << 8) + string.charCodeAt(3);
};