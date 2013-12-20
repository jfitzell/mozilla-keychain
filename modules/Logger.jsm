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

var constants = {};
Components.utils.import('resource://macos-keychain/Constants.jsm', constants);

var WebAPI = {};
// https://developer.mozilla.org/en-US/docs/Web/API/console
XPCOMUtils.defineLazyModuleGetter(WebAPI, "console",
                                 "resource://gre/modules/devtools/Console.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

/** @module Logger */
const EXPORTED_SYMBOLS = ['Logger'];


/**
 * Log a message to the Mozilla Error Console
 * @param {string} message
 */
function logConsoleMessage(message) {
	Services.console.logStringMessage(constants.logPrefix + ': ' + message);
};


/**
 * Log a message to the system console
 * @param {string} message
 */
function logSystemConsoleMessage(message) {
	dump(constants.logPrefix + ': ' + message + "\n");
};

/**
 * Log a stack trace to the system console
 * @param {Array} stack An array of stack frame objects as returned
 *  by {@link stackTrace()}
 */
function logStackTrace(stack) {
	var frame = stack[0];
	if (! frame)
		return;

	var consoleEvent = {
		ID: "keychain",
		innerID: frame.filename,
		level: "trace",
		filename: frame.filename,
		lineNumber: frame.lineNumber,
		functionName: frame.functionName,
		timeStamp: Date.now(),
		arguments: [],
		stacktrace: stack,
	};

	consoleEvent.wrappedJSObject = consoleEvent;

	Services.obs.notifyObservers(consoleEvent, "console-api-log-event", null);
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
			Logger.trace(arguments);

			if (topic == 'nsPref:changed') {
				var prefName = data;
				Logger.log('Logger notified of change to preference signon.'
						+ prefName);

				if (prefName == 'debug') {
					_debugEnabled = signonPrefs.getBoolPref(prefName);
					if (_debugEnabled)
						Logger.log('Logging enabled');
					else {
						logConsoleMessage('Logging disabled');
						logSystemConsoleMessage('Logging disabled');
					}
				} else {
					Logger.log('Unhandled preference signon.' + prefName);
				}
			} else {
				Logger.error('Unexpected notification received: ' + topic);
			}
		}
	};

	signonPrefs.addObserver('', _prefsObserver, false);
};
initDebugEnabled();


/**
 * Generate a stack trace for the caller or, if provided, an exception
 *
 * @param {exception} [e] An exception from which to generate a stack trace
 * @returns {Array<{functionName:String, filename:String, lineNumber:String}>}
 */
function stackTrace(e) {
	var exception = e;
	var drop = 0; // If an exception is passed in, we keep the whole stack

	try {
		if (!exception || exception.stack === undefined)
			throw new Error();
	} catch (e) {
		exception = e;
		// If generating a stack, we want to drop our own stack frame
		drop = 1;
	}

	return exception.stack.split("\n").slice(drop,-1).map(function(s) {
		var matches = /^([^@]*)@(.*):(\d*)$/.exec(s);
		return {
			functionName: matches[1] || null,
			filename: matches[2] || null,
			lineNumber: matches[3] || null
		};
	});
};


/**
 * Return a string describing the filename and line number of the stack frame
 *
 * @param {object} frame A stack frame object returned by {@link stackTrace()}
 */
function sourceLineLocation(frame) {
	if (frame.filename || frame.lineNumber) {
		return ' ['
			+ (frame.filename
				? frame.filename.split('/').slice(-2).join('/')
				: '')
			+ (frame.lineNumber ? (':' + frame.lineNumber) : '')
			+ ']';
	} else {
		return '';
	}
};


/**
 * Log a "script error" to the mozilla Error Console
 *
 * @param {integer} flags nsIScriptError bitmask flags
 * @param {integer} loggerFrames Number of Logger stack frames to ignore
 * @param {string} [message] A message to log
 * @param {*} [exception] Any value that can be thrown as an exception
 */
