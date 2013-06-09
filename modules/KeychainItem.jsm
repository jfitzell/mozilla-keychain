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
Components.utils.import('resource://gre/modules/ctypes.jsm');
Components.utils.import('resource://gre/modules/FileUtils.jsm');
Components.utils.import('resource://macos-keychain/frameworks/MacTypes.jsm');
Components.utils.import('resource://macos-keychain/frameworks/CoreServices.jsm');
Components.utils.import('resource://macos-keychain/frameworks/CoreFoundation.jsm');
Components.utils.import('resource://macos-keychain/frameworks/Security.jsm');
Components.utils.import('resource://macos-keychain/Logger.jsm');
Components.utils.import('resource://macos-keychain/Preferences.jsm');

const PATH_BUFFER_SIZE = 1024;


const EXPORTED_SYMBOLS = ['KeychainItem'];

function KeychainItem(ref) {
	this.initWithReference(ref);
};

KeychainItem.prototype = {
	_reference: null,
	_persistentReference: null,
	_password: undefined,
	_attributes: undefined,
	
	initWithReference: function(keychainItemRef) {
		if (keychainItemRef !== undefined) {
			//this._reference = keychainItemRef;
			this._persistentReference = this._createPersistentReference(keychainItemRef);
		}
	},
	
	_createPersistentReference: function(keychainItemRef) {
		var persistentReference = new Array();
		var dataRef = new CoreFoundation.CFDataRef;
		try {
			var status = Security.SecKeychainItemCreatePersistentReference(keychainItemRef, dataRef.address());
			testStatus(status, 'SecKeychainItemCreatePersistentReference');
			
			var length = CoreFoundation.CFDataGetLength(dataRef);
			//var range = new CoreFoundation.CFRange(1, 1);
			//var buffer = MacTypes.UInt8.array(length)();
			//CoreFoundation.CFDataGetBytes(dataRef, range, buffer.addressOfElement(0));
			var bytePtr = CoreFoundation.CFDataGetBytePtr(dataRef);
			var buffer = (ctypes.cast(bytePtr, MacTypes.UInt8.array(length).ptr)).contents;
			
			for (var i = 0; i < buffer.length; i++)
				persistentReference[i] = buffer[i];
		} finally {
			if (! dataRef.isNull()) CoreFoundation.CFRelease(dataRef);
		}
		
		return persistentReference;
	},
	
	/*
	 *
	 * The return value is a SecKeychainItemRef which must be released with CFRelease() after use
	 */
	_createKeychainItemRef: function(persistentReference) {
		var dataRef = new CoreFoundation.CFDataRef(); // to ensure the isNull() check below succeeds
		var keychainItemRef = new Security.SecKeychainItemRef();
		try {
			var buffer = MacTypes.UInt8.array()(persistentReference);
			var bytePtr = ctypes.cast(buffer.address(), MacTypes.UInt8.ptr);
			dataRef = CoreFoundation.CFDataCreate(null, bytePtr, buffer.length);
			var status = Security.SecKeychainItemCopyFromPersistentReference(dataRef, keychainItemRef.address());
			testStatus(status, 'SecKeychainItemCopyFromPersistentReference');
		} catch (e) {
			if (! keychainItemRef.isNull()) CoreFoundation.CFRelease(keychainItemRef);
			throw e;
		} finally {
			if (! dataRef.isNull()) CoreFoundation.CFRelease(dataRef);
		}
		
		return keychainItemRef;
	},
	
	doWithRef: function(thisArg, func) {
		var result;
		if (this._reference) {
			result = func.call(thisArg, this._reference);
		} else if (! this._persistentReference) {
			throw Error('Cannot obtain a reference for KeychainItem without a persistent reference.');
		} else {
			var keychainItemRef = this._createKeychainItemRef(this._persistentReference);
			var result;
			try {
				result = func.call(thisArg, keychainItemRef);
			} finally {
				if (! keychainItemRef.isNull()) CoreFoundation.CFRelease(keychainItemRef);
			}
		}
		
		return result;
	},
	
	_loadAttributes: function(requestedTags) {
		if (requestedTags === undefined || requestedTags.length < 1)
			return {};
			
		this.ensureStored();
		
		var attributeInfo = new Security.SecKeychainAttributeInfo;
		attributeInfo.format = null;
		attributeInfo.count = requestedTags.length;
		var tags = Security.SecKeychainAttrType.array(attributeInfo.count)(requestedTags);
		attributeInfo.tag = tags.addressOfElement(0);
		
		var attributeListPtr = new Security.SecKeychainAttributeList.ptr;
		var status;
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemCopyAttributesAndData(
										reference,
										attributeInfo.address(),
										null,
										attributeListPtr.address(),
										null,
										null);
		});
										
		testStatus(status, 'SecKeychainItemCopyAttributesAndData', 'loading keychain item attributes');

		// Cast the SecKeychainAttribute* to a SecKeychainAttribute[]
		var attributesPtr = ctypes.cast(attributeListPtr.contents.attr, Security.SecKeychainAttribute.array(attributeListPtr.contents.count).ptr);
		
		if (this._attributes === undefined) this._attributes = {};
		for (var i=0 ; i < attributesPtr.contents.length ; i++) {
			var attribute = attributesPtr.contents[i];
			if (KeychainItem.attributes[attribute.tag].reader !== undefined)
				this._attributes[attribute.tag] = KeychainItem.attributes[attribute.tag].reader(attribute);
			else
				this._attributes[attribute.tag] = ctypes.cast(attribute.data, MacTypes.UInt8.array(attribute.length).ptr).contents;
		}

		Security.SecKeychainItemFreeAttributesAndData(attributeListPtr, null);
		//mDataLoaded = PR_TRUE;
	},
	
	_loadPassword: function() {
		this.ensureStored();
		
		var passwordLength = new MacTypes.UInt32;
  		var passwordData = new ctypes.char.ptr;
  		
  		var status;
  		var password;
  		try {
			this.doWithRef(this, function(reference) {
				status = Security.SecKeychainItemCopyAttributesAndData(
								reference,
								null,
								null,
								null,
								passwordLength.address(),
								(ctypes.cast(passwordData, ctypes.voidptr_t)).address());
			});
			
			if (status == Security.errSecAuthFailed)
				// DEBUG: Log failed authentication
				return null;
			
			testStatus(status, 'SecKeychainItemCopyAttributesAndData', 'fetching keychain item password');
			
			var passwordArray = ctypes.cast(passwordData, ctypes.char.array(passwordLength.value).ptr).contents;
			
			if (! passwordData.isNull())
				password = passwordArray.readString();
		} finally {
			if (! passwordData.isNull())
				Security.SecKeychainItemFreeAttributesAndData(null, passwordData);
		}
		
		return password;
	},
	
	_setAttribute: function(attribute) {
		this.ensureStored();
		
		var attributeList = new Security.SecKeychainAttributeList;
		attributeList.count = 1;
		attributeList.attr = attribute.address();
		var status;
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemModifyAttributesAndData(
							reference,
							attributeList.address(),
							0,
							null);
		});

		testStatus(status, 'SecKeychainItemModifyAttributesAndData', 'setting attribute');	
		
		return true;
	},
	
	get password() {
		if (this._password === undefined)
			this._password = this._loadPassword();
		
		if (this._password === null)
			return ''; // LoginManager checks the length, so we can't return null
		else
			return this._password;
	},
	
	set password(newPassword) {
		var status;
		var charArray = ctypes.char.array()(newPassword);
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemModifyAttributesAndData(
							reference,
							null,
							newPassword.length,
							ctypes.cast(charArray.address(), ctypes.voidptr_t));
		});
		
		testStatus(status, 'SecKeychainItemModifyAttributesAndData', 'setting keychain item password');
		
		this._password = newPassword;
	},
	
	get protocolString() {
		if (this.protocol == Security.kSecProtocolTypeAny || this.protocol === null)
			return null;
		
		var scheme = Security.schemeForProtocol(this.protocol);
		if (scheme)
			return scheme;
		else
			return Security.stringFromProtocolType(this.protocol);
	},
	
	get uriString() {
		return this.protocolString
				+ '://'
				+ this.server
				+ (this.port == 0 ? '' : ':' + this.port);
	},
	
	delete: function() {
		this.ensureStored();
		
		var status;
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemDelete(reference);
		});
		
		testStatus(status, 'SecKeychainItemDelete');
		
		this.release();
	},
	
	release: function() {
		if (this._reference !== null) {
			CoreFoundation.CFRelease(this._reference);
			this._reference = null;
		}
	},
	
	ensureStored: function() {
		if (! this._reference && ! this._persistentReference)
			throw Error('KeychainItem has no reference');
	},
};

