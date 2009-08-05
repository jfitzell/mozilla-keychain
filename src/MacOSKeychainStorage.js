const Cc = Components.classes;
const Ci = Components.interfaces;

/**
 POSSIBLE TODO:
  + delay lookup of passwords to prevent prompting user
  + conversion between keychain and mozStorage
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
  classDescription: "MacOSKeychain Login Storage",
  contractID: "@fitzell.ca/macos-keychain/storage;1",
  classID: Components.ID("{87d15ebf-2a51-4e54-9290-315a54feea25}"),
  QueryInterface : XPCOMUtils.generateQI([Ci.nsILoginManagerStorage]),
  
  // Register ourselves as a storage component
  _xpcom_categories: [
    {
      category: "login-manager-storage",
      entry: "nsILoginManagerStorage"
    }
  ],
  
  _prefBranch  : null,  // Preferences service
  _debug       : false, // mirrors signon.debug
  _nsLoginInfo : null, // Constructor for nsILoginInfo implementation
  _keychainService : null, // The MacOSKeychainService
  
  __logServiceÊ: null,
  get _logService() {
    if (!this.__logService)
      this.__logService = Cc["@mozilla.org/consoleservice;1"].
                            getService(Ci.nsIConsoleService);
    return this.__logService;
  },

  
  /**
   * An instance of the mozilla storage component used to fall through API methods
   * that are not implemented in the Mac OS Keychain.
   */
  __mozillaStorage : null,
  get _mozillaStorage() {
    if (!this.__mozillaStorage) {
      this.__mozillaStorage = Cc["@mozilla.org/login-manager/storage/mozStorage;1"].
                               createInstance(Ci.nsILoginManagerStorage);
     
      try {
        this.__mozillaStorage.init();
      } catch (e) {
        this.log("Initialization of mozilla login storage component failed: " + e);
        this.__mozillaStorage = null;
        throw e;
      }
    }
    
    return this.__mozillaStorage;
  },

  
  /**
   * Create and initialize a new nsILoginInfo with the data in the provided
   *  Keychain Item.
   *
   */
  _convertKeychainItemToLoginInfo: function (item) {
    this.log("_convertKeychainItemToLoginInfo[ item: (" +
             this._debugStringForKeychainItem(item) + ") ]");
    var info = new this._nsLoginInfo();
    
    var uri = this._uri(item.protocol + "://" + item.serverName
                             + (item.port == 0 ? "" : ":"+item.port));
	var hostname = uri.spec.substring(0, uri.spec.length - 1);
    this.log("  Parsed URI: " + hostname);
    
    var formSubmitURL, httpRealm;
    if (Ci.IMacOSKeychainItem.AuthTypeHTMLForm == item.authenticationType) {
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
              item.accountName, item.password,
              "" /*usernameField*/, "" /*passwordField*/);
    
    this.log("  " + this._debugStringForLoginInfo(info));
    
    return info;
  },

  
  /**
   * Wrapper method for MacOSKeychainService::findInterPasswordItems()
   *
   * This method deals with enumerators and query interfaces in order to return
   * a simple array of Keychain Items.
   *
   * A value of null for any parameter is interpreted as matching ALL values
   *  (ie. the parameter is not included in the search criteria)
   */
  _findInternetPasswordItems: function (accountName, protocol, serverName,
                                        port, authType, securityDomain) {
    this.log("_findInternetPasswordItems["
             + " accountName:" + accountName
             + " protocol:" + protocol
             + " serverName:" + serverName
             + " port:" + port
             + " authType:" + authType
             + " securityDomain:" + securityDomain + " ]");

    var items = this._keychainService.findInternetPasswordItems(accountName,
                                                protocol, serverName, port,
                                                authType, securityDomain);
    var enumerator = items.enumerate();
    var itemArray = new Array();
    while ( enumerator.hasMoreElements() ) {
      var item = enumerator.getNext().QueryInterface(Ci.IMacOSKeychainItem);
      itemArray.push(item);
    }
    
    this.log("  Items found: " + itemArray.length);
    
    return itemArray;
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
    this.log("_findKeychainItems["
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
    else
      [scheme, host, port] = this._splitLoginInfoHostname(hostname);
    
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
      authType = Ci.IMacOSKeychainItem.AuthTypeHTMLForm;
    else // match non-form logins only
      authType = Ci.IMacOSKeychainItem.AuthTypeDefault;
    
    return this._findInternetPasswordItems(accountName, scheme, host,
                                           port, authType, securityDomain);
  },
  
  
  /**
   * Search for and return a Keychain Item that matches the data in the
   *  provided nsILoginInfo object. If multiple matches are found, the first
   *  is returned. If none is found, null is returned.
   */
  _findKeychainItemForLoginInfo: function (login) {
    this.log("_findKeychainItemForLoginInfo[ login:" + login + " ]");
    
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
    var ios = Components.classes["@mozilla.org/network/io-service;1"].
                                getService(Components.interfaces.nsIIOService);
    return ios.newURI(uriString, null, null);
  },
  
  
  /**
   * The hostname field in nsILoginInfo contains the URI scheme, hostname,
   *  and port. This function takes an appropriately formatted string and
   *  returns a three-element array containing the scheme, hostname, and port.
   *  If any of the values is missing, null is provided for that position.
   */
  _splitLoginInfoHostname: function (hostname) {
    this.log("_splitLoginInfoHostname[ hostname:" + hostname + " ]");
    var scheme = null;
    var host = null;
    var port = null;
    if (hostname) {
      var uri = this._uri(hostname);
      scheme = uri.scheme;
      host = uri.host;
      port = uri.port;
      if (port == -1) // -1 indicates default port for the protocol
        port = null;
    }
    
    this.log("  scheme:" + scheme + " host:" + host + " port:" + port);
    return [scheme, host, port];
  },
  
  
  _debugStringForLoginInfo: function (login) {
    return "hostname:" + login.hostname +
          " formSubmitURL:" + login.formSubmitURL +
          " httpRealm:" + login.httpRealm +
          " username:" + login.username +
          " password:" + (login.password == null ? null : "****") +
          " usernameField:" + login.usernameField +
          " passwordField:" + login.passwordField;
  },
  
  
  _debugStringForKeychainItem: function (item) {
    return "protocol:" + item.protocol +
          " serverName:" + item.serverName +
          " port:" + item.port +
          " securityDomain:" + item.securityDomain +
          " accountName:" + item.accountName +
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
  
  
  /**
   =======================================
    Mozilla Storage API implementations
   =======================================
   */
   
  init: function () {
    this.log("init()");
    
    // Connect to the correct preferences branch.
    this._prefBranch = Cc["@mozilla.org/preferences-service;1"].
                         getService(Ci.nsIPrefService);
    this._prefBranch = this._prefBranch.getBranch("signon.");
    this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);

    this._debug = this._prefBranch.getBoolPref("debug");
    
    // Get constructor for nsILoginInfo
    this._nsLoginInfo = new Components.Constructor(
        "@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo);
    
    this._keychainService = Cc["@fitzell.ca/macos-keychain/keychainService;1"].
                              getService(Ci.IMacOSKeychainService);    
  },
  
  
  /**
   * initWithFile()
   * Just pass the filenames on to our mozilla storage instance. The filenames
   *  are kind of useless to this implementation of the storage interface so I
   *  don't know what else we'd do with them.
   */
  initWithFile: function (aInputFile, aOutputFile) {
    this.log("initWithFile(" + aInputFile + "," + aOutputFile + ")");
    
    this.__mozillaStorage = Cc["@mozilla.org/login-manager/storage/mozStorage;1"].
                              createInstance(Ci.nsILoginManagerStorage);
    try {
      this.__mozillaStorage.initWithFile(aInputFile, aOutputFile);
    } catch (e) {
      this.log("Initialization of mozilla login storage component failed: " + e);
      this.__mozillaStorage = null;
      throw e;
    }
    
    this.init();
  },
  
  
  addLogin: function (login) {
    this.log("addLogin[ login: (" + this._debugStringForLoginInfo(login) + ") ]");
    //return this._mozillaStorage.addLogin(login);
    
    var [scheme, host, port] = this._splitLoginInfoHostname(login.hostname);
    
    var label = host + " (" + login.username + ")";

    var authType = Ci.IMacOSKeychainItem.AuthTypeHTMLForm;
    if (null == login.formSubmitURL)
      authType = Ci.IMacOSKeychainItem.AuthTypeDefault;

    var item = this._keychainService.addInternetPasswordItem(login.username, login.password,
                                 scheme, host, port, null /*path*/,
                                 authType, login.httpRealm,
                                 null /*comment*/, label);
    
    this.log("  keychain item: (" + this._debugStringForKeychainItem(item) + ")");
    
    if (null != login.formSubmitURL)
      item.description = "Web form password";
  },
  
  
  removeLogin: function (login) {
    this.log("removeLogin()");
    //return this._mozillaStorage.removeLogin(login);
    
    var item = this._findKeychainItemForLoginInfo(login);
    if (item) {
      item.delete();
      this.log("  Login successfully removed");
    } else {
      this.log("  No matching login found");
    }
  },
  
  
  modifyLogin: function (oldLogin, newLoginData) {
    this.log("modifyLogin[ oldLogin:" + oldLogin + " newLogin:" + newLoginData + " ]");
    //return this._mozillaStorage.modifyLogin(oldLogin, newLogin);
    var item = this._findKeychainItemForLoginInfo(oldLogin);
    if (! item) {
      this.log("  No matching login found");
      throw "No matching login found";
      return;
    }
    
    if (newLoginData instanceof Ci.nsILoginInfo) {
      // I hate the duplication here with addLogin()
      
      item.accountName = newLoginData.username;
      item.password = newLoginData.password;
      
      var [scheme, host, port] = this._splitLoginInfoHostname(newLoginData.hostname);
      
      item.protocol = scheme;
      item.serverName = host;
      item.port = port;
      item.label = host + " (" + newLoginData.username + ")";
      
      item.securityDomain = newLoginData.httpRealm;
      
      if (null != newLoginData.formSubmitURL) {
        item.description = "Web form password";
        item.authenticationType = Ci.IMacOSKeychainItem.AuthTypeHTMLForm;
      } else {
        item.description = null;
        item.authenticationType = Ci.IMacOSKeychainItem.AuthTypeDefault;
      }

      //item.path = ;
      //item.comment = ;
    } else if (newLoginData instanceof Ci.nsIPropertyBag) {
      var httpRealm = null;
      var formSubmitURL = null;
      var unknownProps = new Array();
    
      var propEnum = newLoginData.enumerator;
      while (propEnum.hasMoreElements()) {
        var prop = propEnum.getNext().QueryInterface(Ci.nsIProperty);
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
              item.authenticationType = Ci.IMacOSKeychainItem.AuthTypeHTMLForm;
            else
              item.authenticationType = Ci.IMacOSKeychainItem.AuthTypeDefault;
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
            // not supported
            break;

          // nsILoginMetaInfo properties...
          case "guid":
            // ???
            break;

          // Fail if caller requests setting an unknown property.
          default:
            unknownProps.push(prop.name);
        }
      }
      
      if (unknownProps.length > 0) {
        throw "Unexpected propertybag items: " + unknownProps;
      }
    } else {
      throw "Unsupported parameter type provided for new login data";
    }
  },
  
  
  getAllLogins: function (count) {
    this.log("getAllLogins()");
    //return this._mozillaStorage.getAllLogins(count);
    
    var items = this._findInternetPasswordItems(null /*accountName*/,
                                                null /*protocol*/,
                                                null /*serverName*/, 
                                                null /*port*/,
                                                null /*authType*/,
                                                null /*securityDomain*/);
    
    var logins = new Array();

    for ( var i in items ) {
      logins.push(this._convertKeychainItemToLoginInfo(items[i]));
    }
    
    count.value = logins.length;
    return logins;
  },
  
  
  removeAllLogins: function () {
    this.log("removeAllLogins()");
    //return this._mozillaStorage.removeAllLogins();
    var items = this._findInternetPasswordItems(null /*accountName*/,
                                                null /*protocol*/,
                                                null /*serverName*/, 
                                                null /*port*/,
                                                null /*authType*/,
                                                null /*securityDomain*/);
    
    for ( var i in items ) {
      this.log("  Deleting " + items[i].serverName);
      items[i].delete();
    }
  },
  
  
  getAllDisabledHosts: function (count) {
    this.log("getAllDisabledHosts()");
    return this._mozillaStorage.getAllDisabledHosts(count);
  },
  
  
  getLoginSavingEnabled: function (hostname) {
    this.log("getLoginSavingEnabled[ hostname:" + hostname + " ]");
    return this._mozillaStorage.getLoginSavingEnabled(hostname);
  },
  
  
  setLoginSavingEnabled: function (hostname, enabled) {
    this.log("setLoginSavingEnabled[ hostname:" + hostname + " enabled:" + enabled + " ]");
    return this._mozillaStorage.setLoginSavingEnabled(hostname, enabled);
  },
  
  /**
   * Note: as specified in the Mozilla documentation at:
   *   https://developer.mozilla.org/en/NsILoginManagerStorage#findLogins%28%29
   *  An empty string for hostname, formSubmitURL, and httpRealm means match
   *  ALL values and a null value means match only items with NO value
   */
  findLogins: function (count, hostname, formSubmitURL, httpRealm) {
    this.log("findLogins["
             + " hostname:" + hostname
             + " formSubmitURL:" + formSubmitURL
             + " httpRealm:" + httpRealm + " ]");
    //return this._mozillaStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
    
    var items = this._findKeychainItems("" /*username*/, hostname,
                                        formSubmitURL, httpRealm);
    
    // Safari seems not to store the HTTP Realm in the securityDomain
    //  field so we try the search again without it.
    if (items.length == 0 && httpRealm != null && httpRealm != "") {
      items = this._findKeychainItems("" /*username*/, hostname,
                                      formSubmitURL, "" /*httpRealm*/);
      for (var i in items) {
        items[i].securityDomain = httpRealm;
      }
    }
      
    var logins = new Array();
    for ( var i in items ) {
      logins.push(this._convertKeychainItemToLoginInfo(items[i]));
    }
    
    count.value = logins.length;
    return logins;
  },
  
  
  countLogins: function (hostname, formSubmitURL, httpRealm) {
    this.log("countLogins["
             + " hostname:" + hostname
             + " formSubmitURL:" + formSubmitURL
             + " httpRealm:" + httpRealm + " ]");
    //return this._mozillaStorage.countLogins(hostname, formSubmitURL, httpRealm);
    
    var items = this._findKeychainItems("" /*username*/, hostname,
                                        formSubmitURL, httpRealm);
    
    // Safari seems not to store the HTTP Realm in the securityDomain
    //  field so we try the search again without it.
    if (items.length == 0 && httpRealm != null && httpRealm != "")
      items = this._findKeychainItems("" /*username*/, hostname,
                                      formSubmitURL, "" /*httpRealm*/);
    
    return items.length;
  }
};



var component = [MacOSKeychainStorage];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(component);
}