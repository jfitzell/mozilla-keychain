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

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');

const Cc = Components.classes;
const Ci = Components.interfaces;

const EXPORTED_SYMBOLS = ['Logger'];

const logPrefix = 'MacOSKeychain';

var Logger = {};

function logScriptError(message, flags) {
	var scriptError = Cc["@mozilla.org/scripterror;1"].createInstance(Ci.nsIScriptError);
	scriptError.init(logPrefix + ': ' + message, null, null, null, null,
					flags, 'component javascript');
	Services.console.logMessage(scriptError);
};

function logConsoleMessage(message) {
	Services.console.logStringMessage(logPrefix + ': ' + message);
};

function logCommandLineConsoleMessage(message) {
	dump(logPrefix + ': ' + message + "\n");
};

// mirrors signon.debug
var _debugEnabled = false;
function initDebugEnabled() {
	// Connect to the correct preferences branch.
	var signonPrefs = Services.prefs.getBranch('signon.');
	signonPrefs.QueryInterface(Ci.nsIPrefBranch2);
	_debugEnabled = signonPrefs.getBoolPref('debug');

	var _prefsObserver = {
		QueryInterface : XPCOMUtils.generateQI([Ci.nsIObserver]),

		// nsObserver
		observe : function (subject, topic, data) {
			if (topic == 'nsPref:changed') {
				var prefName = data;
				Logger.log('Logger notified of change to preference signon.' + prefName);

				if (prefName == 'debug') {
					_debugEnabled = signonPrefs.getBoolPref(prefName);
					if (_debugEnabled)
						Logger.log('Logging enabled');
					else {
						logConsoleMessage('Logging disabled');
						logCommandLineConsoleMessage('Logging disabled');
					}
				} else {
					Logger.log('Unhandled preference signon.' + prefName);
				}
			} else {
				Logger.error('Logger received unexpected notification: ' + topic);
			}
		}
	};

	signonPrefs.addObserver('', _prefsObserver, false);
};
initDebugEnabled();

//var _prefBranch = null;
//this._prefBranch = prefService.getBranch('extensions.' + MacOSKeychain.extensionId + '.');
//this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);

function stackTrace() {
	try {
		throw new Error();
	} catch (e) {
		return e.stack.split("\n").slice(1,-1).map(function(s) {
			var matches = /^([^@]*)@(.*):(\d*)$/.exec(s);
			return {
				fn: matches[1] || null,
				file: matches[2] || null,
				line: matches[3] || null
			};
		});
	}
};

/**
 * Log a debug message if debugging is turned on via the signon.debug
 *	preference.
 */
Logger.log = function (message) {
	if (! _debugEnabled)
		return;

	logCommandLineConsoleMessage(message);
	logConsoleMessage(message);
};

Logger.trace = function (messageOrArguments, offset) {
	function extractFirstArgument() {
		var message, args;
		if (typeof messageOrArguments == 'string') {
			message = messageOrArguments;
			args = '';
		} else if (! messageOrArguments) {
			message = args = '';
		} else {
			message = '';
			args = Array.slice(messageOrArguments, 0)
						.map(function stringify(arg) {
				if (typeof arg == 'string')
					return "'" + arg + "'";
				else if (typeof arg == 'undefined')
					return 'undefined';
				else if (typeof arg == 'function')
				    return 'function()';
				else if (null === arg)
					return 'null';
				else if (Array.isArray(arg))
				    return '[' + arg.map(stringify).toString() + ']';
				else
					return arg;
				}).toString();
		}

		return [message, args];
	};

	function location(context) {
		if (context.file || context.line) {
			return ' ['
				+ (context.file
					? context.file.split('/').slice(-2).join('/')
					: '')
				+ (context.line ? (':' + context.line) : '')
				+ ']';
		} else {
			return '';
		}
	};

	var context = stackTrace().slice(1 + (offset || 0))[0];
	var [message, args] = extractFirstArgument();

	this.log('+  '
			+ message
			+ ((message && context.fn) ? '   in ' : '')
			+ (context.fn ? (context.fn + '(' + args + ')') : '')
			+ location(context) );
};

Logger.warning = function (message) {
	logScriptError(message, Ci.nsIScriptError.warningFlag);
	if (_debugEnabled)
		logCommandLineConsoleMessage('WARNING - ' + message);
};

Logger.error = function (message) {
	logScriptError(message, Ci.nsIScriptError.errorFlag);
	if (_debugEnabled)
		logCommandLineConsoleMessage('ERROR - ' + message);
};
