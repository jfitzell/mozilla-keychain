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
Components.utils.import("resource://macos-keychain/MacOSKeychain.jsm");
Components.utils.import("resource://macos-keychain/MacOSKeychainLogger.jsm");
Components.utils.import("resource://macos-keychain/MacOSKeychainPreferences.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

const prefImportPrompt = "startup-import-prompt";
const contractPreferencesService = '@mozilla.org/preferences-service;1';
const contractPromptService = '@mozilla.org/embedcomp/prompt-service;1';

const EXPORTED_SYMBOLS = ['MacOSKeychainImporter'];

var MacOSKeychainImporter = {};

var __prefService = null;
function _prefService() {
	if (!__prefService)
		__prefService = Cc[contractPreferencesService].getService(Ci.nsIPrefService);
	
	return __prefService;
};
	
	
/**
 * Check whether we should prompt the user to import their old logins.
 *	If we should and they confirm it, then start the import process.
 */
MacOSKeychainImporter.confirmImport = function () {
	MacOSKeychainLogger.log("confirmImport()");
	
	if (MacOSKeychainPreferences.startupImportPrompt.value) {
		var promptSvc = Cc[contractPromptService].getService(Ci.nsIPromptService);
		var flags = promptSvc.BUTTON_POS_0 * promptSvc.BUTTON_TITLE_IS_STRING +
					promptSvc.BUTTON_POS_1 * promptSvc.BUTTON_TITLE_IS_STRING +
					promptSvc.BUTTON_POS_2 * promptSvc.BUTTON_TITLE_IS_STRING;
		var result = promptSvc.confirmEx(null,
						"Import saved logins into Keychain Services?",
						"The Keychain Service Integration extension can import your existing saved logins into Keychain Services. This allows them to be shared with other applications on your computer. Your original logins will be left in place and will still be available if you disable this extension later. Do you want to import your saved logins now?",
						flags, "Yes", "No", "No, but ask me later",
						null, {});
		
		if (result == 0) {
			try {
				this.importLogins();
			} catch (e) {
				MacOSKeychainLogger.error('importLogins() failed with: ' + e);
				return;
			}
		}
		
		if (result != 2)
			MacOSKeychainPreferences.startupImportPrompt.value = false;
	} 
};

/**
 * Import logins from the old login storage provider into the keychain.
 */
MacOSKeychainImporter.importLogins = function () {
	MacOSKeychainLogger.trace("importLogins()");
	var logins = MacOSKeychain.defaultStorage.getAllLogins({});
	
	for (var i in logins) {
		var login = logins[i];
		try {
			MacOSKeychainLogger.log('  Importing ' + login.username + '@' + login.hostname);
			var items = MacOSKeychain.findKeychainItems(login.username, login.hostname,
												login.formSubmitURL, login.httpRealm);
			if (items.length == 0) {
				MacOSKeychain.addLogin(login);
				MacOSKeychainLogger.log('   --> Success!');
			} else {
				MacOSKeychainLogger.log('   --> Duplicate keychain item found... skipping.');
			}
		} catch (e) {
			MacOSKeychainLogger.log('   --> Skipping due to exception: ' + e);
		}
	}
};

