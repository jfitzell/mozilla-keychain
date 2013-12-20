Components.utils.import('resource://macos-keychain/KeychainServices.jsm');
Components.utils.import('resource://macos-keychain/frameworks/Security.jsm');

// Test that UTF characters are working
KeychainServices.addInternetPassword('Passwords\xA0not\xA0saved',
	'paßword', Security.kSecProtocolTypeHTTP, 'localhøst', 0,
	'/foo/bår/', Security.kSecAuthenticationTypeHTMLForm, 'S¥stem Domain',
	'£5 for you', '∞ and beyond');

KeychainServices.addGenericPassword('Passwords\xA0not\xA0saved',
	'paßword', 'S¥stem Service',
	'£5 for you', '∞ and beyond');

// Test that default paramters are working
KeychainServices.addInternetPassword();

KeychainServices.addInternetPassword(null, null, null, null, null,
		null, null, null, null, null);


var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(
	Components.interfaces.nsILoginManager
);

var nsLoginInfo = new Components.Constructor(
	"@mozilla.org/login-manager/loginInfo;1",
	Components.interfaces.nsILoginInfo,
	"init"
);

var login = new nsLoginInfo('about:me', null, 'User Registration', 'bob', '123sEcReT', '', '');

loginManager.addLogin(login);