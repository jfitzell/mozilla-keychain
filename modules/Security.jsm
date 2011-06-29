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
Components.utils.import("resource://macos-keychain/MacTypes.jsm");
Components.utils.import("resource://macos-keychain/CoreFoundation.jsm");
Components.utils.import("resource://macos-keychain/Framework.jsm");

const EXPORTED_SYMBOLS = ['Security'];

function SecurityFramework() {};
SecurityFramework.prototype = new Framework('Security');

var Security = new SecurityFramework();



var sec = SecurityFramework.prototype;


sec.OpaqueSecKeychainRef = new ctypes.StructType('OpaqueSecKeychainRef');
sec.SecKeychainRef = Security.OpaqueSecKeychainRef.ptr;
sec.OpaqueSecKeychainItemRef = new ctypes.StructType('OpaqueSecKeychainItemRef');
sec.SecKeychainItemRef = Security.OpaqueSecKeychainItemRef.ptr;
sec.OpaqueSecKeychainSearchRef = new ctypes.StructType('OpaqueSecKeychainSearchRef');
sec.SecKeychainSearchRef = Security.OpaqueSecKeychainSearchRef.ptr;

sec.SecAuthenticationType = MacTypes.OSType;
sec.SecProtocolType = MacTypes.OSType;
sec.SecItemClass = MacTypes.FourCharCode;
sec.SecKeychainStatus = MacTypes.UInt32;
sec.SecKeychainAttrType = MacTypes.OSType;
sec.SecKeychainAttribute = new ctypes.StructType('SecKeychainAttribute',
						[{tag: Security.SecKeychainAttrType},
						{length: MacTypes.UInt32},
						{data: ctypes.void_t.ptr}]);
sec.SecKeychainAttributeList = new ctypes.StructType('SecKeychainAttributeList',
						[{count: MacTypes.UInt32},
						{attr: Security.SecKeychainAttribute.ptr}]);
sec.SecKeychainAttributeInfo = new ctypes.StructType('SecKeychainAttributeInfo',
						[{count: MacTypes.UInt32},
						{tag: MacTypes.UInt32.ptr},
						{format: MacTypes.UInt32.ptr}]);

// OSStatus result codes
sec.errSecSuccess = 0;
sec.errSecUnimplemented = -4;
sec.errSecParam = -50;
sec.errSecAllocate = -108;
sec.errSecNotAvailable = -25291;
sec.errSecReadOnly = -25292;
sec.errSecAuthFailed = -25293;
sec.errSecNoSuchKeychain = -25294;
sec.errSecInvalidKeychain = -25295;
sec.errSecDuplicateKeychain = -25296;
sec.errSecDuplicateCallback = -25297;
sec.errSecInvalidCallback = -25298;
sec.errSecDuplicateItem = -25299;
sec.errSecItemNotFound = -25300;
sec.errSecBufferTooSmall = -25301;
sec.errSecDataTooLarge = -25302;
sec.errSecNoSuchAttr = -25303;
sec.errSecInvalidItemRef = -25304;
sec.errSecInvalidSearchRef = -25305;
sec.errSecNoSuchClass = -25306;
sec.errSecNoDefaultKeychain = -25307;
sec.errSecInteractionNotAllowed = -25308;
sec.errSecReadOnlyAttr = -25309;
sec.errSecWrongSecVersion = -25310;
sec.errSecKeySizeNotAllowed = -25311;
sec.errSecNoStorageModule = -25312;
sec.errSecNoCertificateModule = -25313;
sec.errSecNoPolicyModule = -25314;
sec.errSecInteractionRequired = -25315;
sec.errSecDataNotAvailable = -25316;
sec.errSecDataNotModifiable = -25317;
sec.errSecCreateChainFailed = -25318;
sec.errSecInvalidPrefsDomain = -25319;
sec.errSecACLNotSimple = -25240;
sec.errSecPolicyNotFound = -25241;
sec.errSecInvalidTrustSetting = -25242;
sec.errSecNoAccessForItem = -25243;
sec.errSecInvalidOwnerEdit = -25244;
sec.errSecTrustNotAvailable = -25245;
sec.errSecUnsupportedFormat = -25256;
sec.errSecUnknownFormat = -25257;
sec.errSecKeyIsSensitive = -25258;
sec.errSecMultiplePrivKeys = -25259;
sec.errSecPassphraseRequired = -25260;
sec.errSecInvalidPasswordRef = -25261;
sec.errSecInvalidTrustSettings = -25262;
sec.errSecNoTrustSettings = -25263;
sec.errSecPkcs12VerifyFailure = -25264;
sec.errSecDecode = -26275;

sec.itemAttrFromString = MacTypes.fourCharCodeFromString;
sec.stringFromItemAttr = MacTypes.stringFromFourCharCode;

