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
Components.utils.import("resource://macos-keychain/MacOSKeychainImporter.jsm");

const contractObserverService = '@mozilla.org/observer-service;1';

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
				MacOSKeychainImporter.confirmImport();
				break;
		}
	},
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([MacOSKeychainStartupImporter]);