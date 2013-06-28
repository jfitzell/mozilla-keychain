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

const Cu = Components.utils;
Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/FileUtils.jsm');
Cu.import('resource://macos-keychain/frameworks/MacTypes.jsm');
Cu.import('resource://macos-keychain/frameworks/CoreServices.jsm');
Cu.import('resource://macos-keychain/frameworks/CoreFoundation.jsm');
Cu.import('resource://macos-keychain/frameworks/Security.jsm');
Cu.import('resource://macos-keychain/Logger.jsm');
Cu.import('resource://macos-keychain/Preferences.jsm');
Cu.import('resource://macos-keychain/KeychainItem.jsm');

/**
 * @module KeychainServices
 */

/**
 * The buffer size to allocate for filenames used by the Secutiy framework
 * @constant
 */
const PATH_BUFFER_SIZE = 1024;

const EXPORTED_SYMBOLS = ['KeychainServices'];

/**
 * @namespace KeychainServices
 */
var KeychainServices =
/** @lends KeychainServices. */
{

	/**
	 *
	 * @function
	 */
	addInternetPassword: function(accountName,
										password,
										protocolType,
										serverName,
										port,
										path,
										authenticationType,
										securityDomain,
										comment,
										label) {
		var keychainItemRef = new Security.SecKeychainItemRef;

		var portNumber = port ? port : 0;

		var status;
		doWithWriteKeychainRef(this, function(keychainRef) {
			var passwordArray = ctypes.char.array()(password);

			status = Security.SecKeychainAddInternetPassword(
					keychainRef,
					lengthOrZero(serverName), serverName,
					lengthOrZero(securityDomain), securityDomain,
					lengthOrZero(accountName), accountName,
					lengthOrZero(path), path,
					portNumber,
					protocolType, authenticationType,
					lengthOrZero(password),
					ctypes.cast(passwordArray.address(), ctypes.voidptr_t),
					keychainItemRef.address());
		});

		if (status == CoreServices.userCanceledErr) {
			Logger.log(
					'User canceled SecKeychainAddInternetPassword operation');
			return null;
		}

		testStatus(status, 'SecKeychainAddInternetPassword');

		try {
			var item = new KeychainItem(keychainItemRef);
			item.comment = comment;

			if (! label)
				item.setDefaultLabel();
			else
				item.label = label;
		} catch (e) {
			Security.SecKeychainItemDelete(keychainItemRef);
			// DEBUG: log the status in case it fails
			throw e;
		}

		return item;
	},

	/**
	   * A value of null for any parameter is interpreted as matching ALL values
	   *  (ie. the parameter is not included in the search criteria)
	   */
	findInternetPasswords: function (account, protocol,
			server, port, authenticationType, securityDomain) {
		Logger.trace(arguments);

		// We need to keep objects created inside nativeAttribute() in scope
		//  to prevent garbage collection
		var referencedObjects = [];

		var attributes = [];
		function addCriterion(tag, value) {
			if (value !== null) {
				var attribute = new KeychainItem.Attribute(tag);
				attribute.value = value;
				attributes.push(attribute.nativeAttribute(referencedObjects));
			}
		}

		addCriterion(Security.kSecAccountItemAttr, account);
		addCriterion(Security.kSecProtocolItemAttr, protocol);
		addCriterion(Security.kSecServerItemAttr, server);
		addCriterion(Security.kSecPortItemAttr, port);
		addCriterion(Security.kSecAuthenticationTypeItemAttr,
				authenticationType);
		addCriterion(Security.kSecSecurityDomainItemAttr, securityDomain);

	//	Logger.log(attributes.toSource());

		var searchCriteria = new Security.SecKeychainAttributeList();
		searchCriteria.count = attributes.length;
		if (attributes.length > 0) {
			var array = Security.SecKeychainAttribute.array()(attributes);
			searchCriteria.attr = array[0].address();
		} else {
			/* It should be initialized to null anyway,
			   but let's be clear what's going on... */
			searchCriteria.attr = null;
		}

		var searchRef = new Security.SecKeychainSearchRef;
		var status;
		var results = new Array();
		try { // Make sure to release searchRef
			doWithReadKeychainRef(this, function(keychainRef) {
				status = Security.SecKeychainSearchCreateFromAttributes(
						keychainRef,
						Security.kSecInternetPasswordItemClass,
						searchCriteria.address(),
						searchRef.address());
			});

			testStatus(status, 'SecKeychainSearchCreateFromAttributes');

			var keychainItemRef = new Security.SecKeychainItemRef();
			try {
				while ((status = Security.SecKeychainSearchCopyNext(
							searchRef,
							keychainItemRef.address()))
						== Security.errSecSuccess) {
					results[results.length] = new KeychainItem(keychainItemRef);
				}
			} finally {
				// Check whether we managed to get through the whole list
				//  and release all keychainItemRefs if we hit an error
				if (status != Security.errSecItemNotFound) {
					for (var i in results) {
						results[i].release();
					}
					if (! keychainItemRef.isNull())
						CoreFoundation.CFRelease(keychainItemRef);
					testStatus(status, 'SecKeychainSearchCopyNext');
				}
			}
		} finally {
			if (! searchRef.isNull())
				CoreFoundation.CFRelease(searchRef);
		}

		return results;
	},
};