// SecItemAttr	
sec.kSecCreationDateItemAttr        = Security.itemAttrFromString('cdat');
sec.kSecModDateItemAttr             = Security.itemAttrFromString('mdat');
sec.kSecDescriptionItemAttr         = Security.itemAttrFromString('desc');
sec.kSecCommentItemAttr             = Security.itemAttrFromString('icmt');
sec.kSecCreatorItemAttr             = Security.itemAttrFromString('crtr');
sec.kSecTypeItemAttr                = Security.itemAttrFromString('type');
sec.kSecScriptCodeItemAttr          = Security.itemAttrFromString('scrp');
sec.kSecLabelItemAttr               = Security.itemAttrFromString('labl');
sec.kSecInvisibleItemAttr           = Security.itemAttrFromString('invi');
sec.kSecNegativeItemAttr            = Security.itemAttrFromString('nega');
sec.kSecCustomIconItemAttr          = Security.itemAttrFromString('cusi');
sec.kSecAccountItemAttr             = Security.itemAttrFromString('acct');
sec.kSecServiceItemAttr             = Security.itemAttrFromString('svce');
sec.kSecGenericItemAttr             = Security.itemAttrFromString('gena');
sec.kSecSecurityDomainItemAttr      = Security.itemAttrFromString('sdmn');
sec.kSecServerItemAttr              = Security.itemAttrFromString('srvr');
sec.kSecAuthenticationTypeItemAttr  = Security.itemAttrFromString('atyp');
sec.kSecPortItemAttr                = Security.itemAttrFromString('port');
sec.kSecPathItemAttr                = Security.itemAttrFromString('path');
sec.kSecVolumeItemAttr              = Security.itemAttrFromString('vlme');
sec.kSecAddressItemAttr             = Security.itemAttrFromString('addr');
sec.kSecSignatureItemAttr           = Security.itemAttrFromString('ssig');
sec.kSecProtocolItemAttr            = Security.itemAttrFromString('ptcl');
sec.kSecCertificateType             = Security.itemAttrFromString('ctyp');
sec.kSecCertificateEncoding         = Security.itemAttrFromString('cenc');
sec.kSecCrlType                     = Security.itemAttrFromString('crtp');
sec.kSecCrlEncoding                 = Security.itemAttrFromString('crnc');
sec.kSecAlias                       = Security.itemAttrFromString('alis');
// Prior to 10.5, we can't use kSecLabelItemAttr due to a bug in Keychain
// Services (see bug 420665). The recommendation from Apple is to use the raw
// index instead of the attribute, which for password items is 7.
// Once we are 10.5+, we can just use kSecLabelItemAttr instead.
sec.kRawKeychainLabelIndex = 7;

// SecKeychainStatus
sec.kSecUnlockStateStatus = 1;
sec.kSecReadPermStatus = 2;
sec.kSecWritePermStatus = 4;


/******************
 * SecAuthenticationType constants depend on endianness. See:
 * /System/Library/Frameworks/Security.framework/Versions/Current/Headers/SecKeychain.h
 ******************/

var __littleEndian;
function _littleEndian() {
	if (undefined === __littleEndian) {
		var uint32 = new ctypes.uint32_t(1);
		var uint8 = ctypes.cast(uint32.address(), ctypes.uint8_t.ptr).contents;
		__littleEndian = (1 == uint8);
	}
	
	return __littleEndian;
}

sec.authenticationTypeFromString = function(string) {	
	var code = string;
	if (code && _littleEndian())
		code = code.split('').reverse().join('');
		
	return MacTypes.fourCharCodeFromString(code);
};

sec.stringFromAuthenticationType = function(uint32) {
	var code = MacTypes.stringFromFourCharCode(uint32);
	if (code && _littleEndian())
		code = code.split('').reverse().join('');
	
	return code;
}

// SecAuthenticationType
sec.kSecAuthenticationTypeNTLM			= Security.authenticationTypeFromString('ntlm');
sec.kSecAuthenticationTypeMSN			= Security.authenticationTypeFromString('msna');
sec.kSecAuthenticationTypeDPA			= Security.authenticationTypeFromString('dpaa');
sec.kSecAuthenticationTypeRPA			= Security.authenticationTypeFromString('rpaa');
sec.kSecAuthenticationTypeHTTPBasic		= Security.authenticationTypeFromString('http');
sec.kSecAuthenticationTypeHTTPDigest	= Security.authenticationTypeFromString('httd');
sec.kSecAuthenticationTypeHTMLForm		= Security.authenticationTypeFromString('form');
sec.kSecAuthenticationTypeDefault		= Security.authenticationTypeFromString('dflt');
sec.kSecAuthenticationTypeAny			= 0;

