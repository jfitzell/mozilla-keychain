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

Components.utils.import("resource://gre/modules/ctypes.jsm");    
Components.utils.import("resource://macos-keychain/CoreFoundation.jsm");
Components.utils.import("resource://macos-keychain/Security.jsm");
Components.utils.import("resource://macos-keychain/KeychainItem.jsm");
 
const Cc = Components.classes;
const Ci = Components.interfaces;

const extensionId = "macos-keychain@fitzell.ca";
const prefImportPrompt = "startup-import-prompt";

/**
 POSSIBLE TODO:
  + two-way conversion between keychain and mozStorage
  + fall-through to mozStorage
  + store items so other browsers can access
  + allow storage of master password instead of all passwords
  + implement exception list using kSecNegativeItemAttr? (but Safari doesn't use it - check for a password of " " or "" or a specific username string
  + set (and honor?) the item comment to "default" like Safari
  + username field and password field could possibly be stored in the comments if needed
  + creator code (and only remove items created by us on remove all?)
  + camino caches the items to avoid prompting the user again on compare of the password they entered
  + camino searches without port or domain because safari sometimes sets neither
*/

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function MacOSKeychainStorage() {
    //this.init();
}

MacOSKeychainStorage.prototype = {
  classID: Components.ID("{87d15ebf-2a51-4e54-9290-315a54feea25}"),
  QueryInterface : XPCOMUtils.generateQI([Ci.nsILoginManagerStorage,
                                          Ci.IMacOSKeychainStartupImporter]),

  /*
   * This information is for compatibility with the component registration
   * performed by XPCOMUtils in versions prior to Gecko 2.0 (Firefox 4).
   * From that version on, this information is contained in the
   * Chrome manifest file.
   */
  classDescription: "MacOSKeychain Login Storage",
  contractID: "@fitzell.ca/macos-keychain/storage;1",
  /* End of compatibility info */
  
  /* This method of registering category entries is for backwards compatibility
   * with versions before Gecko 2.0 (Firefox 4). Versions from 2.0 onwards use
   * the Chrome manifest.
   */
  _xpcom_categories: [
    { category: "login-manager-storage", entry: "nsILoginManagerStorage" }
  ],
  /* End of compatibility registration */
  
  _prefBranch  : null,  // Preferences service
  _debug       : false, // mirrors signon.debug
  _nsLoginInfo : null, // Constructor for nsILoginInfo implementation
  
  __logService : null,
  get _logService() {
    if (!this.__logService)
      this.__logService = Cc["@mozilla.org/consoleservice;1"].
                            getService(Ci.nsIConsoleService);
    return this.__logService;
  },
  
  
  /**
   * An instance of the default storage component
   */
  __defaultStorage : null,
  get _defaultStorage() {
    if (!this.__defaultStorage) {
      this._initDefaultStorage();
    }
    
    return this.__defaultStorage;
  },
  
  
  /**
   * Initialize an instance of the default storage component that Mozilla would have
   *  used if this component was not registered. This has to try various contract IDs
   *  to account for different versions of Mozilla
   */
  _initDefaultStorage: function (inFile, outFile) {
    try {
      if ("@mozilla.org/login-manager/storage/mozStorage;1" in Cc) {
        this.__defaultStorage = Cc["@mozilla.org/login-manager/storage/mozStorage;1"].
                                createInstance(Ci.nsILoginManagerStorage);
      } else {
        this.__defaultStorage = Cc["@mozilla.org/login-manager/storage/legacy;1"].
                                createInstance(Ci.nsILoginManagerStorage);
      }
   
      if (inFile || outFile)
        this.__defaultStorage.initWithFile(inFile, outFile);
      else
        this.__defaultStorage.init();
    } catch (e) {
      this.log("Initialization of mozilla login storage component failed: " + e);
      this.__defaultStorage = null;
      throw e;
    }
  },

  _convertKeychainItemsToLoginInfos: function (items) {
  	this.debug('_convertKeychainItemToLoginInfo(...)');
    var logins = new Array();
    for ( var i in items ) {
      try {
        logins.push(this._convertKeychainItemToLoginInfo(items[i]));
      } catch (e) {
        this.log('Ignoring Keychain Item. Conversion failed with: ' + e);
      }
    }
    
    return logins;
  },
  
  /**
   * Create and initialize a new nsILoginInfo with the data in the provided
   *  Keychain Item.
   *
   */
  _convertKeychainItemToLoginInfo: function (item) {
    this.debug("_convertKeychainItemToLoginInfo[ item: (" +
             this._debugStringForKeychainItem(item) + ") ]");
    var info = new this._nsLoginInfo();

	//this.debug(item._attributes.toSource());
    var uriString = item.uriString;
    this.debug("  URI String: " + uriString);
    var uri = this._uri(uriString);
    // Remove the trailing slash from the URI since LoginManager doesn't put
    //  it there and uses a strict string comparison when checking the results
    //  of a find operation to determine if any of the LoginInfos is an exact match.
	var hostname = uri.spec.substring(0, uri.spec.length - 1);
    this.debug("  Parsed URI: " + hostname);
    
    var formSubmitURL, httpRealm;
    if (Security.kSecAuthenticationTypeHTMLForm == item.authenticationType) {
      // nsLoginInfo.matches() allows two instances to match on the
      //  formSubmitURL field as long as one of them is blank (but not null).
      //  Since we have nowhere to store that field in the keychain, we take
      //  this route.
      formSubmitURL = "";
      httpRealm = null;
    } else { // non-form logins
      formSubmitURL = null;
      httpRealm = item.securityDomain;
    }
    
   // We cannot store the usernameField and passwordField. According to:
   //  https://developer.mozilla.org/en/nsILoginInfo
   //  they should be specify an empty string for non-form logins so that
   //  is what we return
    info.init(hostname,
              formSubmitURL, httpRealm,
              item.account, null,
              "" /*usernameField*/, "" /*passwordField*/);
    
    info.wrappedJSObject.__defineGetter__("password", function() {return item.password});
    
    this.log("  " + this._debugStringForLoginInfo(info));
    
    return info;
  },


  /**
   * Find and return Keychain Items that match the values provided by the
   * Mozilla login storage API.
   *
   * This method converts the Mozilla API values into the values expected by
   *  the lower level native components.
   *
   * Note: as specified in the Mozilla documentation at:
   *   https://developer.mozilla.org/en/NsILoginManagerStorage#findLogins%28%29
   *  hostname, formSubmitURL, and httpRealm support an empty string to match
   *  ALL values and a null value to match NO values (except null)
   * We also take the same approach with the username field.
   */
  _findKeychainItems: function (username, hostname, formSubmitURL, httpRealm) {
    this.debug("_findKeychainItems["
             + " username:" + username
             + " hostname:" + hostname
             + " formSubmitURL:" + formSubmitURL
             + " httpRealm:" + httpRealm + " ]");
    
    var accountName;
    if (null == username) // match only entries with no username
      accountName = "";
    else if ("" == username) // match ALL usernames
      accountName = null;
    else
      accountName = username;
    
    var scheme, host, port;
    if (null == hostname) // a null hostname matches NO entries
      return [];
    else if ("" == hostname) // an empty hostname matches ALL entries
      scheme = host = port = null;
    else {
      try {
        [scheme, host, port] = this._splitLoginInfoHostname(hostname);
      } catch (e) {
        // we don't yet support storing things with hostnames that are not
        //  valid URLs. We could store them as Generic items in the future.
        return [];
      }
    }
    
    var securityDomain;
    if ("" == httpRealm) // match ALL realms
      securityDomain = null;
    else if (null == httpRealm) // match only entries with NO realm
      securityDomain = "";
    else
      securityDomain = httpRealm;
    
    var authType;
    if ("" == formSubmitURL && "" == httpRealm) // match ANY type
      authType = null;
    else if (null != formSubmitURL) // match form logins only
      authType = Security.kSecAuthenticationTypeHTMLForm;
    else // match non-form logins only
      authType = Security.kSecAuthenticationTypeDefault;
    
    var protocolType = Security.protocolForScheme(scheme);
    
    this.debug("About to call KeychainItem.findInternetPasswords["
             + " account:" + accountName
             + " protocol:" + protocolType
             + " server:" + host
             + " port:" + port
             + " authenticationType:" + authType
             + " securityDomain:" + securityDomain + " ]");
    var items = KeychainItem.findInternetPasswords(accountName, protocolType, host,
                                           port, authType, securityDomain);
                                           
    this.log("  Items found: " + items.length);
    
    return items;
  },
  
  
  /**
   * Search for and return a Keychain Item that matches the data in the
   *  provided nsILoginInfo object. If multiple matches are found, the first
   *  is returned. If none is found, null is returned.
   */
  _findKeychainItemForLoginInfo: function (login) {
    this.debug("_findKeychainItemForLoginInfo[ login:" + login + " ]");
    
    var items = this._findKeychainItems(login.username,
                                        login.hostname,
                                        login.formSubmitURL,
                                        login.httpRealm);
    
    if (items.length > 0)
      return items[0];
    else
      return null;
  },
  
  
  /**
   * Return a new URI object for the given string
   */
  _uri: function (uriString) {
    try {
      var ios = Components.classes["@mozilla.org/network/io-service;1"].
                                  getService(Components.interfaces.nsIIOService);
      return ios.newURI(uriString, null, null);
    } catch (e) {
      this.log(e);
      throw Error('Invalid URI');
    }
  },
  
  /**
   * Return a new URL object for the given string
   */
  _url: function (urlString) {
    var uri = this._uri(urlString);
    try {
      var url = uri.QueryInterface(Ci.nsIURL);
      return url;
    } catch (e) {
      this.log(e);
      throw Error('Invalid URL');
    }
  },
  
  
  /**
   * The hostname field in nsILoginInfo contains the URI scheme, hostname,
   *  and port. This function takes an appropriately formatted string and
   *  returns a three-element array containing the scheme, hostname, and port.
   *  If any of the values is missing, null is provided for that position.
   */
  _splitLoginInfoHostname: function (hostname) {
    this.debug("_splitLoginInfoHostname[ hostname:" + hostname + " ]");
    var scheme = null;
    var host = null;
    var port = null;
    if (hostname) {
      try {
        var url = this._url(hostname);
        scheme = url.scheme;
        host = url.host;
        port = url.port;
      } catch (e) {
        throw Error("Unable to split hostname: " + e);
      }
      if (port == -1) // -1 indicates default port for the protocol
        port = null;
    }
    
    this.debug("  scheme:" + scheme + " host:" + host + " port:" + port);
    return [scheme, host, port];
  },
  
  
  _debugStringForLoginInfo: function (login) {
    return "hostname:" + login.hostname +
          " formSubmitURL:" + login.formSubmitURL +
          " httpRealm:" + login.httpRealm +
          " username:" + login.username +
          " password:(omitted)" +
          " usernameField:" + login.usernameField +
          " passwordField:" + login.passwordField;
  },
  
  
  _debugStringForKeychainItem: function (item) {
  	if (item === null)
  		return 'null';
  		
	return "protocol:" + item.protocol +
          " server:" + item.server +
          " port:" + item.port +
//          " securityDomain:" + item.securityDomain +
          " account:" + item.account +
          " password:(omitted)" +
          " authenticationType:" + item.authenticationType +
          " comment:" + item.comment +
          " label:" + item.label +
          " description:" + item.description;
  },
  
  
  /**
   * Log a debug message if debugging is turned on via the signon.debug
   *  preference.
   */
  log: function (message) {
    if (!this._debug)
      return;
      
    dump("MacOSKeychainStorage: " + message + "\n");
    this._logService.logStringMessage("MacOSKeychainStorage: " + message);
  },
  
  debug: function (message) {
  	this.log(message);
  },
  
  
  /**
   * Import logins from the old login storage provider into the keychain.
   */
  importLogins: function () {
    this.debug("importLogins()");
    var logins = this._defaultStorage.getAllLogins({});
    
    for (var i in logins) {
      var login = logins[i];
      try {
        var items = this._findKeychainItems(login.username, login.hostname,
                                            login.formSubmitURL, login.httpRealm);
        if (items.length == 0) {
          this.log("  No matching keychain item found... importing.");
          this.addLogin(login);
        } else {
          this.log("  Matching keychain item found... skipping import.");
        }
      } catch (e) {
        this.log("  Exception caught... skipping import.");
      }
    }
  },
  
	updateItemWithLoginInfo: function (item, loginInfo) {
		// I hate the duplication here with addLogin()
      
		item.accountName = loginInfo.username;
		item.password = loginInfo.password;
		
		var [scheme, host, port] = this._splitLoginInfoHostname(loginInfo.hostname);
		
		item.protocol = scheme;
		item.serverName = host;
		item.port = port;
		item.label = host + ' (' + loginInfo.username + ')';
		
		item.securityDomain = loginInfo.httpRealm;
		
		if (null != loginInfo.formSubmitURL) {
			item.description = 'Web form password';
			item.authenticationType = Security.kSecAuthenticationTypeHTMLForm;
		} else {
			item.description = null;
			item.authenticationType = Security.kSecAuthenticationTypeDefault;
		}
		
		//item.path = ;
		//item.comment = ;
	},

	updateItemWithProperties: function (item, properties) {
		var httpRealm = null;
		var formSubmitURL = null;
		var unknownProps = new Array();
		
		var propEnum = properties.enumerator;
		while (propEnum.hasMoreElements()) {
			var prop = propEnum.getNext().QueryInterface(Ci.nsIProperty);
			this.debug('Setting property: ' + prop.name);
			switch (prop.name) {
				// nsILoginInfo properties...
				case "hostname":
					var [scheme, host, port] = this._splitLoginInfoHostname(prop.value);
					item.protocol = scheme;
					item.serverName = host;
					item.port = port;
					break;
					
				case "formSubmitURL":
					if (null != prop.value)
						item.authenticationType = Security.kSecAuthenticationTypeHTMLForm;
					else
						item.authenticationType = Security.kSecAuthenticationTypeDefault;
					break;
				
				case "httpRealm":
					item.securityDomain = prop.value;
					break;
				
				case "username":
					item.accountName = prop.value;
					break;
				
				case "password":
					item.password = prop.value;
					break;
				
				case "usernameField":
				case "passwordField":
				case "timesUsedIncrement":
				case "timeLastUsed":
				case "timePasswordChanged":
					this.debug('--Unsupported property: ' + prop.name);
					// not supported
					break;
	
				// nsILoginMetaInfo properties...
				case "guid":
					// ???
					break;
	
				// Fail if caller requests setting an unknown property.
				default:
					this.debug('**Unknown property: ' + prop.name);
					unknownProps.push(prop.name);
			}
		}
      
		if (unknownProps.length > 0) {
			throw Error('Unexpected propertybag items: ' + unknownProps);
		}
	},
  
  /**
   =======================================
    Mozilla Storage API implementations
   =======================================
   */
   
  init: function () {
    this.debug("init()");
    
    // Connect to the correct preferences branch.
    var prefService = Cc["@mozilla.org/preferences-service;1"].
                         getService(Ci.nsIPrefService);
    var signonPrefs = prefService.getBranch("signon.");
    signonPrefs.QueryInterface(Ci.nsIPrefBranch2);
    this._debug = signonPrefs.getBoolPref("debug");
    
    this._prefBranch = prefService.getBranch("extensions." + extensionId + ".");
    this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);
    
    // Get constructor for nsILoginInfo
    this._nsLoginInfo = new Components.Constructor(
        "@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo);
    
    this.log("Done initializing.");
  },
  
  
  /**
   * initWithFile()
   * Just pass the filenames on to our mozilla storage instance. The filenames
   *  are kind of useless to this implementation of the storage interface so I
   *  don't know what else we'd do with them.
   */
  initWithFile: function (aInputFile, aOutputFile) {
    this.debug("initWithFile(" + aInputFile + "," + aOutputFile + ")");
    
    this._initDefaultStorage(aInputFile, aOutputFile);
    
    this.init();
  },
  
  
  addLogin: function (login) {
    this.debug("addLogin[ login: (" + this._debugStringForLoginInfo(login) + ") ]");
    //return this._defaultStorage.addLogin(login);
    
    try {
      var [scheme, host, port] = this._splitLoginInfoHostname(login.hostname);
    } catch (e) {
      // we don't yet support storing things with hostnames that are not
      //  valid URLs. We could store them as Generic items in the future.
      this.log("Failed to store login with invalid URL. Storing in legacy storage...");
      return this._defaultStorage.addLogin(login);
    }
    
    var label = host + " (" + login.username + ")";

    var authType = Security.kSecAuthenticationTypeHTMLForm;
    if (null == login.formSubmitURL)
      authType = Security.kSecAuthenticationTypeDefault;

	var protocolType = Security.protocolForScheme(scheme);
	if (! protocolType)
		throw Error('Unable to determine ProtocolType for scheme: ' + scheme);

    var item = KeychainItem.addInternetPassword(login.username, login.password,
                                 protocolType, host, port, null /*path*/,
                                 authType, login.httpRealm,
                                 null /*comment*/, label);
    
    this.debug("  keychain item: (" + this._debugStringForKeychainItem(item) + ")");
    
    if (null != login.formSubmitURL)
      item.description = "Web form password";
  },
  
  
  removeLogin: function (login) {
    this.debug("removeLogin()");
    //return this._defaultStorage.removeLogin(login);
    
    var item = this._findKeychainItemForLoginInfo(login);
    if (item) {
      item.delete();
      this.log("  Login successfully removed");
    } else {
      this.log("  No matching login found");
    }
  },
  
  
  modifyLogin: function (oldLogin, newLoginData) {
    this.debug('modifyLogin[ oldLogin:' + oldLogin + ' newLogin:' + newLoginData + ' ]');
    //return this._defaultStorage.modifyLogin(oldLogin, newLogin);
    var item = this._findKeychainItemForLoginInfo(oldLogin);
    if (! item) {
      this.log('  No matching login found');
      throw Error('No matching login found');
      return;
    }
    
    if (newLoginData instanceof Ci.nsILoginInfo) {
      this.updateItemWithLoginInfo(item, newLoginData);
    } else if (newLoginData instanceof Ci.nsIPropertyBag) {
      this.updateItemWithProperties(item, newLoginData);
    } else {
      throw Error('Unsupported parameter type provided for new login data');
    }
  },
  
  
  getAllLogins: function (count) {
    this.debug('getAllLogins()');
    //return this._defaultStorage.getAllLogins(count);
    
    var items = KeychainItem.findInternetPasswords(null /*accountName*/,
                                                null /*protocol*/,
                                                null /*serverName*/, 
                                                null /*port*/,
                                                null /*authType*/,
                                                null /*securityDomain*/);
    
    var logins = this._convertKeychainItemsToLoginInfos(items);
    
    this.log('  Found ' + logins.length + ' logins');
    
    count.value = logins.length;
    return logins;
  },
  
  
  removeAllLogins: function () {
    this.debug('removeAllLogins()');
    //return this._defaultStorage.removeAllLogins();
    var items = KeychainItem.findInternetPasswords(null /*accountName*/,
                                                null /*protocol*/,
                                                null /*serverName*/, 
                                                null /*port*/,
                                                null /*authType*/,
                                                null /*securityDomain*/);
    
    for ( var i in items ) {
      this.log('  Deleting ' + items[i].serverName);
      items[i].delete();
    }
  },
  
  
  getAllDisabledHosts: function (count) {
    this.debug('getAllDisabledHosts()');
    return this._defaultStorage.getAllDisabledHosts(count);
  },
  
  
  getLoginSavingEnabled: function (hostname) {
    this.debug('getLoginSavingEnabled[ hostname:' + hostname + ' ]');
    return this._defaultStorage.getLoginSavingEnabled(hostname);
  },
  
  
  setLoginSavingEnabled: function (hostname, enabled) {
    this.debug('setLoginSavingEnabled[ hostname:' + hostname + ' enabled:' + enabled + ' ]');
    return this._defaultStorage.setLoginSavingEnabled(hostname, enabled);
  },
  
  /**
   * Note: as specified in the Mozilla documentation at:
   *   https://developer.mozilla.org/en/NsILoginManagerStorage#findLogins%28%29
   *  An empty string for hostname, formSubmitURL, and httpRealm means match
   *  ALL values and a null value means match only items with NO value
   */
  findLogins: function (count, hostname, formSubmitURL, httpRealm) {
    this.debug('findLogins['
             + ' hostname:' + hostname
             + ' formSubmitURL:' + formSubmitURL
             + ' httpRealm:' + httpRealm + ' ]');
    //return this._defaultStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
    
    var items = this._findKeychainItems('' /*username*/, hostname,
                                        formSubmitURL, httpRealm);
    
    // Safari seems not to store the HTTP Realm in the securityDomain
    //  field so we try the search again without it.
    if (items.length == 0 && httpRealm != null && httpRealm != '') {
      items = this._findKeychainItems('' /*username*/, hostname,
                                      formSubmitURL, '' /*httpRealm*/);
      for (var i in items) {
        items[i].securityDomain = httpRealm;
      }
    }
    
    if (items.length == 0 /* && an appropriate preference is set*/) {
      this.log('No items found. Checking mozilla storage...');
      return this._defaultStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
    }
      
    var logins = this._convertKeychainItemsToLoginInfos(items);
    
    count.value = logins.length;
    return logins;
  },
  
  
  countLogins: function (hostname, formSubmitURL, httpRealm) {
    this.debug('countLogins['
             + ' hostname:' + hostname
             + ' formSubmitURL:' + formSubmitURL
             + ' httpRealm:' + httpRealm + ' ]');
    //return this._defaultStorage.countLogins(hostname, formSubmitURL, httpRealm);
    
    var items = this._findKeychainItems('' /*username*/, hostname,
                                        formSubmitURL, httpRealm);
    
    // Safari seems not to store the HTTP Realm in the securityDomain
    //  field so we try the search again without it.
    if (items.length == 0 && httpRealm != null && httpRealm != '')
      items = this._findKeychainItems('' /*username*/, hostname,
                                      formSubmitURL, '' /*httpRealm*/);
    
    if (items.length == 0 /* && an appropriate preference is set*/) {
      this.log('No items found. Checking mozilla storage...');
      return this._defaultStorage.countLogins(hostname, formSubmitURL, httpRealm);
    }
    
    return items.length;
  },
  
  get uiBusy() {
  	return false;
  }
};



/**
* XPCOMUtils.generateNSGetFactory was introduced in Mozilla 2 (Firefox 4).
* XPCOMUtils.generateNSGetModule is for Mozilla 1.9.2 (Firefox 3.6).
*/
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory([MacOSKeychainStorage]);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule([MacOSKeychainStorage]);