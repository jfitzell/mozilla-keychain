const Cc = Components.classes;
const Ci = Components.interfaces;

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
  _mozillaStorage : null, // An instance of the mozilla storage component
  
  __logService : null,
  get _logService() {
    if (!this.__logService)
      this.__logService = Cc["@mozilla.org/consoleservice;1"].
                            getService(Ci.nsIConsoleService);
    return this.__logService;
  },
  
  
  _initMozillaStorage: function () {
    this._mozillaStorage = Cc["@mozilla.org/login-manager/storage/mozStorage;1"].
                            createInstance(Ci.nsILoginManagerStorage);
     
    try {
      this._mozillaStorage.init();
    } catch (e) {
      this.log("Initialization of mozilla login storage component failed: " + e);
      this._mozillaStorage = null;
      throw e;
    }
  },
  
  _convertKeychainItemToLoginInfo: function (item) {
    var info = new this._nsLoginInfo();
    
    info.init(item.serverName,
              "", "",
              item.accountName, item.password,
              "", "");
    
    return info;
  },
  
  _uri : function (uriString) {
    var ios = Components.classes["@mozilla.org/network/io-service;1"].
                                getService(Components.interfaces.nsIIOService);
    return ios.newURI(uriString, null, null);
  },
  
  log: function (message) {
    if (!this._debug)
      return;
      
    dump("MacOSKeychainStorage: " + message + "\n");
    this._logService.logStringMessage("MacOSKeychainStorage: " + message);
  },
  
  init: function () {
    this.log("Initializing");
    
    // Connect to the correct preferences branch.
    this._prefBranch = Cc["@mozilla.org/preferences-service;1"].
                         getService(Ci.nsIPrefService);
    this._prefBranch = this._prefBranch.getBranch("signon.");
    this._prefBranch.QueryInterface(Ci.nsIPrefBranch2);

    this._debug = this._prefBranch.getBoolPref("debug");
    
    // Get constructor for nsILoginInfo
    this._nsLoginInfo = new Components.Constructor(
        "@mozilla.org/login-manager/loginInfo;1", Ci.nsILoginInfo);
    
    this._initMozillaStorage();
    
    this._keychainService = Cc["@fitzell.ca/macos-keychain/keychainService;1"].
                              getService(Ci.MacOSKeychainServiceInterface);
    
    //this._keychainService.addKeychainItem("localhost", "/my/path", "jf", "foo", 'https', 8080, "none", "sec domain", "label");
  },
  
  initWithFile: function (aInputFile, aOutputFile) {
    this.log("Initializing with input: " + aInputFile + " output: " + aOutputFile);
    this.init();
  },
  
  addLogin: function (login) {
    this.log("Adding login: " + login);
    //return this._mozillaStorage.addLogin(login);
    var uri = this._uri(login.hostname);
    var port = uri.port;
    if (port == -1) // -1 indicates default port for the protocol
      port = null;
    
    var label = uri.host + " (" + login.username + ")";
    var item = this._keychainService.addInternetPasswordItem(login.username, login.password,
                                 uri.scheme, uri.host, port, "",
                                 login.httpRealm, "comment", label);
  },
  
  removeLogin: function (login) {
    this.log("Removing login: " + login);
    return this._mozillaStorage.removeLogin(login);
  },
  
  modifyLogin: function (oldLogin, newLogin) {
    this.log("Modifying oldLogin: " + oldLogin + " newLogin: " + newLogin);
    return this._mozillaStorage.modifyLogin(oldLogin, newLogin);
  },
  
  getAllLogins: function (count) {
    this.log("Getting all logins");
    //return this._mozillaStorage.getAllLogins(count);
    
    // TODO: This is only an approximation because findLogins will never return both form and
    //   basic auth logins at the same time.
    return this.findLogins(count, null, null, null);
  },
  
  removeAllLogins: function () {
    this.log("Removing all logins");
    return this._mozillaStorage.removeAllLogins();
  },
  
  getAllDisabledHosts: function (count) {
    this.log("Getting all disabled hosts");
    return this._mozillaStorage.getAllDisabledHosts(count);
  },
  
  getLoginSavingEnabled: function (hostname) {
    this.log("Checking whether logins can be saved for: " + hostname);
    return this._mozillaStorage.getLoginSavingEnabled(hostname);
  },
  
  setLoginSavingEnabled: function (hostname, enabled) {
    this.log("Setting login saving for: " + hostname + " to: " + enabled);
    return this._mozillaStorage.setLoginSavingEnabled(hostname, enabled);
  },
  
  findLogins: function (count, hostname, formSubmitURL, httpRealm) {
    this.log("Finding logins [" + hostname + "," + formSubmitURL + "," + httpRealm + "]");
    //return this._mozillaStorage.findLogins(count, hostname, formSubmitURL, httpRealm);
    
    var scheme = null;
    var host = null;
    var port = null;
    if (hostname) {
      var uri = this._uri(hostname);
      scheme = uri.scheme;
      host = uri.host;
      port = uri.port;
      if (port == -1)
        port = null;
    }

this.log(scheme + ", " + host + ", " + port + ", " + httpRealm);
    var items = this._keychainService.findInternetPasswordItems(null, scheme, host, port, httpRealm);
    var enumerator = items.enumerate();
    var logins = new Array();
    while ( enumerator.hasMoreElements() ) {
      var item = enumerator.getNext().QueryInterface(Ci.MacOSKeychainItemInterface);
      logins.push(this._convertKeychainItemToLoginInfo(item));
      this.log("domain: " + item.securityDomain);
    }
    
    count.value = logins.length;
    return logins;
  },
  
  countLogins: function MOSK_countLogins(hostname, formSubmitURL, httpRealm) {
    this.log("Counting logins [" + hostname + "," + formSubmitURL + "," + httpRealm + "]");
    //return this._mozillaStorage.countLogins(hostname, formSubmitURL, httpRealm);
    
    var count = {};
    this.findLogins(count, hostname, formSubmitURL, httpRealm);
    return count.value;
  }
};

var component = [MacOSKeychainStorage];
function NSGetModule(compMgr, fileSpec) {
    return XPCOMUtils.generateModule(component);
}