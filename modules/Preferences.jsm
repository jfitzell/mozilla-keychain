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
 * Portions created by the Initial Developer are Copyright (C) 2012
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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');
//Components.utils.import('resource://macos-keychain/MacOSKeychain.jsm');
Components.utils.import('resource://macos-keychain/Logger.jsm');

const Cc = Components.classes;
const Ci = Components.interfaces;

const branchName = 'extensions.' + 'macos-keychain@fitzell.ca.'; //MacOSKeychain.extensionId + '.';

const EXPORTED_SYMBOLS = ['Preferences'];

var Preferences = {};

var __branch = null;
function _branch() {
	if (!__branch) {
		__branch = Services.prefs.getBranch(branchName);
		__branch.QueryInterface(Ci.nsIPrefBranch);
	}

	return __branch;
};

var Preference = function () {};
Preference.prototype = {
	get name() {
		return this._name;
	},

	set name(prefName) {
		this._name = prefName;
	},

	get path() {
		return _branch().root + this._name;
	},

	hasUserValue: function() {
		return _branch().prefHasUserValue(this.name);
	},

	clear: function () {
		return _branch().clearUserPref(this.name);
	}
};

var BoolPreference = function (prefName) {
	this.name = prefName;
};
BoolPreference.prototype = new Preference();

BoolPreference.prototype.__defineGetter__('value', function () {
	Logger.trace('Getting boolean preference ' + this.name);
	try {
		var value = _branch().getBoolPref(this.name);
		Logger.trace('Preference has value: ' + value);
		return value;
	} catch (e) {
		Logger.warning('Getting preference failed with: ' + e);
		return undefined;
	}
});

BoolPreference.prototype.__defineSetter__('value', function (value) {
	Logger.trace('Setting boolean preference ' + this.name + ' to ' + value);
	_branch().setBoolPref(this.name, value);
});


var StringPreference = function (prefName) {
	this.name = prefName;
};
StringPreference.prototype = new Preference();

StringPreference.prototype.__defineGetter__('value', function () {
	Logger.trace('Getting string preference ' + this.name);
	try {
		var value = _branch()
			.getComplexValue(this.name, Ci.nsISupportsString)
			.data;
		Logger.trace('Preference has value: ' + value);
		return value;
	} catch (e) {
		Logger.warning('Getting preference failed with: ' + e);
		return undefined;
	}
});

StringPreference.prototype.__defineSetter__('value', function (value) {
	Logger.trace('Setting string preference ' + this.name + ' to ' + value);
	var str = Cc['@mozilla.org/supports-string;1']
		.createInstance(Ci.nsISupportsString);
	str.data = value;
	_branch().setComplexValue(this.name, Ci.nsISupportsString, str);
});



Preferences.startupImportPrompt = new BoolPreference('startup-import-prompt');
Preferences.writeKeychain = new StringPreference('write-keychain');
Preferences.searchKeychains = new StringPreference('search-keychains');






// function _getBoolPreference(prefName) {
// 	Logger.trace('Getting boolean preference ' + prefName);
// 	try {
// 		var value = _branch().getBoolPreferencePref(prefName);
// 		Logger.log('Preference has value: ' + value);
// 		return value;
// 	} catch (e) {
// 		Logger.log('Getting preference failed with: ' + e);
// 		return undefined;
// 	}
// };
//
// function _setBoolPreference(prefName, value) {
// 	Logger.trace('Setting boolean preference ' + prefName + ' to ' + value);
// 	_branch().setBoolPreferencePref(prefName, value);
// };
//
// function bool(prefName, propertyName) {
// 	Preferences.__defineGetter__(propertyName,
// 		function() { return _getBoolPreference(prefName); } );
// 	Preferences.__defineSetter__(propertyName,
// 		function(value) { _setBoolPreference(prefName, value); } );
// }
//
// bool('startup-import-prompt', 'startupImportPrompt');
//
//