/**
 * Evaluate a passed function with a valid reference to the keychain or
 *  serach list that should be used for reading.
 */
function doWithReadKeychainRef(thisArg, func) {
	var useSearchList = true; // TODO: replace this with a preference
	var searchList;
	var status;
	var result;

	if (! useSearchList)
		return doWithWriteKeychainRef(thisArg, func);

	var searchList = new CoreFoundation.CFArrayRef;
	try {
		var status = Security.SecKeychainCopySearchList(searchList.address());
		testStatus(status, 'SecKeychainCopySearchList');

		result = func.call(thisArg, searchList);
	} finally {
		if (! searchList.isNull()) CoreFoundation.CFRelease(searchList);
	}

	return result;
}

/**
 * Evaluate a passed function with a valid reference to the keychain
 *  that should be used for writing.
 *
 * This will check if a keychain path has been specified in the preferences
 *  and try to use it. If not set, the default keychain will be used.
 */
function doWithWriteKeychainRef(thisArg, func) {
	var keychainRef = new Security.SecKeychainRef;
	var keychainStatus = new Security.SecKeychainStatus;
	var status = -1;
	var result;
	var path = '';

	try {
		// Try the user-specified keychain if there is one
		if (Preferences.writeKeychain.hasUserValue()) {
			// Use an nsIFile to expand ~ and so on in path
			var file = new FileUtils.File(Preferences.writeKeychain.value);
			path = file.path;
			Logger.log('Opening keychain for write: ' + path);
			status = Security.SecKeychainOpen(
					path,
					keychainRef.address());
			if (status != Security.errSecSuccess) {
				Logger.error('Error opening keychain: '
						+ Security.stringForStatus(status));
			}
		}

		// If no keychain was specified or there was an error, use the default
		if (status != Security.errSecSuccess) {
			Logger.log('Opening default keychain for write');
			status = Security.SecKeychainCopyDefault(keychainRef.address());
			testStatus(status, 'SecKeychainCopyDefault');

			// Get the path of the default keychain for logging purposes below
			var sizeParam = MacTypes.UInt32(PATH_BUFFER_SIZE);
			var charArray = ctypes.char.array(PATH_BUFFER_SIZE)();
			status = Security.SecKeychainGetPath(keychainRef,
					sizeParam.address(),
					ctypes.cast(charArray.address(), ctypes.char.ptr));
			if (status == Security.errSecBufferTooSmall) {
				Logger.warning('Buffer too small (' + PATH_BUFFER_SIZE
						+ ') fetching keychain path');
				path = '<buffer to small>';
			} else {
				testStatus(status, 'SecKeychainGetPath');
				path = charArray.readString();
			}
		}

		status = Security.SecKeychainGetStatus(keychainRef,
				keychainStatus.address());
		Logger.log('SecKeychainGetStatus result: '
				+ Security.stringForStatus(status));
		if (status == Security.errSecNoSuchKeychain)
			throw Error('Error opening keychain: no keychain found at filesystem path ' + path);
		else if (status == Security.errSecInvalidKeychain)
			throw Error ('Error opening keychain: keychain at filesystem path '
					+ path + ' is invalid');
		else
			testStatus(status, 'SecKeychainGetStatus');

		result = func.call(thisArg, keychainRef);
	} finally {
		if (! keychainRef.isNull()) CoreFoundation.CFRelease(keychainRef);
	}

	return result;
};


/**
 * Return the length of the arguement, or 0 if it does not implement length
 *  or there is an error asking for the length.
 *
 * @param {*} object
 * @returns {integer}
 */
function lengthOrZero(object) {
	if (! object)
		return 0;

	try {
		return object.length;
	} catch (e) {
		return 0;
	}
};


/**
 * Check the OSStatus and throw and error if it does not indicate success
 *
 * @param {external:OSStatus} status The result of API call
 * @param {string} functionString The name of the API that returned
 *  the OSStatus object
 * @param {string} [contextString] What the application was doing when making
 *  the call to the API
 */
function testStatus(status, functionString, contextString) {
	var whileString = (contextString === undefined)
			? '' : 'While ' + contextString + ', ';
	if (status == Security.errSecSuccess) {
		Logger.trace(functionString + '() successful', 1);
	} else  {
		var err = new Error('KeychainServices.jsm - ' + whileString
				+ functionString + '() returned '
				+ status.toString() + ': ' + Security.stringForStatus(status));
		err.name = 'Security Framework Error';
		err.status = status;
		err.fn = functionString;
		throw err;
	}
};