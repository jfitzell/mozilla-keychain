Components.utils.import('resource://gre/modules/ctypes.jsm');
Components.utils.import('resource://macos-keychain/MacTypes.jsm');
Components.utils.import('resource://macos-keychain/CoreFoundation.jsm');
Components.utils.import('resource://macos-keychain/Framework.jsm');

const EXPORTED_SYMBOLS = ['CoreServices'];

function CoreServicesFramework() {};
CoreServicesFramework.prototype = new Framework('CoreServices');

var CoreServices = new CoreServicesFramework();



var cs = CoreServicesFramework.prototype;

cs.FSRef = new ctypes.StructType("FSRef", [
				{hidden: MacTypes.UInt8.array(80)}
			]);

cs.declare('LSFindApplicationForInfo',
				ctypes.default_abi,
				MacTypes.OSStatus,
				MacTypes.OSType, // inCreator
				CoreFoundation.CFStringRef, // inBundleID
				CoreFoundation.CFStringRef, // inName
				CoreServices.FSRef.ptr, // outAppRef
				CoreFoundation.CFURLRef.ptr); // outAppURL
				
cs.declare('LSOpenFSRef',
				ctypes.default_abi,
				MacTypes.OSStatus,
				CoreServices.FSRef.ptr, // inRef
				CoreServices.FSRef.ptr); // outLaunchedRef

