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
Cu.import('resource://macos-keychain/System.jsm');


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
	 * Add an Internet Password item to the keychain
	 * @param {string} [accountName=null]
	 * @param {string} [password=null]
	 * @param {Security.SecProtocolType} [protocolType=kSecProtocolTypeAny]
	 * @param {string} [serverName=null]
	 * @param {integer} [port=0]
	 * @param {string} [path=null]
	 * @param {Security.SecAuthenticationType}
	 		[authenticationType=kSecAuthenticationTypeAny]
	 * @param {string} [securityDomain=null]
	 * @param {string} [comment=null]
	 * @param {string} [label=null]
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
		cleanArgs = Array.slice(arguments);
		cleanArgs[1] = '(omitted)';
		Logger.trace(cleanArgs);

		// Set default values for optional parameters that Keychain requires
		port = port || 0;
		protocolType = protocolType || Security.kSecProtocolTypeAny;
		authenticationType = authenticationType
				|| Security.kSecAuthenticationTypeAny;

		var serverNameData = convertString(serverName, ctypes.char.ptr);
		var securityDomainData = convertString(securityDomain, ctypes.char.ptr);
		var accountNameData = convertString(accountName, ctypes.char.ptr);
		var pathData = convertString(path, ctypes.char.ptr);
		var passwordData = convertString(password, ctypes.voidptr_t);

		var keychainItemRef = new Security.SecKeychainItemRef;
		var status;
		doWithWriteKeychainRef(this, function(keychainRef) {
			status = Security.SecKeychainAddInternetPassword(
					keychainRef,
					serverNameData.size, serverNameData.pointer,
					securityDomainData.size, securityDomainData.pointer,
					accountNameData.size, accountNameData.pointer,
					pathData.size, pathData.pointer,
					port,
					protocolType, authenticationType,
					passwordData.size, passwordData.pointer,
					keychainItemRef.address());
		});

		if (status == CoreServices.userCanceledErr) {
			Logger.trace('User canceled operation');
			return null;
		}

		testStatus(status, 'SecKeychainAddInternetPassword');

		try {
			var item = new KeychainItem(keychainItemRef);
			item.creator = System.applicationCreatorCode();

			if (comment)
				item.comment = comment;

			if (label)
				item.label = label;
		} catch (e) {
			Security.SecKeychainItemDelete(keychainItemRef);
			// DEBUG: log the status in case it fails
			throw e;
		}

		return item;
	},

	/**
	 * Add a Generic Password item to the keychain
	 * @param {string} [accountName=null]
	 * @param {string} [password=null]
	 * @param {string} [serviceName=null]
	 * @param {string} [comment=null]
	 * @param {string} [label=null]
	 */
	addGenericPassword: function(accountName,
									password,
									serviceName,
									comment,
									label) {
		cleanArgs = Array.slice(arguments);
		cleanArgs[1] = '(omitted)';
		Logger.trace(cleanArgs);

		var serviceNameData = convertString(serviceName, ctypes.char.ptr);
		var accountNameData = convertString(accountName, ctypes.char.ptr);
		var passwordData = convertString(password, ctypes.voidptr_t);

		var keychainItemRef = new Security.SecKeychainItemRef;
		var status;
		doWithWriteKeychainRef(this, function(keychainRef) {
			status = Security.SecKeychainAddGenericPassword(
					keychainRef,
					serviceNameData.size, serviceNameData.pointer,
					accountNameData.size, accountNameData.pointer,
					passwordData.size, passwordData.pointer,
					keychainItemRef.address());
		});

		if (status == CoreServices.userCanceledErr) {
			Logger.trace('User canceled operation');
			return null;
		}

		testStatus(status, 'SecKeychainAddGenericPassword');

		try {
			var item = new KeychainItem(keychainItemRef);
			if (comment)
				item.comment = comment;

			if (label)
				item.label = label;
		} catch (e) {
			Security.SecKeychainItemDelete(keychainItemRef);
			// DEBUG: log the status in case it fails
			throw e;
		}

		return item;
	},

	/**
	 * Search for keychain items
	 * A value of null or undefined for any parameter is interpreted as
	 *  matching ALL values
	 *  (ie. the parameter is not included in the search criteria)
	 */
	findKeychainItems: function(itemClass, attributePairs) {
		Logger.trace(arguments);

		// We need to keep objects created inside nativeAttribute() in scope
		//  to prevent garbage collection
		var referencedObjects = [];

		var attributes = [];
		function addCriterion(tag, value) {
			if (value !== null && value !== undefined) {
				var attribute = new KeychainItem.Attribute(tag);
				attribute.value = value;
				attributes.push(attribute.nativeAttribute(referencedObjects));
			}
		}

		for (var i in attributePairs) {
			addCriterion(attributePairs[i][0], attributePairs[i][1]);
		}

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
		var results = [];
		try { // Make sure to release searchRef
			doWithSearchKeychainRef(this, function(keychainRef) {
				status = Security.SecKeychainSearchCreateFromAttributes(
						keychainRef,
						itemClass,
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

	/**
	 * Search for Internet Password keychain items
	 * A value of null for any parameter is interpreted as matching ALL values
	 *  (ie. the parameter is not included in the search criteria)
	 * @param {string} [accountName]
	 * @param {Security.SecProtocolType} [protocolType]
	 * @param {string} [serverName]
	 * @param {integer} [port]
	 * @param {Security.SecAuthenticationType} [authenticationType]
	 * @param {string} [securityDomain]
	 */
	findInternetPasswords: function (accountName, protocolType,
			serverName, port, authenticationType, securityDomain) {
		Logger.trace(arguments);

		var pairs = [
			[Security.kSecAccountItemAttr, accountName],
			[Security.kSecProtocolItemAttr, protocolType],
			[Security.kSecServerItemAttr, serverName],
			[Security.kSecPortItemAttr, port],
			[Security.kSecAuthenticationTypeItemAttr, authenticationType],
			[Security.kSecSecurityDomainItemAttr, securityDomain],
		];

		return this.findKeychainItems(
				Security.kSecInternetPasswordItemClass, pairs);
	},

	/**
	 * Search for Generic Password keychain items
	 * A value of null for any parameter is interpreted as matching ALL values
	 *  (ie. the parameter is not included in the search criteria)
	 * @param {string} [accountName]
	 * @param {string} [serviceName]
	 */
	findGenericPasswords: function (accountName, serviceName) {
		Logger.trace(arguments);

		var pairs = [
			[Security.kSecAccountItemAttr, accountName],
			[Security.kSecServiceItemAttr, serviceName],
		];

		return this.findKeychainItems(
				Security.kSecGenericPasswordItemClass, pairs);
	},
};


/**
 * Evaluate a passed function with a valid reference to the keychain or
 *  serach list that should be used for reading.
 */
function doWithSearchKeychainRef(thisArg, func) {
	var keychains = [];
	var searchList;
	var status;
	var result;

	try {
		// Try the user-specified keychain if there is one
		if (Preferences.searchPath.hasUserValue()) {
			// Use an nsIFile to expand ~ and so on in path
			var paths = Preferences.searchPath.value.split(':');

			for (var i in paths) {
				try {
					var path = paths[i];
					Logger.log('Adding keychain to search list: ' + path);
					try {
						path = (new FileUtils.File(path)).path;
					} catch (e) {
						throw new Error('Invalid path');
					}

					var keychainRef = new Security.SecKeychainRef;
					status = Security.SecKeychainOpen(
							path,
							keychainRef.address());
					testStatus(status, 'SecKeychainOpen');

					var keychainStatus = new Security.SecKeychainStatus;
					status = Security.SecKeychainGetStatus(keychainRef,
							keychainStatus.address());
					Logger.trace('SecKeychainGetStatus() result: '
							+ Security.stringForStatus(status));

					if (status == Security.errSecNoSuchKeychain
							|| status == Security.errSecInvalidKeychain) {
						throw new Error(Security.stringForStatus(status));
					} else {
						testStatus(status, 'SecKeychainGetStatus');

						keychains.push(keychainRef);
					}
				} catch(e) {
					if (keychainRef && !keychainRef.isNull())
						CoreFoundation.CFRelease(keychainRef);

					Logger.warning('Failed to open keychain ' + path, e);
				}
			}

			if (keychains.length > 0) {
				var KeychainArrayType = Security.SecKeychainRef.array();
				var keychainArray = new KeychainArrayType(keychains);

				searchList = CoreFoundation.CFArrayCreate(
						null, /* use default memory allocator */
						ctypes.cast(keychainArray.address(),
								ctypes.voidptr_t.ptr),
						keychains.length,
						null /* release/retain callbaks structure */);

				if (searchList.isNull())
					throw new Error('CFArrayCreate returned null');
			} else {
				Logger.warning('Preference '
					+ Preferences.searchPath.path
					+ ' is set, but no keychains were found');
			}
		}

		// If we encountered an error, use the default search list
		if (!searchList) {
			Logger.log('Using default keychain search list');
			searchList = new CoreFoundation.CFArrayRef;
			status = Security.SecKeychainCopySearchList(searchList.address());
			testStatus(status, 'SecKeychainCopySearchList');
		}

		result = func.call(thisArg, searchList);
	} finally {
		for (var i in keychains) {
			var keychainRef = keychains[i];
			CoreFoundation.CFRelease(keychainRef);
		}

		if (searchList && !searchList.isNull())
			CoreFoundation.CFRelease(searchList);
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
		if (Preferences.writeFile.hasUserValue()) {
			// Use an nsIFile to expand ~ and so on in path
			var file = new FileUtils.File(Preferences.writeFile.value);
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
		if (status == Security.errSecNoSuchKeychain
				|| status == Security.errSecInvalidKeychain)
			throw Error('Error opening keychain ' + path + ': '
					+ Security.stringForStatus(status));
		else
			testStatus(status, 'SecKeychainGetStatus');

		result = func.call(thisArg, keychainRef);
	} finally {
		if (! keychainRef.isNull()) CoreFoundation.CFRelease(keychainRef);
	}

	return result;
};


/**
 * Convert a string for passing to keychain item creation functions.
 *  (handles null and undefined values)
 *
 * @param {string|null|undefined} s The string to convert to a C array
 * @param {external:CType} ptrType The type to cast the array pointer to
 * @returns {{array:null|external:CData, size:integer,
 		pointer:null|external:CData}}
 */
function convertString(s, ptrType) {
	var result = {
		array: null,
		size: 0,
		pointer: null };

	if (s !== null && s !== undefined) {
		// hold onto the array to prevent it being GC'ed
		result.array = ctypes.char.array()(s);
		// don't count terminating NUL:
		result.size = result.array.length - 1;
		result.pointer = ctypes.cast(result.array.address(), ptrType);
	}

	return result;
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