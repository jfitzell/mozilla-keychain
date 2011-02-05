Components.utils.import('resource://gre/modules/ctypes.jsm');
Components.utils.import('resource://macos-keychain/MacTypes.jsm');
Components.utils.import('resource://macos-keychain/Framework.jsm');

const EXPORTED_SYMBOLS = ['CoreFoundation'];

function CoreFoundationFramework() {};
CoreFoundationFramework.prototype = new Framework('CoreFoundation');

var CoreFoundation = new CoreFoundationFramework();


var cf = CoreFoundationFramework.prototype;

cf.CFTypeRef = ctypes.void_t.ptr;
cf.CFIndex = ctypes.long;
cf.CFRange = new ctypes.StructType('CFRange', [
				{'location': ctypes.int32_t},
				{'length': ctypes.int32_t}
			]);
cf.CFStringRef = new ctypes.StructType('__CFString').ptr;
cf.CFURLRef = new ctypes.StructType('__CFURL').ptr;
cf.CFDataRef = new ctypes.StructType('__CFData').ptr;
cf.CFAllocatorRef = new ctypes.StructType("__CFAllocator").ptr;

/*
 * CFString functions
 */
cf.declare('CFStringGetLength',
				ctypes.default_abi,
				ctypes.int32_t,           // returns the number of Unicode characters
				CoreFoundation.CFStringRef);        // the string to check

cf.declare('CFStringGetCharacters',
				ctypes.default_abi,
				ctypes.void_t,
				CoreFoundation.CFStringRef,         // the string to get characters from
				CoreFoundation.CFRange,             // the range of characters
				ctypes.jschar.ptr);        // pointer to buffer to receive chars

cf.declare('CFStringGetCharactersPtr',
				ctypes.default_abi,
				ctypes.jschar.ptr,
				CoreFoundation.CFStringRef);

cf.declare('CFStringGetCharacterAtIndex',
				ctypes.default_abi,
				ctypes.jschar,
				CoreFoundation.CFStringRef,
				CoreFoundation.CFIndex);
				
cf.declare('CFStringCreateWithCharacters',
				ctypes.default_abi,
				CoreFoundation.CFStringRef,
				CoreFoundation.CFAllocatorRef,
				MacTypes.UniChar.ptr,
				CoreFoundation.CFIndex);

/*
 * CFData functions
 */
cf.declare('CFDataCreate',
				ctypes.default_abi,
				CoreFoundation.CFDataRef,
				ctypes.voidptr_t, //CFAllocatorRef allocator,
				MacTypes.UInt8.ptr, // bytes,
				CoreFoundation.CFIndex // length
				);

cf.declare('CFDataGetLength',
				ctypes.default_abi,
				CoreFoundation.CFIndex,
				CoreFoundation.CFDataRef);

cf.declare('CFDataGetBytes',
				ctypes.default_abi,
				ctypes.void_t,
				CoreFoundation.CFDataRef,
				CoreFoundation.CFRange,
				MacTypes.UInt8.ptr);

cf.declare('CFDataGetBytePtr',
				ctypes.default_abi,
				MacTypes.UInt8.ptr,
				CoreFoundation.CFDataRef);

// Generic CFType routines
cf.declare('CFRelease',
				ctypes.default_abi,
				ctypes.void_t,
				ctypes.voidptr_t);
				
cf.CFStringToJSString = function(cfstr) {
	var len = this.CFStringGetLength(cfstr);
	var buffer = ctypes.jschar.array(len+1)();
	
	for (i=0; i < len; i++) {
		buffer[i] = this.CFStringGetCharacterAtIndex(cfstr, i);//, this.CFRange(0, len), buffer);
	}
	return buffer.readString();
};

cf.JSStringToCFString = function(jsstr) {
	return this.CFStringCreateWithCharacters(null, jsstr, jsstr.length);
}