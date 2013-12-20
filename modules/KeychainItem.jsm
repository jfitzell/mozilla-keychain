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


const EXPORTED_SYMBOLS = ['KeychainItem'];

/**
 * @constructor
 */
function KeychainItem(ref) {
	this.initWithReference(ref);
};

KeychainItem.prototype = {
	initWithReference: function(keychainItemRef) {
		this._persistentReference = null;
		this._password = undefined;
		this._attributes = undefined;

		if (keychainItemRef !== undefined) {
			this._persistentReference =
					createPersistentReference(keychainItemRef);
		}

		var map = {
			//creationDate: Security.kSecCreationDateItemAttr,
			//modDate: Security.kSecModDateItemAttr,
			description: Security.kSecDescriptionItemAttr,
			comment: Security.kSecCommentItemAttr,
			creator: Security.kSecCreatorItemAttr,
			type: Security.kSecTypeItemAttr,
			label: Security.kRawKeychainLabelIndex,
			//label: Security.kSecLabelItemAttr,
			invisible: Security.kSecInvisibleItemAttr,
			negative: Security.kSecNegativeItemAttr,
			account: Security.kSecAccountItemAttr,
			service: Security.kSecServiceItemAttr,
			securityDomain: Security.kSecSecurityDomainItemAttr,
			server: Security.kSecServerItemAttr,
			authenticationType: Security.kSecAuthenticationTypeItemAttr,
			port: Security.kSecPortItemAttr,
			path: Security.kSecPathItemAttr,
			//volume: Security.kSecVolumeItemAttr,
			//address: Security.kSecAddressItemAttr,
			protocol: Security.kSecProtocolItemAttr,
		};

		function createAccessors(target, name, attribute) {
			target.__defineGetter__(name, function() {
				Logger.trace('KeychainItem.' + name);
				return this._get(attribute);
			});
			target.__defineSetter__(name, function(value) {
				Logger.trace('KeychainItem.' + name + '=' + Logger.stringify(value));
				this._set(attribute, value);
			});
		};

		var list = [];

		for (var eachName in map) {
			var attribute = new KeychainItem.Attribute(map[eachName]);
			list.push(attribute);
			createAccessors(this, eachName, attribute);
		}

		this._attributes = new AttributeList(list);
	},

	doWithRef: function(thisArg, func) {
		var result;
		if (! this._persistentReference) {
			throw Error('Cannot obtain a reference for KeychainItem without a persistent reference.');
		} else {
			/*
			 * The return value is a SecKeychainItemRef which must be released
			 *  with CFRelease() after use
			 */
			function createKeychainItemRef(persistentReference) {
				// initialize to ensure the isNull() check below succeeds
				var dataRef = new CoreFoundation.CFDataRef();
				var keychainItemRef = new Security.SecKeychainItemRef();
				try {
					var buffer = MacTypes.UInt8.array()(persistentReference);
					var bytePtr = ctypes.cast(
							buffer.address(),
							MacTypes.UInt8.ptr);
					dataRef = CoreFoundation.CFDataCreate(
							null,
							bytePtr,
							buffer.length);
					var status = Security
							.SecKeychainItemCopyFromPersistentReference(
								dataRef,
								keychainItemRef.address());
					testStatus(
						status,
						'SecKeychainItemCopyFromPersistentReference');
				} catch (e) {
					if (! keychainItemRef.isNull())
						CoreFoundation.CFRelease(keychainItemRef);
					throw e;
				} finally {
					if (! dataRef.isNull())
						CoreFoundation.CFRelease(dataRef);
				}

				return keychainItemRef;
			};

			var result;
			var keychainItemRef =
					createKeychainItemRef(this._persistentReference);
			try {
				result = func.call(thisArg, keychainItemRef);
			} finally {
				if (! keychainItemRef.isNull()) {
					// update the persistent reference (changes to e.g. the
					//  protocol attribute seem to invalidate it)
					this._persistentReference =
						createPersistentReference(keychainItemRef);
					CoreFoundation.CFRelease(keychainItemRef);
				}
			}
		}

		return result;
	},

	_get: function(attribute) {
		this.ensureStored();
		var that = this;
		this.doWithRef(this, function(reference) {
			// TODO: implement a load method on the attribute itself
			that._attributes.load(reference, [attribute.tag]);
		});

		return attribute.value;
	},

	_set: function(attribute, value) {
		this.ensureStored();

		attribute.value = value;

		this.doWithRef(this, function(reference) {
			attribute.write(reference);
		});
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

	/**
	 * foo
	 */
	get password() {
		if (this._password === undefined)
			this._password = this._loadPassword();

		if (this._password === null)
			return ''; // LoginManager checks length, so we can't return null
		else
			return this._password;
	},

	/**
	 * foo
	 */
	set password(newPassword) {
		var status;
		var charArray = ctypes.char.array()(newPassword);
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemModifyAttributesAndData(
							reference,
							null,
							charArray.length,
							ctypes.cast(charArray.address(), ctypes.voidptr_t));
		});

		testStatus(status, 'SecKeychainItemModifyAttributesAndData', 'setting keychain item password');

		this._password = newPassword;
	},

	/**
	 * @member
	 */
	get protocolString() {
		if (this.protocol == Security.kSecProtocolTypeAny || this.protocol === null)
			return null;

		var scheme = Security.schemeForProtocolType(this.protocol);
		if (scheme)
			return scheme;
		else
			return Security.stringFromProtocolType(this.protocol);
	},

	/**
	 * @member
	 */
	get uriString() {
		var server = this.server;
		if (server === null)
			return null;

		var uri = '';

		var scheme = this.protocolString;
		if (scheme !== null)
			uri += scheme + ':';

		uri += '//' + this.server;

		var port = this.port;
		if (port != 0)
			uri += ':' + port;

		var path = this.path;
		if (path !== null)
			uri += path;

		return uri;
	},

	/**
	 * @function
	 */
	delete: function() {
		this.ensureStored();

		var status;
		this.doWithRef(this, function(reference) {
			status = Security.SecKeychainItemDelete(reference);
		});

		testStatus(status, 'SecKeychainItemDelete');
	},

	/**
	 * @function
	 */
	ensureStored: function() {
		if (! this._persistentReference)
			throw Error('KeychainItem has no reference');
	},

};