sec.protocolTypeFromString = MacTypes.fourCharCodeFromString;
sec.stringFromProtocolType = MacTypes.stringFromFourCharCode;

// SecProtocolType
var protocolTypes = [
['kSecProtocolTypeFTP',			'ftp ', 'ftp'],
['kSecProtocolTypeFTPAccount',	'ftpa', ''],
['kSecProtocolTypeHTTP',		'http', 'http'],
['kSecProtocolTypeIRC',			'irc ', 'irc'],
['kSecProtocolTypeNNTP',		'nntp', 'nntp'],
['kSecProtocolTypePOP3',		'pop3', ''],
['kSecProtocolTypeSMTP',		'smtp', 'smtp'],
['kSecProtocolTypeSOCKS',		'sox ', ''],
['kSecProtocolTypeIMAP',		'imap', 'imap'],
['kSecProtocolTypeLDAP',		'ldap', 'ldap'],
['kSecProtocolTypeAppleTalk',	'atlk', ''],
['kSecProtocolTypeAFP',			'afp ', 'afp'],
['kSecProtocolTypeTelnet',		'teln', 'telnet'],
['kSecProtocolTypeSSH',			'ssh ', 'ssh'],
['kSecProtocolTypeFTPS',		'ftps', 'ftps'],
['kSecProtocolTypeHTTPS',		'htps', 'https'],
['kSecProtocolTypeHTTPProxy',	'htpx', ''],
['kSecProtocolTypeHTTPSProx',	'htsx', ''],
['kSecProtocolTypeFTPProxy',	'ftpx', ''],
['kSecProtocolTypeCIFS',		'cifs', ''], //10.5
['kSecProtocolTypeSMB',			'smb ', 'smb'],
['kSecProtocolTypeRTSP',		'rtsp', ''],
['kSecProtocolTypeRTSPProxy',	'rtsx', ''],
['kSecProtocolTypeDAAP',		'daap', ''],
['kSecProtocolTypeEPPC',		'eppc', ''],
['kSecProtocolTypeIPP',			'ipp ', 'ipp'],
['kSecProtocolTypeNNTPS',		'ntps', ''],
['kSecProtocolTypeLDAPS',		'ldps', 'ldaps'],
['kSecProtocolTypeTelnetS',		'tels', ''],
['kSecProtocolTypeIMAPS',		'imps', ''],
['kSecProtocolTypeIRCS',		'ircs', ''],
['kSecProtocolTypePOP3S',		'pops', ''],
['kSecProtocolTypeCVSpserver',	'cvsp', ''], //10.5
['kSecProtocolTypeSVN',			'svn ', 'svn'], //10.5
];
sec.kSecProtocolTypeAny			= 0;

var schemesByProtocolType = {};
var protocolTypesByScheme = {};
for (var i in protocolTypes) {
	var label = protocolTypes[i][0];
	var fourCharString = protocolTypes[i][1];
	var schemeString = protocolTypes[i][2];
	var fourCharInteger = Security.protocolTypeFromString(fourCharString);
	
	sec[label] = fourCharInteger;
	if (schemeString) {
		protocolTypesByScheme[schemeString] = fourCharInteger;
		schemesByProtocolType[fourCharInteger] = schemeString;
	}
}

sec.schemeForProtocol = function(protocolType) {
	if (schemesByProtocolType[protocolType] !== undefined)
		return schemesByProtocolType[protocolType];
	
	return null;
};

sec.protocolForScheme = function(schemeString) {
	if (protocolTypesByScheme[schemeString] !== undefined)
		return protocolTypesByScheme[schemeString];
	
	return sec.kSecProtocolTypeAny;
};



// SecItemClass
sec.kSecInternetPasswordItemClass	= MacTypes.fourCharCodeFromString('inet');
sec.kSecGenericPasswordItemClass	= MacTypes.fourCharCodeFromString('genp');
sec.kSecAppleSharePasswordItemClass	= MacTypes.fourCharCodeFromString('ashp');


/*
 * Getting Information About Security Result Codes
 */
sec.declare('SecCopyErrorMessageString',
				ctypes.default_abi,
				CoreFoundation.CFStringRef,
				MacTypes.OSStatus,
				ctypes.voidptr_t);

/*
 * Managing Keychains
 */
sec.declare('SecKeychainOpen',
				ctypes.default_abi,
				MacTypes.OSStatus,
				ctypes.char.ptr,
				Security.SecKeychainRef.ptr);

sec.declare('SecKeychainCopyDefault',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef.ptr);
				
sec.declare('SecKeychainGetStatus',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef, // keychain
				Security.SecKeychainStatus.ptr); // keychainStatus

sec.declare('SecKeychainGetPath',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef,
				MacTypes.UInt32.ptr,
				ctypes.char.ptr);

