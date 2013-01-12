/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Keychain Services Integration Extension for Mozilla.
 *
 * The Initial Developer of the Original Code is
 * Julian Fitzell <jfitzell@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
Components.utils.import("resource://gre/modules/ctypes.jsm");
Components.utils.import("resource://macos-keychain/frameworks/CoreFoundation.jsm");
Components.utils.import("resource://macos-keychain/frameworks/Security.jsm");
Components.utils.import("resource://macos-keychain/KeychainItem.jsm");
Components.utils.import("resource://macos-keychain/Logger.jsm");

const extensionId = "macos-keychain@fitzell.ca";

const Cc = Components.classes;
const Ci = Components.interfaces;

const EXPORTED_SYMBOLS = ['MacOSKeychain'];

// Get constructor for nsILoginInfo implementation
//  Doing so here makes getting new instances faster later since some of
//   the work is done up front and cached.
var LoginInfo = new Components.Constructor(
	"@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo);

var MacOSKeychain = {};

MacOSKeychain.__defineGetter__('extensionId', function() {
	return extensionId;
});

/**
 * An instance of the default storage component
 */
var _defaultStorage = null;
MacOSKeychain.__defineGetter__('defaultStorage', function() {
	if (! _defaultStorage) {
		this.initializeDefaultStorage();
	}
		
	return _defaultStorage;
});

/**
 * Initialize an instance of the default storage component that Mozilla would have
 *	used if this component was not registered. This has to try various contract IDs
 *	to account for different versions of Mozilla
 */
MacOSKeychain.initializeDefaultStorage = function (inFile, outFile) {
	try {
		if ("@mozilla.org/login-manager/storage/mozStorage;1" in Cc) {
			_defaultStorage = Cc["@mozilla.org/login-manager/storage/mozStorage;1"].
										createInstance(Ci.nsILoginManagerStorage);
		} else {
			_defaultStorage = Cc["@mozilla.org/login-manager/storage/legacy;1"].
										createInstance(Ci.nsILoginManagerStorage);
		}
 
		if (inFile || outFile)
			_defaultStorage.initWithFile(inFile, outFile);
		else
			_defaultStorage.init();
	} catch (e) {
		Logger.log("Initialization of mozilla login storage component failed: " + e);
		_defaultStorage = null;
		throw e;
	}
},

MacOSKeychain.convertKeychainItemsToLoginInfos = function (items) {
	Logger.trace('convertKeychainItemsToLoginInfo(...)');
	var logins = new Array();
	for ( var i in items ) {
		try {
			logins.push(this.convertKeychainItemToLoginInfo(items[i]));
		} catch (e) {
			Logger.log('Ignoring Keychain Item. Conversion failed with: ' + e);
		}
	}
	
	return logins;
};

/**
 * Create and initialize a new nsILoginInfo with the data in the provided
 *	Keychain Item.
 *
 */
MacOSKeychain.convertKeychainItemToLoginInfo = function (item) {
	Logger.trace("convertKeychainItemToLoginInfo[ item: (" +
					 this.debugStringForKeychainItem(item) + ") ]");
	var info = new LoginInfo();

	//Logger.log(item._attributes.toSource());
	var uriString = item.uriString;
	Logger.log("  URI String: " + uriString);
	var uri = _uri(uriString);
	// Remove the trailing slash from the URI since LoginManager doesn't put
	//	it there and uses a strict string comparison when checking the results
	//	of a find operation to determine if any of the LoginInfos is an exact match.
	var hostname = uri.spec.substring(0, uri.spec.length - 1);
	Logger.log("  Parsed URI: " + hostname);
	
	var formSubmitURL, httpRealm;
	if (Security.kSecAuthenticationTypeHTMLForm == item.authenticationType) {
		// nsLoginInfo.matches() allows two instances to match on the
		//	formSubmitURL field as long as one of them is blank (but not null).
		//	Since we have nowhere to store that field in the keychain, we take
		//	this route.
		formSubmitURL = "";
		httpRealm = null;
	} else { // non-form logins
		formSubmitURL = null;
		httpRealm = item.securityDomain;
	}
	
	// We cannot store the usernameField and passwordField. According to:
	//	 https://developer.mozilla.org/en/nsILoginInfo
	//	 they should be specify an empty string for non-form logins so that
	//	 is what we return
	info.init(hostname,
				formSubmitURL, httpRealm,
				item.account, null,
				"" /*usernameField*/, "" /*passwordField*/);
	
	info.wrappedJSObject.__defineGetter__("password", function() {return item.password});
	
	Logger.log("  " + this.debugStringForLoginInfo(info));
	
	return info;
};

MacOSKeychain.extractKeychainFieldsFromLoginInfo = function (loginInfo) {
	var fields = {};
	fields.accountName = loginInfo.username;
	fields.password = loginInfo.password;
	
	var [scheme, host, port] = MacOSKeychain.splitLoginInfoHostname(loginInfo.hostname);
	fields.protocol = Security.protocolForScheme(scheme);
	fields.serverName = host;
	fields.port = port;
	fields.label = host + ' (' + loginInfo.username + ')';
	fields.securityDomain = loginInfo.httpRealm;

	if (null != loginInfo.formSubmitURL) {
		fields.description = 'Web form password';
		fields.authenticationType = Security.kSecAuthenticationTypeHTMLForm;
	} else {
		fields.description = null;
		fields.authenticationType = Security.kSecAuthenticationTypeDefault;
	}
	
	return fields;
};

MacOSKeychain.updateItemWithLoginInfo = function (item, loginInfo) {
	var fields = this.extractKeychainFieldsFromLoginInfo(loginInfo);
		
	item.accountName = fields.accountName;
	item.password = fields.password;	
	item.protocol = fields.protocol;
	item.serverName = fields.serverName;
	item.port = fields.port;
	item.label = fields.label;
	item.securityDomain = fields.securityDomain;
	item.description = fields.description;
	item.authenticationType = fields.authenticationType;
	//item.path = ;
	//item.comment = ;
};

MacOSKeychain.updateItemWithProperties = function (item, properties) {
	var httpRealm = null;
	var formSubmitURL = null;
	var unknownProps = new Array();
	
	var propEnum = properties.enumerator;
	while (propEnum.hasMoreElements()) {
		var prop = propEnum.getNext().QueryInterface(Ci.nsIProperty);
		Logger.log('Setting property: ' + prop.name);
		switch (prop.name) {
			// nsILoginInfo properties...
			case "hostname":
				var [scheme, host, port] = MacOSKeychain.splitLoginInfoHostname(prop.value);
				item.protocol = Security.protocolForScheme(scheme);
				item.serverName = host;
				item.port = port;
				break;
				
			case "formSubmitURL":
				if (null != prop.value)
					item.authenticationType = Security.kSecAuthenticationTypeHTMLForm;
				else
					item.authenticationType = Security.kSecAuthenticationTypeDefault;
				break;
			
			case "httpRealm":
				item.securityDomain = prop.value;
				break;
			
			case "username":
				item.accountName = prop.value;
				break;
			
			case "password":
				item.password = prop.value;
				break;
			
			case "usernameField":
			case "passwordField":
			case "timesUsedIncrement":
			case "timeLastUsed":
			case "timePasswordChanged":
				Logger.log('--Unsupported property: ' + prop.name);
				// not supported
				break;

			// nsILoginMetaInfo properties...
			case "guid":
				// ???
				break;

			// Fail if caller requests setting an unknown property.
			default:
				Logger.warning('**Unknown property: ' + prop.name);
				unknownProps.push(prop.name);
		}
	}
		
	if (unknownProps.length > 0) {
		throw Error('Unexpected propertybag items: ' + unknownProps);
	}
};


/**
 * Find and return Keychain Items that match the values provided by the
 * Mozilla login storage API.
 *
 * This method converts the Mozilla API values into the values expected by
 *	the lower level native components.
 *
 * Note: as specified in the Mozilla documentation at:
 *	 https://developer.mozilla.org/en/NsILoginManagerStorage#findLogins%28%29
 *	hostname, formSubmitURL, and httpRealm support an empty string to match
 *	ALL values and a null value to match NO values (except null)
 * We also take the same approach with the username field.
 */
MacOSKeychain.findKeychainItems = function (username, hostname, formSubmitURL, httpRealm) {
	Logger.trace("findKeychainItems["
					 + " username:" + username
					 + " hostname:" + hostname
					 + " formSubmitURL:" + formSubmitURL
					 + " httpRealm:" + httpRealm + " ]");
	
	var accountName;
	if (null == username) // match only entries with no username
		accountName = "";
	else if ("" == username) // match ALL usernames
		accountName = null;
	else
		accountName = username;
	
	var scheme, host, port;
	if (null == hostname) // a null hostname matches NO entries
		return [];
	else if ("" == hostname) // an empty hostname matches ALL entries
		scheme = host = port = null;
	else {
		try {
			[scheme, host, port] = this.splitLoginInfoHostname(hostname);
		} catch (e) {
			// we don't yet support storing things with hostnames that are not
			//	valid URLs. We could store them as Generic items in the future.
			return [];
		}
	}
	
	var securityDomain;
	if ("" == httpRealm) // match ALL realms
		securityDomain = null;
	else if (null == httpRealm) // match only entries with NO realm
		securityDomain = "";
	else
		securityDomain = httpRealm;
	
	var authType;
	if ("" == formSubmitURL && "" == httpRealm) // match ANY type
		authType = null;
	else if (null != formSubmitURL) // match form logins only
		authType = Security.kSecAuthenticationTypeHTMLForm;
	else // match non-form logins only
		authType = Security.kSecAuthenticationTypeDefault;
	
	var protocolType = Security.protocolForScheme(scheme);
	
	Logger.trace("About to call KeychainItem.findInternetPasswords["
					 + " account:" + accountName
					 + " protocol:" + Security.stringFromProtocolType(protocolType)
					 + " server:" + host
					 + " port:" + port
					 + " authenticationType:" + Security.stringFromAuthenticationType(authType)
					 + " securityDomain:" + securityDomain + " ]");
	var items = KeychainItem.findInternetPasswords(accountName, protocolType, host,
												 port, authType, securityDomain);
																				 
	Logger.log("  Items found: " + items.length);
	
	return items;
};


/**
 * Search for and return a Keychain Item that matches the data in the
 *	provided nsILoginInfo object. If multiple matches are found, the first
 *	is returned. If none is found, null is returned.
 */
MacOSKeychain.findKeychainItemForLoginInfo = function (login) {
	Logger.trace("findKeychainItemForLoginInfo[ login:" + login + " ]");
	
	var items = this.findKeychainItems(login.username,
										login.hostname,
										login.formSubmitURL,
										login.httpRealm);
	
	if (items.length > 0)
		return items[0];
	else
		return null;
};


/**
 * Return a new URI object for the given string
 */
function _uri (uriString) {
	try {
		var ios = Components.classes["@mozilla.org/network/io-service;1"].
									getService(Components.interfaces.nsIIOService);
		return ios.newURI(uriString, null, null);
	} catch (e) {
		Logger.log(e);
		throw Error('Invalid URI');
	}
};

/**
 * Return a new URL object for the given string
 */
function _url (urlString) {
	var uri = _uri(urlString);
	try {
		var url = uri.QueryInterface(Ci.nsIURL);
		return url;
	} catch (e) {
		Logger.log(e);
		throw Error('Invalid URL');
	}
};


/**
 * The hostname field in nsILoginInfo contains the URI scheme, hostname,
 *	and port. This function takes an appropriately formatted string and
 *	returns a three-element array containing the scheme, hostname, and port.
 *	If any of the values is missing, null is provided for that position.
 */
MacOSKeychain.splitLoginInfoHostname = function (hostname) {
	Logger.trace("splitLoginInfoHostname[ hostname:" + hostname + " ]");
	var scheme = null;
	var host = null;
	var port = null;
	if (hostname) {
		try {
			var uri = _uri(hostname);
			scheme = uri.scheme;
			host = uri.host;
			port = uri.port;
		} catch (e) {
			throw Error("Unable to split hostname: " + e);
		}
		if (port == -1) // -1 indicates default port for the protocol
			port = null;
	}
	
	Logger.log("  scheme:" + scheme + " host:" + host + " port:" + port);
	return [scheme, host, port];
};


MacOSKeychain.debugStringForLoginInfo = function (login) {
	return "hostname:" + login.hostname +
				" formSubmitURL:" + login.formSubmitURL +
				" httpRealm:" + login.httpRealm +
				" username:" + login.username +
				" password:(omitted)" +
				" usernameField:" + login.usernameField +
				" passwordField:" + login.passwordField;
};


MacOSKeychain.debugStringForKeychainItem = function (item) {
	if (item === null)
		return 'null';
		
	return "protocol:" + Security.stringFromProtocolType(item.protocol) +
				" server:" + item.server +
				" port:" + item.port +
				" securityDomain:" + item.securityDomain +
				" account:" + item.account +
				" password:(omitted)" +
				" authenticationType:" + Security.stringFromAuthenticationType(item.authenticationType) +
				" comment:" + item.comment +
				" label:" + item.label +
				" description:" + item.description;
};

MacOSKeychain.addLogin = function (login) {
	if (! this.supportedURL(login.hostname)) {
		throw Error('Cannot add login because the URL scheme is not supported.');
	}
	
	var fields = this.extractKeychainFieldsFromLoginInfo(login);
	if (fields.protocolType == Security.kSecProtocolTypeAny)
			throw Error('Unable to determine ProtocolType for hostname: ' + login.hostname);

	var item = KeychainItem.addInternetPassword(fields.accountName, fields.password,
												 fields.protocol, fields.serverName,
												 fields.port, null /*path*/,
												 fields.authenticationType,
												 fields.securityDomain,
												 null /*comment*/, fields.label);
	item.description = fields.description;
	
	Logger.log("  keychain item: (" + this.debugStringForKeychainItem(item) + ")");
	
};

MacOSKeychain.supportedURL = function(hostname) {
	return ! /^chrome:\/\//.test(hostname);
};

MacOSKeychain.verifySignature = function() {
	try { // These APIs were only added in OS X 10.6
		var code = new Security.SecCodeRef;
		
		var status = Security.SecCodeCopySelf(Security.kSecCSDefaultFlags, code.address());
		Logger.log('SecCodeCopySelf() returned ' + status + ': ' + Security.stringForStatus(status));
		if (Security.errSecSuccess == status) {
			status = Security.SecCodeCheckValidity(code, Security.kSecCSDefaultFlags, null);
			
			if (Security.errSecSuccess == status) {
				Logger.log('The application binary passes signature verification.');
				return true;
			} else {
				Logger.log('SecCodeCheckValidity() returned ' + status + ': ' + Security.stringForStatus(status));
			}
		}
		
		Logger.warning("The application binary's signature cannot be verified; Keychain services may not function properly or you may be prompted repeatedly to allow access. Try upgrading your application to the newest version or deleting and reinstalling the application.");
		return false;
	} catch (e) {
		Logger.log('Verification of application signature failed with: ' + e);
		return null;
	}
};