function createPersistentReference(keychainItemRef) {
	var persistentReference = new Array();
	var dataRef = new CoreFoundation.CFDataRef;
	try {
		var status = Security.SecKeychainItemCreatePersistentReference(
				keychainItemRef,
				dataRef.address());
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
		if (! dataRef.isNull())
			CoreFoundation.CFRelease(dataRef);
	}

	return persistentReference;
};




/**
 * @constructor
 */
function AttributeList(list) {
	this.init(list);
};
AttributeList.prototype = {
	init: function(list) {
		this.map = {};
		for (var i in list) {
			var attribute = list[i];
			this.map[attribute.tag] = attribute;
		}
	},

	load: function(reference, requestedTags) {
		Logger.trace();
		if (requestedTags === undefined || requestedTags.length < 1)
			return;

		var attributeInfo = new Security.SecKeychainAttributeInfo;
		attributeInfo.format = null;
		attributeInfo.count = requestedTags.length;
		var tags = Security.SecKeychainAttrType
				.array(attributeInfo.count)(requestedTags);
		attributeInfo.tag = tags.addressOfElement(0);

		var attributeListPtr = new Security.SecKeychainAttributeList.ptr;
		var status;
		status = Security.SecKeychainItemCopyAttributesAndData(
										reference,
										attributeInfo.address(),
										null,
										attributeListPtr.address(),
										null,
										null);

		testStatus(status, 'SecKeychainItemCopyAttributesAndData',
				'loading keychain item attributes');

		// Cast the SecKeychainAttribute* to a SecKeychainAttribute[]
		var attributesPtr = ctypes.cast(
				attributeListPtr.contents.attr,
				Security.SecKeychainAttribute
					.array(attributeListPtr.contents.count).ptr);

		for (var i=0 ; i < attributesPtr.contents.length ; i++) {
			var nativeAttribute = attributesPtr.contents[i];
			var attribute = this.map[nativeAttribute.tag];
			if (attribute !== undefined)
				attribute.readFrom(nativeAttribute);
		}

		Security.SecKeychainItemFreeAttributesAndData(attributeListPtr, null);
	},
};





/**
 * Attribute
 *
 * @constructor
 * @param {integer} tag
 */
