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

//Components.utils.import("resource://gre/modules/ctypes.jsm");
Components.utils.import("resource://macos-keychain/Security.jsm");
Components.utils.import("resource://macos-keychain/KeychainItem.jsm");
Components.utils.import("resource://macos-keychain/MacOSKeychain.jsm");
Components.utils.import("resource://macos-keychain/MacOSKeychainLogger.jsm");
 
const Cc = Components.classes;
const Ci = Components.interfaces;

const prefImportPrompt = "startup-import-prompt";

/**
 POSSIBLE TODO:
	+ two-way conversion between keychain and mozStorage
	+ fall-through to mozStorage
	+ store items so other browsers can access
	+ allow storage of master password instead of all passwords
	+ implement exception list using kSecNegativeItemAttr? (but Safari doesn't use it - check for a password of " " or "" or a specific username string
	+ set (and honor?) the item comment to "default" like Safari
	+ username field and password field could possibly be stored in the comments if needed
	+ creator code (and only remove items created by us on remove all?)
	+ camino caches the items to avoid prompting the user again on compare of the password they entered
	+ camino searches without port or domain because safari sometimes sets neither
*/

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function MacOSKeychainStorage() {
};

MacOSKeychainStorage.prototype = {
	classID: Components.ID("{87d15ebf-2a51-4e54-9290-315a54feea25}"),
	QueryInterface : XPCOMUtils.generateQI([Ci.nsILoginManagerStorage,
										Ci.IMacOSKeychainStartupImporter]),
	
	/**
	 =======================================
		Mozilla Storage API implementations
	 =======================================
	 */
	
	/**
	 * initWithFile()
	 * Just pass the filenames on to our mozilla storage instance. The filenames
	 *	are kind of useless to this implementation of the storage interface so I
	 *	don't know what else we'd do with them.
	 */
	initWithFile: function (aInputFile, aOutputFile) {
		MacOSKeychainLogger.trace("initWithFile(" + aInputFile + "," + aOutputFile + ")");
		
		MacOSKeychain.initializeDefaultStorage(aInputFile, aOutputFile);
	},
	
	init: function () {
	
	},
	
	addLogin: function (login) {
		MacOSKeychainLogger.trace("addLogin[ login: (" + MacOSKeychain.debugStringForLoginInfo(login) + ") ]");

		try {
			MacOSKeychain.addLogin(login);
		} catch (e) {
			// we don't yet support storing things with hostnames that are not
			//	valid URLs. We could store them as Generic items in the future.
			MacOSKeychainLogger.log('Adding login failed with: ' + e);
			MacOSKeychainLogger.log('Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.addLogin(login);
		}
	},
	
	
	removeLogin: function (login) {
		MacOSKeychainLogger.trace("removeLogin()");
		//return MacOSKeychain.defaultStorage.removeLogin(login);
		if (! MacOSKeychain.supportedURL(login.hostname)) {
			MacOSKeychainLogger.log('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.removeLogin(login);
		}
		
		var item = MacOSKeychain.findKeychainItemForLoginInfo(login);
		if (item) {
			item.delete();
			MacOSKeychainLogger.log("  Login successfully removed");
		} else {
			MacOSKeychainLogger.log("  No matching login found");
		}
	},
	
	
	modifyLogin: function (oldLogin, newLoginData) {
		MacOSKeychainLogger.trace('modifyLogin[ oldLogin:' + oldLogin + ' newLogin:' + newLoginData + ' ]');
		//return MacOSKeychain.defaultStorage.modifyLogin(oldLogin, newLogin);
		if (! MacOSKeychain.supportedURL(oldLogin.hostname)) {
			MacOSKeychainLogger.log('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.modifyLogin(oldLogin, newLogin);
		}
		
		var item = MacOSKeychain.findKeychainItemForLoginInfo(oldLogin);
		if (! item) {
			MacOSKeychainLogger.log('  No matching login found');
			throw Error('No matching login found');
			return;
		}
		
		if (newLoginData instanceof Ci.nsILoginInfo) {
			MacOSKeychain.updateItemWithLoginInfo(item, newLoginData);
		} else if (newLoginData instanceof Ci.nsIPropertyBag) {
			MacOSKeychain.updateItemWithProperties(item, newLoginData);
		} else {
			throw Error('Unsupported parameter type provided for new login data');
		}
	},
	
	
	getAllLogins: function (count) {
		MacOSKeychainLogger.trace('getAllLogins()');
		//return MacOSKeychain.defaultStorage.getAllLogins(count);
		
		var items = KeychainItem.findInternetPasswords(null /*accountName*/,
														null /*protocol*/,
														null /*serverName*/, 
														null /*port*/,
														null /*authType*/,
														null /*securityDomain*/);

		var logins = MacOSKeychain.convertKeychainItemsToLoginInfos(items);
		
		MacOSKeychainLogger.log('  Found ' + logins.length + ' logins');
		
		count.value = logins.length;
		return logins;
	},
	
	
	removeAllLogins: function () {
		MacOSKeychainLogger.trace('removeAllLogins()');
		//return MacOSKeychain.defaultStorage.removeAllLogins();
		var items = KeychainItem.findInternetPasswords(null /*accountName*/,
														null /*protocol*/,
														null /*serverName*/, 
														null /*port*/,
														null /*authType*/,
														null /*securityDomain*/);
		
		for ( var i in items ) {
			MacOSKeychainLogger.log('  Deleting ' + items[i].serverName);
			items[i].delete();
		}
	},
	
	
	getAllDisabledHosts: function (count) {
		MacOSKeychainLogger.trace('getAllDisabledHosts()');
		return MacOSKeychain.defaultStorage.getAllDisabledHosts(count);
	},
	
	
	getLoginSavingEnabled: function (hostname) {
		MacOSKeychainLogger.trace('getLoginSavingEnabled[ hostname:' + hostname + ' ]');
		return MacOSKeychain.defaultStorage.getLoginSavingEnabled(hostname);
	},
	
	
	setLoginSavingEnabled: function (hostname, enabled) {
		MacOSKeychainLogger.trace('setLoginSavingEnabled[ hostname:' + hostname + ' enabled:' + enabled + ' ]');
		return MacOSKeychain.defaultStorage.setLoginSavingEnabled(hostname, enabled);
	},
	
	/**
	 * Note: as specified in the Mozilla documentation at:
	 *	 https://developer.mozilla.org/en/NsILoginManagerStorage#findLogins%28%29
	 *	An empty string for hostname, formSubmitURL, and httpRealm means match
	 *	ALL values and a null value means match only items with NO value
	 */
	findLogins: function (count, hostname, formSubmitURL, httpRealm) {
		MacOSKeychainLogger.trace('findLogins['
						 + ' hostname:' + hostname
						 + ' formSubmitURL:' + formSubmitURL
						 + ' httpRealm:' + httpRealm + ' ]');
		if (! MacOSKeychain.supportedURL(hostname)) {
			MacOSKeychainLogger.log('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
		}
		
		var items;
		try {
			items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, httpRealm);
		} catch (e) {
			// LoginManager seems to silently catch errors thrown by findLogins()
			//  so we log them instead
			MacOSKeychainLogger.error('findKeychainItems() [1] failed with: ' + e);
			items = new Array();
		}
		
		// Safari seems not to store the HTTP Realm in the securityDomain
		//	field so we try the search again without it.
		if (items.length == 0 && httpRealm != null && httpRealm != '') {
			try {
				items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, '' /*httpRealm*/);
			} catch (e) {
				MacOSKeychainLogger.error('findKeychainItems() [2] failed with: ' + e);
				items = new Array();
			}								
											
			for (var i in items) {
				items[i].securityDomain = httpRealm;
			}
		}
		
		if (items.length == 0 /* && an appropriate preference is set*/) {
			MacOSKeychainLogger.log('No items found. Checking mozilla storage...');
			return MacOSKeychain.defaultStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
		}
		
		var logins;
		try {
			logins = MacOSKeychain.convertKeychainItemsToLoginInfos(items);
		} catch (e) {
			MacOSKeychainLogger.error('convertKeychainItemsToLoginInfos() failed with: ' + e);
			logins = new Array();
		}	
		
		count.value = logins.length;
		return logins;
	},
	
	
	countLogins: function (hostname, formSubmitURL, httpRealm) {
		MacOSKeychainLogger.trace('countLogins['
						 + ' hostname:' + hostname
						 + ' formSubmitURL:' + formSubmitURL
						 + ' httpRealm:' + httpRealm + ' ]');
		if (! MacOSKeychain.supportedURL(hostname)) {
			MacOSKeychainLogger.log('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.countLogins(hostname, formSubmitURL, httpRealm);
		}
		
		var items;
		try {
			items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, httpRealm);
		} catch (e) {
			// LoginManager seems to silently catch errors thrown by countLogins()
			//  so we log them instead
			MacOSKeychainLogger.error('findKeychainItems() [1] failed with: ' + e);
			items = new Array();
		}
				
		// Safari seems not to store the HTTP Realm in the securityDomain
		//	field so we try the search again without it.
		if (items.length == 0 && httpRealm != null && httpRealm != '') {
			try {
				items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, '' /*httpRealm*/);
			} catch (e) {
				// LoginManager seems to silently catch errors thrown by countLogins()
				//  so we log them instead
				MacOSKeychainLogger.error('findKeychainItems() [2] failed with: ' + e);
				items = new Array();
			}
		}
				
		if (items.length == 0 /* && TODO: an appropriate preference is set*/) {
			MacOSKeychainLogger.log('No items found. Checking mozilla storage...');
			return MacOSKeychain.defaultStorage.countLogins(hostname, formSubmitURL, httpRealm);
		}
		
		return items.length;
	},
	
	searchLogins: function() {
		// to be implemented (See Issue 36)
		throw Error('Not yet implemented: searchLogins()');
	},
	
	get uiBusy() {
		return false;
	}
};



var NSGetFactory = XPCOMUtils.generateNSGetFactory([MacOSKeychainStorage]);