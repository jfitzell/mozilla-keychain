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
Components.utils.import('resource://gre/modules/ctypes.jsm');
Components.utils.import('resource://macos-keychain/MacTypes.jsm');
Components.utils.import('resource://macos-keychain/CoreFoundation.jsm');
Components.utils.import('resource://macos-keychain/Security.jsm');

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
			this.testStatus(status, 'creating persistent reference for KeychainItemRef');
			
			var length = CoreFoundation.CFDataGetLength(dataRef);
			//var range = new CoreFoundation.CFRange(1, 1);
			//var buffer = MacTypes.UInt8.array(length)();
			//CoreFoundation.CFDataGetBytes(dataRef, range, buffer.addressOfElement(0));
			var bytePtr = CoreFoundation.CFDataGetBytePtr(dataRef);
			var buffer = (ctypes.cast(bytePtr, MacTypes.UInt8.array(length).ptr)).contents;
			
			for (var i = 0; i < buffer.length; i++)
				persistentReference[i] = buffer[i];
			
			if (! dataRef.isNull()) CoreFoundation.CFRelease(dataRef);
		} catch (e) {
			if (! dataRef.isNull()) CoreFoundation.CFRelease(dataRef);
			throw e;
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
			this.testStatus(status, 'creating KeychainItemRef');
			
			if (! dataRef.isNull()) CoreFoundation.CFRelease(dataRef);
		} catch (e) {
			if (! dataRef.isNull()) CoreFoundation.CFRelease(dataRef);
			if (! keychainItemRef.isNull()) CoreFoundation.CFRelease(keychainItemRef);
			throw e;
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
			} catch (e) {
				if (! keychainItemRef.isNull()) CoreFoundation.CFRelease(keychainItemRef);
				throw e;
			}
			if (! keychainItemRef.isNull()) CoreFoundation.CFRelease(keychainItemRef);
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
										
		this.testStatus(status, 'loading keychain item attributes');

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
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemCopyAttributesAndData(
  							reference,
  							null,
  							null,
  							null,
							passwordLength.address(),
							(ctypes.cast(passwordData, ctypes.voidptr_t)).address());
		});
  		
  		var passwordArray = ctypes.cast(passwordData, ctypes.char.array(passwordLength.value).ptr).contents;
  		var password;
  		if (! passwordData.isNull()) {
  			password = passwordArray.readString();
  			Security.SecKeychainItemFreeAttributesAndData(null, passwordData);
  		}
  		
		if (status == Security.errSecSuccess)
			return password;
		else if (status == Security.errSecAuthFailed)
			return null;
		else
			throw Error('Error loading keychain item password: ' + Security.stringForStatus(status));
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
		
		this.testStatus(status, 'setting attribute');
			
		return true;
	},
	
	get password() {
		if (this._password === undefined)
			return this._password = this._loadPassword();
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
		
		this.testStatus(status, 'setting keychain item password');
		
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
		
		this.testStatus(status, 'deleting keychain item');
		
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
	
	testStatus: function(status, actionString) {
		if (status != Security.errSecSuccess)
			throw Error('Error ' + actionString + ': ', + Security.stringForStatus(status));
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

// Evaluate the passed in function with a reference to the keychain that should be
//  used by the extension.
// This will check if a keychain path has been specified in the preferences and
//  try to use it. If not set, the default keychain will be used.
function doWithKeychainRef(thisArg, func) {
	var path = null; // TODO: replace with a all to read a preference
	var keychainRef = new Security.SecKeychainRef;
	var keychainStatus = new Security.SecKeychainStatus;
	var status;
	var result;
	
	// DEBUG log the path being used
	
	if ('' == path || null === path) {
		status = Security.SecKeychainCopyDefault(keychainRef.address());
	} else {
		status = Security.SecKeychainOpen(path, keychainRef.address());
	}
	if (status != Security.errSecSuccess)
		throw Error('Error obtaining keychain reference: ' + Security.stringForStatus(status));
	
	status = Security.SecKeychainGetStatus(keychainRef, keychainStatus.address());
	if (status == Security.errSecNoSuchKeychain)
		throw Error('Error opening keychain: no keychain found at filesystem path ' + path);
	else if (status == Security.errSecInvalidKeychain)
		throw Error ('Error opening keychain: keychain at filesystem path ' + path + ' is invalid');
	else if (status != Security.errSecSuccess)
		throw Error('Error obtaining keychain status: ' + Security.stringForStatus(status));
	
	//DEBUG: log the status (locked?)
	
	try {
		result = func.call(thisArg, keychainRef);
	} catch (e) {
		if (! keychainRef.isNull()) CoreFoundation.CFRelease(keychainRef);
		throw e;
	}
	if (! keychainRef.isNull()) CoreFoundation.CFRelease(keychainRef);
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
	doWithKeychainRef(this, function(keychainRef) {
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
	
	if (status != Security.errSecSuccess)
		throw Error('Error adding internet password: ' + Security.stringForStatus(status));
	
	var item = new KeychainItem(keychainItemRef);
	item.comment = comment;
	
	if (! label)
		item.setDefaultLabel();
	else
		item.label = label;
	
	return item;
};

/**
   * A value of null for any parameter is interpreted as matching ALL values
   *  (ie. the parameter is not included in the search criteria)
   */
KeychainItem.findInternetPasswords = function (account, protocolType, server,
                                        port, authenticationType, securityDomain) {
/*    this.log("_findInternetPasswordItems["
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
	
//	this.debug(attributes.toSource());
	
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
	doWithKeychainRef(this, function(keychainRef) {
		status = Security.SecKeychainSearchCreateFromAttributes(keychainRef,
														  Security.kSecInternetPasswordItemClass,
														  searchCriteria.address(),
														  searchRef.address());
	});

	if (status != Security.errSecSuccess) {
//		this.log('Error searching: ' + Security.stringForStatus(status));
		throw Error('Error searching: ' + Security.stringForStatus(status));
	}
	
	var results = new Array();
	
	var keychainItemRef = new Security.SecKeychainItemRef();
	while ((status = Security.SecKeychainSearchCopyNext(searchRef, keychainItemRef.address())) == Security.errSecSuccess) {
		results[results.length] = new KeychainItem(keychainItemRef);
	}
	
	if (! searchRef.isNull())
		CoreFoundation.CFRelease(searchRef);
			
	if (status != Security.errSecItemNotFound) {
		for (var i in results) {
			results[i].release();
		}
		if (! keychainItemRef.isNull())
			CoreFoundation.CFRelease(keychainItemRef);
		throw Error('Error obtaining search results: ' + Security.stringForStatus(status));
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