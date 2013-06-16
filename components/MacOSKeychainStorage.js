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
 * Portions created by the Initial Developer are Copyright (C) 2009-13
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

Components.utils.import("resource://macos-keychain/MacOSKeychain.jsm");
Components.utils.import("resource://macos-keychain/Logger.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

/***
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

/**
 * This interface is implemented by modules that wish to provide storage
 *  mechanisms for the Login Manager.
 * @external nsILoginManagerStorage
 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage}
 */

/**
 * @constructor
 * @augments external:nsILoginManagerStorage
 */
function MacOSKeychainStorage() {
};

MacOSKeychainStorage.prototype = {
	classID: Components.ID("{87d15ebf-2a51-4e54-9290-315a54feea25}"),
	QueryInterface : XPCOMUtils.generateQI([Ci.nsILoginManagerStorage]),

	/**
	 =======================================
		Mozilla Storage API implementations
	 =======================================
	 */

	/**
	 * Just pass the filenames on to our mozilla storage instance. The filenames
	 *	are kind of useless to this implementation of the storage interface so I
	 *	don't know what else we'd do with them.
	 */
	initWithFile: function (aInputFile, aOutputFile) {
		Logger.trace(arguments);

		MacOSKeychain.initializeDefaultStorage(aInputFile, aOutputFile);
	},

	init: function () {
		Logger.trace(arguments);

	},

	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#addLogin()}
	 */
	addLogin: function (login) {
		Logger.log('-> addLogin('
			+ MacOSKeychain.debugStringForLoginInfo(login)
			+ ')');


		try {
			MacOSKeychain.addLogin(login);
		} catch (e) {
			// we don't yet support storing things with hostnames that are not
			//	valid URLs. We could store them as Generic items in the future.
			Logger.warning('Adding login failed', e);
			Logger.log('Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.addLogin(login);
		}
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#removeLogin()}
	 */
	removeLogin: function (login) {
		Logger.log('-> removeLogin('
			+ MacOSKeychain.debugStringForLoginInfo(login)
			+ ')');
		//return MacOSKeychain.defaultStorage.removeLogin(login);


		if (! MacOSKeychain.supportedURL(login.hostname)) {
			Logger.warning('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.removeLogin(login);
		}

		var item = MacOSKeychain.findKeychainItemForLoginInfo(login);
		if (item) {
			item.delete();
			Logger.log("  Login successfully removed");
		} else {
			Logger.log("  No matching login found");
		}
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#modifyLogin()}
	 */
	modifyLogin: function (oldLogin, newLoginData) {
		Logger.log('-> removeLogin('
			+ MacOSKeychain.debugStringForLoginInfo(oldLogin)
			+ ', '
			+ ((newLoginData instanceof Ci.nsILoginInfo) ?
				MacOSKeychain.debugStringForLoginInfo(newLoginData) :
				MacOSKeychain.debugStringForPropertyBag(newLoginData))
			+ ')');
		//return MacOSKeychain.defaultStorage.modifyLogin(oldLogin, newLogin);


		if (! MacOSKeychain.supportedURL(oldLogin.hostname)) {
			Logger.warning('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.modifyLogin(oldLogin, newLogin);
		}

		var item = MacOSKeychain.findKeychainItemForLoginInfo(oldLogin);
		if (! item) {
			Logger.log('  No matching login found');
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


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#getAllLogins()}
	 */
	getAllLogins: function (count) {
		Logger.log('-> getAllLogins()');
		//return MacOSKeychain.defaultStorage.getAllLogins(count);


		var items = MacOSKeychain.findKeychainItems(
				'' /*username*/, '' /*hostname*/,
				'' /*formSubmitURL*/, '' /*httpRealm*/);

		var logins = MacOSKeychain.convertKeychainItemsToLoginInfos(items);

		Logger.log('  Found ' + logins.length + ' logins');

		if (count)
			count.value = logins.length;
		return logins;
	},


/*	getAllEncryptedLogins: function() {
		Logger.log('-> getAllEncryptedLogins()');


		throw Error('Not yet implemented: getAllEncryptedLogins()');
	},*/


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#removeAllLogins()}
	 */
	removeAllLogins: function () {
		Logger.log('-> removeAllLogins()');
		//return MacOSKeychain.defaultStorage.removeAllLogins();


		var items = MacOSKeychain.findKeychainItems(
				'' /*username*/, '' /*hostname*/,
				'' /*formSubmitURL*/, '' /*httpRealm*/);

		for ( var i in items ) {
			Logger.log('  Deleting ' + items[i].serverName);
			items[i].delete();
		}
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#getAllDisabledHosts()}
	 */
	getAllDisabledHosts: function (count) {
		Logger.log('-> getAllDisabledHosts()');


		return MacOSKeychain.defaultStorage.getAllDisabledHosts(count);
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#getLoginSavingEnabled()}
	 */
	getLoginSavingEnabled: function (hostname) {
		Logger.log('-> getLoginSavingEnabled('
				+ Logger.stringify(hostname) + ')');


		return MacOSKeychain.defaultStorage.getLoginSavingEnabled(hostname);
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#setLoginSavingEnabled()}
	 */
	setLoginSavingEnabled: function (hostname, enabled) {
		Logger.log('-> setLoginSavingEnabled('
				+ [hostname, enabled].map(Logger.stringify).toString()
				+ ')');


		return MacOSKeychain.defaultStorage.setLoginSavingEnabled(hostname, enabled);
	},

	/**
	 * Note: as specified in the Mozilla documentation at:
	 *	 https://developer.mozilla.org/en/NsILoginManagerStorage#findLogins%28%29
	 *	An empty string for hostname, formSubmitURL, and httpRealm means match
	 *	ALL values and a null value means match only items with NO value
	 *
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#findLogins()}
	 */
	findLogins: function (count, hostname, formSubmitURL, httpRealm) {
		Logger.log('-> findLogins('
				+ [hostname, formSubmitURL,
					httpRealm].map(Logger.stringify).toString()
				+ ')');


		if (! MacOSKeychain.supportedURL(hostname)) {
			Logger.warning('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
		}

		var items;
		try {
			items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, httpRealm);
		} catch (e) {
			// LoginManager seems to silently catch errors thrown by findLogins()
			//  so we log them instead
			Logger.error('Finding logins[1] failed', e);
			items = new Array();
		}

		// Safari seems not to store the HTTP Realm in the securityDomain
		//	field so we try the search again without it.
		if (items.length == 0 && httpRealm != null && httpRealm != '') {
			try {
				items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, '' /*httpRealm*/);
			} catch (e) {
				Logger.error('Finding logins[2] failed', e);
				items = new Array();
			}

			for (var i in items) {
				items[i].securityDomain = httpRealm;
			}
		}

		if (items.length == 0 /* && an appropriate preference is set*/) {
			Logger.log('No items found. Checking mozilla storage...');
			return MacOSKeychain.defaultStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
		}

		var logins;
		try {
			logins = MacOSKeychain.convertKeychainItemsToLoginInfos(items);
		} catch (e) {
			Logger.error('Finding logins[3] failed', e);
			logins = new Array();
		}

		if (count)
			count.value = logins.length;
		return logins;
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#countLogins()}
	 */
	countLogins: function (hostname, formSubmitURL, httpRealm) {
		Logger.log('-> countLogins('
				+ [hostname, formSubmitURL,
					httpRealm].map(Logger.stringify).toString()
				+ ')');


		if (! MacOSKeychain.supportedURL(hostname)) {
			Logger.warning('Chrome URLs are not currently supported. Falling back on mozilla storage...');
			return MacOSKeychain.defaultStorage.countLogins(hostname, formSubmitURL, httpRealm);
		}

		var items;
		try {
			items = MacOSKeychain.findKeychainItems('' /*username*/, hostname,
											formSubmitURL, httpRealm);
		} catch (e) {
			// LoginManager seems to silently catch errors thrown by countLogins()
			//  so we log them instead
			Logger.error('Counting logins[1] failed', e);
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
				Logger.error('Counting logins[2] failed', e);
				items = new Array();
			}
		}

		if (items.length == 0 /* && TODO: an appropriate preference is set*/) {
			Logger.log('No items found. Checking mozilla storage...');
			return MacOSKeychain.defaultStorage.countLogins(hostname, formSubmitURL, httpRealm);
		}

		return items.length;
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#searchLogins()}
	 */
	searchLogins: function() {
		Logger.log('-> searchLogins()');


		// to be implemented (See Issue 36)
		throw Error('Not yet implemented: searchLogins()');
	},


	/*
	 * @see {@link https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILoginManagerStorage#Attributes}
	 */
	get uiBusy() {
		return MacOSKeychain.defaultStorage.uiBusy;
	}
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([MacOSKeychainStorage]);


/*
// This code could form the start of not needing chrome.manifest to register
//   components. This is needed if you want to install components without
//   restarting.
// Unfortunately, it doesn't actually look like that will work, since
//   LoginManager only checks on startup. Could maybe submit a patch for that,
//   though?

// Register component (not tested... may not be quite right)
Components.manager.QueryInterface(Ci.nsIComponentRegistrar).registerFactory(
	MacOSKeychainStorage.classID,
	'@fitzell.ca/macos-keychain/storage;1',
	'@fitzell.ca/macos-keychain/storage;1',
	NSGetFactory);

// Register the new component so that LoginManager will use it (this is
//  tested and works, but needs to happen before LoginManager first tried
//  to get a password, which means it doesn't help avoid a restart after
//  installing)
var catman = Cc['@mozilla.org/categorymanager;1'].getService(Ci.nsICategoryManager);
catman.addCategoryEntry('login-manager-storage',
	'nsILoginManagerStorage',
	'@fitzell.ca/macos-keychain/storage;1',
	false,
	true);
*/
