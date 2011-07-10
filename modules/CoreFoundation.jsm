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
Components.utils.import('resource://macos-keychain/Framework.jsm');

const EXPORTED_SYMBOLS = ['CoreFoundation'];

function CoreFoundationFramework() {};
CoreFoundationFramework.prototype = new Framework('CoreFoundation');

var CoreFoundation = new CoreFoundationFramework();


var cf = CoreFoundationFramework.prototype;

cf.CFTypeRef = ctypes.void_t.ptr;
cf.CFIndex = ctypes.long;
cf.CFRange = new ctypes.StructType('CFRange', [
				{'location': ctypes.int32_t},
				{'length': ctypes.int32_t}
			]);
cf.CFStringRef = new ctypes.StructType('__CFString').ptr;
cf.CFURLRef = new ctypes.StructType('__CFURL').ptr;
cf.CFDataRef = new ctypes.StructType('__CFData').ptr;
cf.CFAllocatorRef = new ctypes.StructType('__CFAllocator').ptr;
cf.CFArrayRef = new ctypes.StructType('__CFArray').ptr;

/*
 * CFString functions
 */
cf.declare('CFStringGetLength',
				ctypes.default_abi,
				ctypes.int32_t,           // returns the number of Unicode characters
				CoreFoundation.CFStringRef);        // the string to check

cf.declare('CFStringGetCharacters',
				ctypes.default_abi,
				ctypes.void_t,
				CoreFoundation.CFStringRef,         // the string to get characters from
				CoreFoundation.CFRange,             // the range of characters
				ctypes.jschar.ptr);        // pointer to buffer to receive chars

cf.declare('CFStringGetCharactersPtr',
				ctypes.default_abi,
				ctypes.jschar.ptr,
				CoreFoundation.CFStringRef);

cf.declare('CFStringGetCharacterAtIndex',
				ctypes.default_abi,
				ctypes.jschar,
				CoreFoundation.CFStringRef,
				CoreFoundation.CFIndex);
				
cf.declare('CFStringCreateWithCharacters',
				ctypes.default_abi,
				CoreFoundation.CFStringRef,
				CoreFoundation.CFAllocatorRef,
				MacTypes.UniChar.ptr,
				CoreFoundation.CFIndex);

/*
 * CFData functions
 */
cf.declare('CFDataCreate',
				ctypes.default_abi,
				CoreFoundation.CFDataRef,
				ctypes.voidptr_t, //CFAllocatorRef allocator,
				MacTypes.UInt8.ptr, // bytes,
				CoreFoundation.CFIndex // length
				);

cf.declare('CFDataGetLength',
				ctypes.default_abi,
				CoreFoundation.CFIndex,
				CoreFoundation.CFDataRef);

cf.declare('CFDataGetBytes',
				ctypes.default_abi,
				ctypes.void_t,
				CoreFoundation.CFDataRef,
				CoreFoundation.CFRange,
				MacTypes.UInt8.ptr);

cf.declare('CFDataGetBytePtr',
				ctypes.default_abi,
				MacTypes.UInt8.ptr,
				CoreFoundation.CFDataRef);

// Generic CFType routines
cf.declare('CFRelease',
				ctypes.default_abi,
				ctypes.void_t,
				ctypes.voidptr_t);
				
cf.CFStringToJSString = function(cfstr) {
	var len = this.CFStringGetLength(cfstr);
	var buffer = ctypes.jschar.array(len+1)();
	var i;
	
	for (i=0; i < len; i++) {
		buffer[i] = this.CFStringGetCharacterAtIndex(cfstr, i);//, this.CFRange(0, len), buffer);
	}
	return buffer.readString();
};

cf.JSStringToCFString = function(jsstr) {
	return this.CFStringCreateWithCharacters(null, jsstr, jsstr.length);
}