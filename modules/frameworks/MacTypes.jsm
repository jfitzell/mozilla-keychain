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

const EXPORTED_SYMBOLS = ['MacTypes'];

var MacTypes = {};

MacTypes.noErr = 0;

MacTypes.Boolean = ctypes.unsigned_char;
MacTypes.UInt8 = ctypes.uint8_t;
MacTypes.SInt8 = ctypes.int8_t;
MacTypes.UInt16 = ctypes.uint16_t;
MacTypes.SInt16 = ctypes.int16_t;
MacTypes.UInt32 = ctypes.uint32_t;
MacTypes.SInt32 = ctypes.int32_t;
MacTypes.FourCharCode = MacTypes.UInt32;
MacTypes.OSType = MacTypes.FourCharCode;
MacTypes.OSStatus = MacTypes.SInt32;
MacTypes.UTF32Char = MacTypes.UInt32;
MacTypes.UniChar = ctypes.jschar; // uint16 with automatic conversion
MacTypes.UTF16Char = ctypes.jschar; // uint16 with automatic conversion
MacTypes.UTF8Char = ctypes.char; // uint8 with automatic conversion

MacTypes.stringFromFourCharCode = function(uint32) {
	if (! uint32) return null;
		
	return String.fromCharCode(
		uint32 >> 24,
		(uint32 >> 16) & 0xFF,
		(uint32 >> 8) & 0xFF,
		uint32 & 0xFF);
};

MacTypes.fourCharCodeFromString = function(string) {
	if (! (string && 4 == string.length)) return 0;
	
	return (string.charCodeAt(0) << 24) + (string.charCodeAt(1) << 16)
		+ (string.charCodeAt(2) << 8) + string.charCodeAt(3);
};
