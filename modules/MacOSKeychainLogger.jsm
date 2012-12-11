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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

const Cc = Components.classes;
const Ci = Components.interfaces;

const consoleServiceContract = '@mozilla.org/consoleservice;1';
const preferencesServiceContract = '@mozilla.org/preferences-service;1';

const EXPORTED_SYMBOLS = ['MacOSKeychainLogger'];

var MacOSKeychainLogger = {};

var _logService = null;
function logService() {
	if (! _logService) {
		_logService = Cc[consoleServiceContract].getService(Ci.nsIConsoleService);
	}
	
	return _logService;
}

// mirrors signon.debug
var _debugEnabled = false;
function initDebugEnabled() {
	// Connect to the correct preferences branch.
	var prefService = Cc[preferencesServiceContract].getService(Ci.nsIPrefService);
	var signonPrefs = prefService.getBranch('signon.');
	signonPrefs.QueryInterface(Ci.nsIPrefBranch2);
	_debugEnabled = signonPrefs.getBoolPref('debug');
	
	var _prefsObserver = {
		QueryInterface : XPCOMUtils.generateQI([Ci.nsIObserver]),
		
		// nsObserver
		observe : function (subject, topic, data) {
			if (topic == 'nsPref:changed') {
				var prefName = data;
				MacOSKeychainLogger.debug('Logger notified of change to preference signon.' + prefName);
		
				if (prefName == 'debug') {
					_debugEnabled = signonPrefs.getBoolPref('debug');
					if (_debugEnabled)
						MacOSKeychainLogger.debug('Logging enabled');
				} else {
					MacOSKeychainLogger.debug('Unhandled preference signon.' + prefName);
				}
			} else {
				MacOSKeychainLogger.log('Logger received unexpected notification: ' + topic);
			}
		}
	};
	
	signonPrefs.addObserver('', _prefsObserver, false);
};
initDebugEnabled();

//var _prefBranch = null;
//this._prefBranch = prefService.getBranch('extensions.' + MacOSKeychain.extensionId + '.');
//this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);
	
/**
 * Log a debug message if debugging is turned on via the signon.debug
 *	preference.
 */
MacOSKeychainLogger.log = function (message) {
	if (! _debugEnabled)
		return;
		
	dump('MacOSKeychain: ' + message + "\n");
	logService().logStringMessage('MacOSKeychain: ' + message);
};
	
MacOSKeychainLogger.debug = function (message) {
	this.log(message);
};