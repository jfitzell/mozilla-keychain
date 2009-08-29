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

const extensionId = "macos-keychain@fitzell.ca";
const prefImportPrompt = "startup-import-prompt";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function MacOSKeychainStartupImporter() {
}

MacOSKeychainStartupImporter.prototype = {
  classDescription: "MacOSKeychain Startup Importer",
  contractID: "@fitzell.ca/macos-keychain/startup-importer;1",
  classID: Components.ID("{494c2389-8d87-42cd-98b4-95b26a2f9ef3}"),
  QueryInterface : XPCOMUtils.generateQI([Ci.nsIObserver]),
  
  // Register ourselves as a storage component
  _xpcom_categories: [
    {
      category: "app-startup",
      service: true
    }
  ],
  
  _debug       : false, // mirrors signon.debug
  
  __logService : null,
  get _logService() {
    if (!this.__logService)
      this.__logService = Cc["@mozilla.org/consoleservice;1"].
                            getService(Ci.nsIConsoleService);
    
    return this.__logService;
  },

  __observerService : null, // Observer Service, for notifications
  get _observerService() {
    if (!this.__observerService)
      this.__observerService = Cc["@mozilla.org/observer-service;1"].
                               getService(Ci.nsIObserverService);
    
    return this.__observerService;
  },
  
  __keychainStorage : null,
  get _keychainStorage() {
    if (!this.__keychainStorage) {
      this.__keychainStorage = Cc["@fitzell.ca/macos-keychain/storage;1"].
                               createInstance(Ci.nsILoginManagerStorage);
      this.__keychainStorage.init();
    }
    
    return this.__keychainStorage;
  },
  
  __prefService : null,
  get _prefService() {
    if (!this.__prefService)
      this.__prefService = Cc["@mozilla.org/preferences-service;1"].
                           getService(Ci.nsIPrefService);
    
    return this.__prefService;
  },

  /**
   * Log a debug message if debugging is turned on via the signon.debug
   *  preference.
   */
  log: function (message) {
    if (!this._debug)
      return;
      
    dump("MacOSKeychainStartupImporter: " + message + "\n");
    this._logService.logStringMessage("MacOSKeychainStartupImporter: " + message);
  },
  
  
  /**
   * Check whether we should prompt the user to import their old logins.
   *  If we should and they confirm it, then start the import process.
   */
  confirmImport: function () {
    var signonPrefs = this._prefService.getBranch("signon.");
    signonPrefs.QueryInterface(Ci.nsIPrefBranch2);
    this._debug = signonPrefs.getBoolPref("debug");
    
    this.log("confirmImport()");
    
    var prefs = this._prefService.getBranch("extensions." + extensionId + ".");
    prefs.QueryInterface(Ci.nsIPrefBranch2);
    
    var import;
    try {
      import = prefs.getBoolPref(prefImportPrompt);
    } catch (e) {
      import = false;
    }
    
    if (import) {
      var promptSvc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                                .getService(Ci.nsIPromptService);
      var flags = promptSvc.BUTTON_POS_0 * promptSvc.BUTTON_TITLE_IS_STRING +
                  promptSvc.BUTTON_POS_1 * promptSvc.BUTTON_TITLE_IS_STRING  +
                  promptSvc.BUTTON_POS_2 * promptSvc.BUTTON_TITLE_IS_STRING;
      var result = promptSvc.confirmEx(null,
                        "Import saved logins into Keychain Services?",
                        "The Keychain Service Integration extension can import your existing saved logins into Keychain Services. This allows them to be shared with other applications on your computer. Your original logins will be left in place and will still be available if you disable this extension later. Do you want to import your saved logins now?",
                        flags, "Yes", "No", "Ask me later",
                        null, {});
      
      if (result == 0) {
        try {
          var s = this._keychainStorage.QueryInterface(Ci.IMacOSKeychainStartupImporter);
          s.importLogins();
        } catch (e) {
          this.log(e);
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
    this.log("Observed " + subject + " " + topic + " " + data);
    switch(topic) {
      case "app-startup":
        this._observerService.addObserver(this, "final-ui-startup", false);
        //this._observerService.remove
        break;
      case "final-ui-startup":
        //this._observerService.remove
        this.confirmImport();
        break;
    }
  },
};

var component = [MacOSKeychainStartupImporter];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(component);
}