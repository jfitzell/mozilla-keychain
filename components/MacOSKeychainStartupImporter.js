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
 
const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://macos-keychain/MacOSKeychain.jsm");
Components.utils.import("resource://macos-keychain/MacOSKeychainLogger.jsm");

const prefImportPrompt = "startup-import-prompt";

const contractKeychainStorage = '@fitzell.ca/macos-keychain/storage;1';
const contractObserverService = '@mozilla.org/observer-service;1';
const contractPreferencesSerivce = '@mozilla.org/preferences-service;1';
const contractPromptService = '@mozilla.org/embedcomp/prompt-service;1';

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function MacOSKeychainStartupImporter() {
}

MacOSKeychainStartupImporter.prototype = {
	classID: Components.ID("{494c2389-8d87-42cd-98b4-95b26a2f9ef3}"),
	QueryInterface : XPCOMUtils.generateQI([Ci.nsIObserver]),

	get _observerService() {
		if (!this.__observerService)
			this.__observerService = Cc[contractObserverService].getService(Ci.nsIObserverService);
		
		return this.__observerService;
	},
	
	get _prefService() {
		if (!this.__prefService)
			this.__prefService = Cc[contractPreferencesSerivce].getService(Ci.nsIPrefService);
		
		return this.__prefService;
	},
	
	
	/**
	 * Check whether we should prompt the user to import their old logins.
	 *	If we should and they confirm it, then start the import process.
	 */
	confirmImport: function () {
		MacOSKeychainLogger.log("confirmImport()");
		
		var prefs = this._prefService.getBranch("extensions." + MacOSKeychain.extensionId + ".");
		prefs.QueryInterface(Ci.nsIPrefBranch2);
		
		var shouldImport;
		try {
			shouldImport = prefs.getBoolPref(prefImportPrompt);
		} catch (e) {
			shouldImport = false;
		}
		
		if (shouldImport) {
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
					MacOSKeychain.importLogins();
				} catch (e) {
					MacOSKeychainLogger.log('importLogins() failed with: ' + e);
				}
			}
			
			if (result != 2)
				prefs.setBoolPref(prefImportPrompt, false);
		} 
	},
	
	/**
	 =======================================
		nsIObserver implementation
	 =======================================
	 */
	
		
	observe: function (subject, topic, data) {
		MacOSKeychainLogger.log("Observed " + subject + " " + topic + " " + data);
		switch(topic) {
			case "profile-after-change":
				this._observerService.addObserver(this, "final-ui-startup", false);
				break;
			case "final-ui-startup":
				this._observerService.removeObserver(this, "final-ui-startup");
				MacOSKeychain.verifySignature();
				this.confirmImport();
				break;
		}
	},
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([MacOSKeychainStartupImporter]);