KeychainItem.Attribute = (function() {

	/**
	 * @memberof KeychainItem.Attribute~
	 * @param {Security.SecKeychainAttribute} nativeAttribute The attribute
	 *  to which the value should be written
	 * @param {Array} referencedObjects An array that should have the same
	 *  scope as the nativeAttribute. It is used to keep alive objects that
	 *  may be referenced by native pointers.
	 * @param {external:CData} data The data to store in nativeAttribute
	 * @param {Integer} length The length of data in bytes
	 */
	function setData(nativeAttribute, referencedObjects, data, length) {
		referencedObjects.push(data);
		nativeAttribute.data = ctypes.cast(data.address(), ctypes.voidptr_t);
		nativeAttribute.length = length;
	};


	/** ****************************************************
	 * @namespace KeychainItem.Attribute~StringAdaptor
	 */
	var StringAdaptor =
	/** @lends KeychainItem.Attribute~StringAdaptor. */
	{
		/**
		 * @param {*} value
		 * @returns {String}
		 */
		coerceValue: function(value) {
			return (value === null) ? '' : value.toString();
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute
		 * @returns {String}
		 */
		readFrom: function(nativeAttribute) {
			if (nativeAttribute.length == 0) {
				return '';
			} else {
				return ctypes.cast(
							nativeAttribute.data,
							ctypes.char.array(nativeAttribute.length).ptr)
						.contents.readString();
			}
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute The attribute
		 *  to which the value should be written
		 * @param {String} value The value to be written
		 * @param {Array} referencedObjects An array that should have the same
		 *  scope as the nativeAttribute. It is used to keep alive objects that
		 *  may be referenced by native pointers.
		 */
		writeTo: function(
				nativeAttribute,
				value,
				referencedObjects) {
			if (value === undefined) return;

			var data = ctypes.char.array()(value);
			setData(nativeAttribute, referencedObjects,
					data, data.length -1 /* -1 for the trailing */ );
		},
	};


	/** ****************************************************
	 * @namespace KeychainItem.Attribute~BooleanAdaptor
	 */
	var BooleanAdaptor =
	/** @lends KeychainItem.Attribute~BooleanAdaptor. */
	{
		/**
		 * @param {*} value
		 * @returns {Boolean}
		 */
		coerceValue: function(value) {
			return true == value;
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute
		 * @returns {Boolean}
		 */
		readFrom: function(nativeAttribute) {
			if (nativeAttribute.length == 0)
				return null;
			else {
				Logger.trace('Boolean length: ' + nativeAttribute.length);
				return ctypes.cast(
						nativeAttribute.data,
						MacTypes.Boolean.ptr)
							.contents > 0;
			}
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute The attribute
		 *  to which the value should be written
		 * @param {Integer} value The value to be written
		 * @param {Array} referencedObjects An array that should have the same
		 *  scope as the nativeAttribute. It is used to keep alive objects that
		 *  may be referenced by native pointers.
		 */
		writeTo: function (
				nativeAttribute,
				value,
				referencedObjects) {
			if (value === undefined) return;

			setData(nativeAttribute, referencedObjects,
					MacTypes.Boolean(value), MacTypes.Boolean.size );
		},
	};


	/** ****************************************************
	 * @namespace KeychainItem.Attribute~UInt32Adaptor
	 */
	var UInt32Adaptor =
	/** @lends KeychainItem.Attribute~UInt32Adaptor. */
	{
		/**
		 * @param {*} value
		 * @returns {Integer}
		 */
		coerceValue: function(value) {
			return Math.min(
				Math.pow(2, 32) - 1,
				Math.max(
					0,
					Math.floor(value) || 0));
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute
		 * @returns {Integer|null}
		 */
		readFrom: function(nativeAttribute) {
			if (nativeAttribute.length == 0)
				return null;
			else {
				if (nativeAttribute.length != MacTypes.UInt32.size)
					throw Error('Attribute ' + nativeAttribute.tag
							+ ' should be UInt32 but is '
							+ nativeAttribute.length + ' bytes.');

				return ctypes.cast(
						nativeAttribute.data,
						MacTypes.UInt32.ptr)
							.contents;
			}
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute The attribute
		 *  to which the value should be written
		 * @param {Integer} value The value to be written
		 * @param {Array} referencedObjects An array that should have the same
		 *  scope as the nativeAttribute. It is used to keep alive objects that
		 *  may be referenced by native pointers.
		 */
		writeTo: function (
				nativeAttribute,
				value,
				referencedObjects) {
			if (value === undefined) return;

			setData(nativeAttribute, referencedObjects,
					MacTypes.UInt32(value), MacTypes.UInt32.size );
		},
	};



	/** ****************************************************
	 * @namespace KeychainItem.Attribute~FourCharCodeAdaptor
	 * @borrows KeychainItem.Attribute~UInt32Adaptor.coerceValue as coerceValue
	 */
	var FourCharCodeAdaptor =
	/** @lends KeychainItem.Attribute~FourCharCodeAdaptor. */
	{
		coerceValue: UInt32Adaptor.coerceValue,

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute
		 * @returns {Integer|null}
		 */
		readFrom: function(nativeAttribute) {
			Logger.trace('FourCharCodeAdaptor.readFrom()');

			if (nativeAttribute.length == 0)
				return null;
			else {
				if (nativeAttribute.length != MacTypes.FourCharCode.size)
					throw Error('Attribute ' + nativeAttribute.tag
							+ ' should be a FourCharCode but is '
							+ nativeAttribute.length + ' bytes.');

				return ctypes.cast(
						nativeAttribute.data,
						MacTypes.FourCharCode.ptr)
							.contents;
			}
		},

		/**
		 * @param {Security.SecKeychainAttribute} nativeAttribute The attribute
		 *  to which the value should be written
		 * @param {Integer} value The value to be written
		 * @param {Array} referencedObjects An array that should have the same
		 *  scope as the nativeAttribute. It is used to keep alive objects that
		 *  may be referenced by native pointers.
		 */
		writeTo: function (
				nativeAttribute,
				value,
				referencedObjects) {
			if (value === undefined) return;

			var data;
			if (!value) {
				data = new MacTypes.FourCharCode();
			} else {
				data = new MacTypes.FourCharCode(value);
			}

			setData(nativeAttribute, referencedObjects,
					data, 4 );
		},
	};



	var list = [
		//[Security.kSecCreationDateItemAttr, StringAdaptor],
		//[Security.kSecModDateItemAttr, StringAdaptor],
		[Security.kSecDescriptionItemAttr, StringAdaptor],
		[Security.kSecCommentItemAttr, StringAdaptor],
		[Security.kSecCreatorItemAttr, FourCharCodeAdaptor],
		[Security.kSecTypeItemAttr, FourCharCodeAdaptor],
		[Security.kRawKeychainLabelIndex, StringAdaptor],
		//[Security.kSecLabelItemAttr, StringAdaptor],
		[Security.kSecInvisibleItemAttr, BooleanAdaptor],
		[Security.kSecNegativeItemAttr, BooleanAdaptor],
		[Security.kSecAccountItemAttr, StringAdaptor],
		[Security.kSecServiceItemAttr, StringAdaptor],
		[Security.kSecSecurityDomainItemAttr, StringAdaptor],
		[Security.kSecServerItemAttr, StringAdaptor],
		[Security.kSecAuthenticationTypeItemAttr, FourCharCodeAdaptor],
		[Security.kSecPortItemAttr, UInt32Adaptor],
		[Security.kSecPathItemAttr, StringAdaptor],
		//[Security.kSecVolumeItemAttr, StringAdaptor],
		//[Security.kSecAddressItemAttr, StringAdaptor],
		[Security.kSecProtocolItemAttr, FourCharCodeAdaptor],
	];

	var map = {};
	list.forEach(function (pair) {
		map[pair[0]] = pair[1];
	});

	return function(tag) {
		if (map[tag] === undefined)
			map[tag] = Adaptor;

		this._adaptor = map[tag];
		this.tag = tag
	};
})();

KeychainItem.Attribute.prototype = {

	/**
	 * @function
	 */
	write: function(reference) {
		// We need to keep js-ctypes objects created in nativeAttribute()
		//  in scope to prevent garbage collection
		var referencedObjects = [];
		var attribute = this.nativeAttribute(referencedObjects);

		var attributeList = new Security.SecKeychainAttributeList;
		attributeList.count = 1;
		attributeList.attr = attribute.address();
		var status;
		status = Security.SecKeychainItemModifyAttributesAndData(
							reference,
							attributeList.address(),
							0,
							null);

		testStatus(status, 'SecKeychainItemModifyAttributesAndData', 'setting attribute');
	},

	/**
	 * @function
	 */
	readFrom: function(nativeAttribute) {
		this._value = this._adaptor.readFrom(nativeAttribute);
	},

	/**
	 * @function
	 */
	nativeAttribute: function(referencedObjects) {
		var nativeAttribute = new Security.SecKeychainAttribute;
		nativeAttribute.tag = new Security.SecKeychainAttrType(this.tag);
		this._adaptor.writeTo(nativeAttribute, this._value, referencedObjects);
		return nativeAttribute;
	},

	/**
	 * @member
	 */
	get value() {
		return this._value;
	},

	set value(value) {
		this._value = this._adaptor.coerceValue(value);
	},
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
	var whileString = (contextString === undefined) ? '' : 'While ' + contextString + ', ';
	if (status == Security.errSecSuccess) {
		Logger.trace(functionString + '() successful', 1);
	} else  {
		var err = new Error('KeychainItem.jsm - ' + whileString + functionString + '() returned ' + status.toString() + ': ' + Security.stringForStatus(status));
		err.name = 'Security Framework Error';
		err.status = status;
		err.fn = functionString;
		throw err;
	}
};