function lengthOrZero(object) {
	if (! object)
		return 0;

	try {
		return object.length;
	} catch (e) {
		return 0;
	}
};

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

// Evaluate the passed in function with a reference to the keychain that should be
//  used by the extension.
// This will check if a keychain path has been specified in the preferences and
//  try to use it. If not set, the default keychain will be used.
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
		
		// If no keychain was specified or there was an error, then use the default
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
			throw Error ('Error opening keychain: keychain at filesystem path ' + path + ' is invalid');
		else
			testStatus(status, 'SecKeychainGetStatus');
	
		result = func.call(thisArg, keychainRef);
	} finally {
		if (! keychainRef.isNull()) CoreFoundation.CFRelease(keychainRef);
	}
	
	return result;
};

KeychainItem.addInternetPassword = function(accountName,
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
		status = Security.SecKeychainAddInternetPassword(keychainRef,
						 lengthOrZero(serverName), serverName,
						 lengthOrZero(securityDomain), securityDomain,
						 lengthOrZero(accountName), accountName,
						 lengthOrZero(path), path,
						 portNumber,
						 protocolType, authenticationType,
						 lengthOrZero(password), ctypes.cast(ctypes.char.array()(password).address(), ctypes.voidptr_t),
						 keychainItemRef.address());
	});
	
	if (status == CoreServices.userCanceledErr) {
		Logger.log('User canceled SecKeychainAddInternetPassword operation');
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
};