function logScriptError(flags, loggerFrames, messageOrException, exception) {
	if (messageOrException
			&& messageOrException.stack !== undefined
			&& exception === undefined) {
		exception = messageOrException;
		messageOrException = '';
	}
	var message = messageOrException || '';
	exception = exception || null;

	// If we were passed an exception, include its description in the message
	if (exception) {
		if (message != '')
			message += ': ';

		message += exception;
	}

	// Get a stack trace from the exception if it was passed in, or from
	//  our caller otherwise, and grab the top stack frame
	var stack;
	if (exception && exception.stack) {
		stack = stackTrace(exception);
	} else {
		// 1 for this function, frames in the logger module, and user frames
		stack = stackTrace().slice(1 + loggerFrames);
	}
	// make sure we don't have an undefined frame
	var frame = stack[0] || {};


	// First log to the system console if we're debugging
	if (_debugEnabled)
		logSystemConsoleMessage(
				((flags & Ci.nsIScriptError.warningFlag) ? 'WARNING' : 'ERROR')
				+ ' - ' + message
				+ sourceLineLocation(frame));


	// Finally, log to the Mozilla console
	var scriptError = Cc["@mozilla.org/scripterror;1"]
			.createInstance(Ci.nsIScriptError);
	scriptError.init(constants.logPrefix + ': ' + message,
			frame.filename, null, frame.lineNumber, null,
			flags, 'component javascript');
	Services.console.logMessage(scriptError);

	if (_debugEnabled)
		logStackTrace(stack);
}

/**
 * @namespace
 * @memberof module:Logger
 */
var Logger = {
	/**
	 * Convert an argument to a string representation that can be safely logged.
	 *
	 * @param {*} arg
	 */
	stringify: function(arg) {
		if (typeof arg == 'string')
			return "'" + arg + "'";
		else if (typeof arg == 'undefined')
			return 'undefined';
		else if (typeof arg == 'function')
			return 'function()';
		else if (null === arg)
			return 'null';
		else if (Array.isArray(arg))
			return '[' + arg.map(Logger.stringify).toString() + ']';
		else
			return arg.toString();
	},


	/**
	 * Log a debugging message to the Mozilla Error Console and the
	 *  system console. Debugging must be turned on via the
	 *  {@linkcode signon.debug} preference.
	 *
	 * @param {string} message Text to be logged
	 */
	log: function (message) {
		if (! _debugEnabled)
			return;

		logSystemConsoleMessage(message);
		logConsoleMessage(message);
	},


	/**
	 * Note the execution of a function or other event to aid in tracing flow.
	 *  The name and location of the caller will be used unless the second
	 *  argument specifies how far back in the stack to look.
	 *
	 * @param  {string|object} messageOrArguments Either the
	 *  {@linkcode arguments} object of the function call being logged
	 *  or a message to log.
	 * @param {integer} [userFrames=0] Number of stack frames to skip from
	 *   the caller in order to find the function call being logged.
	 */
	trace: function (messageOrArguments, userFrames) {
		if (! _debugEnabled) // TODO: use a separate flag for this?
			return;

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
							.map(Logger.stringify).toString();
			}

			return [message, args];
		};

		var frame = stackTrace().slice(1 + (userFrames || 0))[0];
		var [message, args] = extractFirstArgument();

		logSystemConsoleMessage('+  '
				+ message
				+ ((message && frame.functionName) ? '   in ' : '')
				+ (frame.functionName ?
					(frame.functionName + '(' + args + ')') :
					'')
				+ sourceLineLocation(frame) );
	},


	/**
	 * Log a warning
	 *
	 * @param {string} [message] A message to log
	 * @param {*} [exception] Any value that can be thrown as an exception
	 */
	warning: function (messageOrException, exception) {
		// Log a warning and drop one stack frame
		logScriptError(Ci.nsIScriptError.warningFlag, 1,
				messageOrException, exception);
	},


	/**
	 * Log an error
	 *
	 * @param {string} [message] A message to log
	 * @param {*} [exception] Any value that can be thrown as an exception
	 */
	error: function (messageOrException, exception) {
		// Log an error and drop one stack frame
		logScriptError(Ci.nsIScriptError.errorFlag, 1,
				messageOrException, exception);
	},

	/**
	 * Log a full representation of an object to the Browser Console
	 *
	 * @param {*} object the object to dump
	 */
	dump: function(object) {
		if (_debugEnabled)
			WebAPI.console.log(object);
	},

	/**
	 * Log a stack trace from this point to the Browser Console
	 */
	stackTrace: function() {
		if (_debugEnabled)
			WebAPI.console.trace();
	},
};