/*
 * Locking/Unlocking
 */

sec.declare('SecKeychainLock',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef);

sec.declare('SecKeychainLockAll',
				ctypes.default_abi,
				MacTypes.OSStatus);

sec.declare('SecKeychainUnlock',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef,
				MacTypes.UInt32, // passwordLength
				ctypes.voidptr_t, // password
				MacTypes.Boolean // usePassword
				);

/*
 * Storing and Retrieving Passwords
 */
sec.declare('SecKeychainAddInternetPassword',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef, // keychain
				MacTypes.UInt32, // serverNameLength
				ctypes.char.ptr, // serverName
				MacTypes.UInt32, // securityDomainLength
				ctypes.char.ptr, // securityDomain
				MacTypes.UInt32, // accountNameLength
				ctypes.char.ptr, // accountName
				MacTypes.UInt32, // pathLength
				ctypes.char.ptr, // path
				MacTypes.UInt16, // port
				Security.SecProtocolType, // protocol
				Security.SecAuthenticationType, // authenticationType
				MacTypes.UInt32, // passwordLength
				ctypes.voidptr_t, // passwordData
				Security.SecKeychainItemRef.ptr // itemRef
				);
				
sec.declare('SecKeychainFindInternetPassword',
				ctypes.default_abi,
				MacTypes.OSStatus,
				CoreFoundation.CFTypeRef, // keychainOrArray
				MacTypes.UInt32, // serverNameLength,
				ctypes.char.ptr, // serverName,
				MacTypes.UInt32, // securityDomainLength,
				ctypes.char.ptr, // securityDomain,
				MacTypes.UInt32, // accountNameLength,
				ctypes.char.ptr, // accountName,
				MacTypes.UInt32, // pathLength,
				ctypes.char.ptr, // path,
				MacTypes.UInt16, // port,
				Security.SecProtocolType, // protocol,
				Security.SecAuthenticationType, // authenticationType,
				MacTypes.UInt32.ptr, // passwordLength,
				ctypes.voidptr_t.ptr, // passwordData,
				Security.SecKeychainItemRef.ptr // itemRef
				);

/*
 * Searching for Keychain Items
 */
sec.declare('SecKeychainSearchCreateFromAttributes',
				ctypes.default_abi,
				MacTypes.OSStatus,
				CoreFoundation.CFTypeRef, // keychainOrArray
				Security.SecItemClass, // itemClass
				Security.SecKeychainAttributeList.ptr, // attrList
				Security.SecKeychainSearchRef.ptr // searchRef
				);

sec.declare('SecKeychainSearchCopyNext',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainSearchRef, // searchRef
				Security.SecKeychainItemRef.ptr // itemRef
				);

/*
 * Creating and Deleting Keychain Items
 */
sec.declare('SecKeychainItemDelete',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainItemRef
				);

// Apparently this method exists in OS X 10.5 but is not public. Can we call it anyway?				
sec.declare('SecKeychainItemCreatePersistentReference',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainItemRef, // itemRef
				CoreFoundation.CFDataRef.ptr // persistentItemRef
				);

// Apparently this method exists in OS X 10.5 but is not public. Can we call it anyway?
sec.declare('SecKeychainItemCopyFromPersistentReference',
				ctypes.default_abi,
				MacTypes.OSStatus,
				CoreFoundation.CFDataRef, // persistentItemRef
				Security.SecKeychainItemRef.ptr // itemRef
				);

/*
 * Managing Keychain Items
 */
sec.declare('SecKeychainItemCopyAttributesAndData',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainItemRef, // itemRef
				Security.SecKeychainAttributeInfo.ptr, // info
				Security.SecItemClass.ptr, // itemClass
				Security.SecKeychainAttributeList.ptr.ptr, //attrList
				MacTypes.UInt32.ptr, // length
				ctypes.voidptr_t.ptr // outData
				);

sec.declare('SecKeychainItemModifyAttributesAndData',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainItemRef, // itemRef,
				Security.SecKeychainAttributeList.ptr, // attrList,
				MacTypes.UInt32, // length,
				ctypes.voidptr_t // data
				);
				
sec.declare('SecKeychainItemFreeAttributesAndData',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainAttributeList.ptr, //attrList
				ctypes.voidptr_t // data
				);

sec.declare('SecKeychainAttributeInfoForItemID',
				ctypes.default_abi,
				MacTypes.OSStatus,
				Security.SecKeychainRef, // keychain
				MacTypes.UInt32, // itemID,
				Security.SecKeychainAttributeInfo.ptr.ptr // info
				);

sec.stringForStatus = function(status) {
	var message = this.SecCopyErrorMessageString(status, null);
	return CoreFoundation.CFStringToJSString(message);
};