var KeychainServices = {
/*  onLoad: function() {
    // initialization code
    this.initialized = true;
  },*/

	launchKeychainAccess: function() {
		Components.utils.import('resource://macos-keychain/CoreServices.jsm');
		Components.utils.import('resource://macos-keychain/CoreFoundation.jsm');

		var fsRef = new CoreServices.FSRef();
		var bundleId = CoreFoundation.JSStringToCFString('com.apple.keychainaccess');
		CoreServices.LSFindApplicationForInfo(0, bundleId, null, fsRef.address(), null);
		CoreFoundation.CFRelease(bundleId);
		CoreServices.LSOpenFSRef(fsRef.address(), null);
		CoreServices.close();
		CoreFoundation.close();
	},
};

//document.addEventListener("load", KeychainServices.initialize, true);
//window.addEventListener("unload", KeychainServices.shutdown, false);