/**
   * A value of null for any parameter is interpreted as matching ALL values
   *  (ie. the parameter is not included in the search criteria)
   */
KeychainItem.findInternetPasswords = function (account, protocolType, server,
                                        port, authenticationType, securityDomain) {
/*    this.trace("_findInternetPasswordItems["
             + " accountName:" + accountName
             + " protocol:" + protocol
             + " serverName:" + serverName
             + " port:" + port
             + " authType:" + authenticationType
             + " securityDomain:" + securityDomain + " ]");
*/
	var pairs = [
		[Security.kSecAccountItemAttr, account],
		[Security.kSecProtocolItemAttr, protocolType],
		[Security.kSecServerItemAttr, server],
		[Security.kSecPortItemAttr, port],
		[Security.kSecAuthenticationTypeItemAttr, authenticationType],
		[Security.kSecSecurityDomainItemAttr, securityDomain],
	];

	var attributes = new Array();

	for (var i in pairs) {
		var tag = pairs[i][0];
		var value = pairs[i][1];
		
		if (value !== null) {
			var writer = KeychainItem.writerFor(tag);
			if (writer)
				attributes.push(writer(value));
		}
	}
	
//	this.log(attributes.toSource());
	
	var searchCriteria = new Security.SecKeychainAttributeList();
	searchCriteria.count = attributes.length;
	if (attributes.length > 0) {
		var array = Security.SecKeychainAttribute.array()(attributes);
		searchCriteria.attr = array[0].address();
	} else {
		// It should be initialized to null anyway, but let's be clear what's goin on...
		searchCriteria.attr = null;
	}
	
	var searchRef = new Security.SecKeychainSearchRef;
	var status;
	var results = new Array();
	try { // Make sure to release searchRef
		doWithReadKeychainRef(this, function(keychainRef) {
			status = Security.SecKeychainSearchCreateFromAttributes(keychainRef,
															  Security.kSecInternetPasswordItemClass,
															  searchCriteria.address(),
															  searchRef.address());
		});
	
		testStatus(status, 'SecKeychainSearchCreateFromAttributes');
		
		var keychainItemRef = new Security.SecKeychainItemRef();
		try { // Make sure to release all keychainItemRefs if we're unsuccessful
			while ((status = Security.SecKeychainSearchCopyNext(searchRef, keychainItemRef.address())) == Security.errSecSuccess) {
				results[results.length] = new KeychainItem(keychainItemRef);
			}
		} finally {	
			if (status != Security.errSecItemNotFound) { // i.e. if we weren't done
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
};





KeychainItem.readString = function (attribute) {
	if (attribute.length == 0) return '';
	
	return ctypes.cast(attribute.data, ctypes.char.array(attribute.length).ptr).contents.readString();
};
KeychainItem.readBoolean = function (attribute) {
	// what does a length of 0 mean??

	if (attribute.length != MacTypes.Boolean.size)
		throw Error('Attribute ' + attribute.tag + ' should be Boolean but is ' + attribute.length + ' bytes.');
		
	return ctypes.cast(attribute.data, MacTypes.Boolean.ptr).contents.value > 0;
};
KeychainItem.readFourCharCode = function (attribute) {
	if (attribute.length == 0) return null;
		
	if (attribute.length != MacTypes.FourCharCode.size)
		throw Error('Attribute ' + attribute.tag + ' should be a FourCharCode but is ' + attribute.length + ' bytes.');
		
	return ctypes.cast(attribute.data, MacTypes.FourCharCode.ptr).contents;
};
KeychainItem.readUInt32 = function (attribute) {
	if (attribute.length == 0) return null;
	
	if (attribute.length != MacTypes.UInt32.size)
		throw Error('Attribute ' + attribute.tag + ' should be UInt32 but is ' + attribute.length + ' bytes.');
		
	var result = ctypes.cast(attribute.data, MacTypes.UInt32.ptr).contents;
	
	return result;
};
KeychainItem.writeString = function (attribute, value) {
	if (value === null) return;
	
	var string = value.toString();
	var data = ctypes.char.array()(string);
	attribute.data = ctypes.cast(data.address(), ctypes.voidptr_t);
	attribute.length = string.length;
};
KeychainItem.writeFourCharCode = function (attribute, value) {
	var code;
	if (!value) {
		code = new MacTypes.FourCharCode();
	} else {
		code = new MacTypes.FourCharCode(value);
	}
	
	attribute.data = ctypes.cast(code.address(), ctypes.voidptr_t);
	attribute.length = 4;
};




KeychainItem.attributes = new Object();
KeychainItem.readerFor = function(tag) {
	var attribute = this.attributes[tag];
	if (attribute && attribute.reader)
		return attribute.reader;
	else
		return null;
};

KeychainItem.writerFor = function(tag) {
	var attribute = this.attributes[tag];
	if (attribute && attribute.writer)
		return attribute.writer;
	else
		return null;
};




function addAttribute(tag, name, reader, writer) {
	var record = {};
	record.tag = tag;
	record.name = name;
	record.reader = reader;
	record.writer = writer;
	if (null !== record.writer) {
		// Wrap the writer function to supply the attribute. This makes it easier
		//  for users of the writer function.
		record.writer = function(value) {
			var attribute = new Security.SecKeychainAttribute;
			attribute.tag = new Security.SecKeychainAttrType(tag);
			writer(attribute, value);
			return attribute;
		};
	}
	
	KeychainItem.attributes[tag] = record;
};

//addAttribute(Security.kSecCreationDateItemAttr, 'creationDate', KeychainItem.readString, null);
//addAttribute(Security.kSecModDateItemAttr, 'modDate', KeychainItem.readString, null);
addAttribute(Security.kSecDescriptionItemAttr, 'description', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecCommentItemAttr, 'comment', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecCreatorItemAttr, 'creator', KeychainItem.readFourCharCode, KeychainItem.writeFourCharCode);
addAttribute(Security.kSecTypeItemAttr, 'type', KeychainItem.readFourCharCode, KeychainItem.writeFourCharCode);
addAttribute(Security.kRawKeychainLabelIndex, 'label', KeychainItem.readString, KeychainItem.writeString);
//addAttribute(Security.kSecLabelItemAttr, 'label', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecInvisibleItemAttr, 'invisible', KeychainItem.readBoolean, null);
addAttribute(Security.kSecNegativeItemAttr, 'negative', KeychainItem.readBoolean, null);
addAttribute(Security.kSecAccountItemAttr, 'account', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecServiceItemAttr, 'service', KeychainItem.readString, KeychainItem.writeString);
//addAttribute(Security.kSecSecurityDomainItemAttr, 'securityDomain', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecServerItemAttr, 'server', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecAuthenticationTypeItemAttr, 'authenticationType', KeychainItem.readFourCharCode, KeychainItem.writeFourCharCode);
addAttribute(Security.kSecPortItemAttr, 'port', KeychainItem.readUInt32, null);
addAttribute(Security.kSecPathItemAttr, 'path', KeychainItem.readString, KeychainItem.writeString);
//addAttribute(Security.kSecVolumeItemAttr, 'volume', KeychainItem.readString, KeychainItem.writeString);
//addAttribute(Security.kSecAddressItemAttr, 'address', KeychainItem.readString, KeychainItem.writeString);
addAttribute(Security.kSecProtocolItemAttr, 'protocol', KeychainItem.readFourCharCode, KeychainItem.writeFourCharCode);

for (var tag in KeychainItem.attributes) {
	var attribute = KeychainItem.attributes[tag];
	
	if (attribute.reader !== null) {
		KeychainItem.prototype.__defineGetter__(attribute.name, getterFor(attribute));
	}
	
	if (attribute.writer !== null) {
		KeychainItem.prototype.__defineSetter__(attribute.name, setterFor(attribute));
	}
}

/**
 * This needs to be out in its own function so that the closure captures
 * the correct value for "attributeRecord" in each loop iteration.
 */
function getterFor(attributeRecord) {
	return function() {
		this._loadAttributes([attributeRecord.tag]);
		return this._attributes[attributeRecord.tag];
	};
};
/**
 * This needs to be out in its own function so that the closure captures
 * the correct value for "attributeRecord" in each loop iteration.
 */
function setterFor(attributeRecord) {
	return function(value) {
		this._setAttribute(attributeRecord.writer(value));
	};
};

function testStatus(status, functionString, contextString) {
	var whileString = (contextString === undefined) ? '' : 'While ' + contextString + ', ';
	if (status != Security.errSecSuccess) {
		var err = new Error('KeychainItem.jsm - ' + whileString + functionString + '() returned ' + status.toString() + ': ' + Security.stringForStatus(status));
		err.name = 'Security Framework Error';
		err.status = status;
		err.fn = functionString;
		throw err;
	}
};
