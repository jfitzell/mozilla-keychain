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

const Cc = Components.classes;
const Ci = Components.interfaces;

const ContractID_IOService = '@mozilla.org/network/io-service;1';
const ContractID_StandardURL = '@mozilla.org/network/standard-url;1';
const ContractID_URLParser = '@mozilla.org/network/url-parser;1?auth=maybe';
const ContractID_SimpleURL = '@mozilla.org/network/simple-uri;1';

/** @module URL */

const EXPORTED_SYMBOLS = ['URL'];

var URL = {};

/**
 * Parse the URL in the given string and return an object with the parsed data
 */
URL.parse = function(urlString) {
	var url = {
		spec: urlString
	};

	function setAttribute(attribute, str, position, length) {
		url[attribute] = (length <= 0) ? null :
			str.substr(position, length);
	}

	var parser = Cc[ContractID_URLParser].getService(Ci.nsIURLParser);
	var uriData = [urlString, urlString.length, {}, {}, {}, {}, {}, {}];
	parser.parseURL.apply(parser, uriData);
	let [{ value: schemePos }, { value: schemeLen },
		{ value: authorityPos }, { value: authorityLen },
		{ value: pathPos }, { value: pathLen }] = uriData.slice(2);

	setAttribute('scheme', url.spec, schemePos, schemeLen);
	setAttribute('authority', url.spec, authorityPos, authorityLen);
	setAttribute('path', url.spec, pathPos, pathLen);
	url.prePath = url.slice(0, url.spec.length - pathLen);

	if (null === url.authority) {
	   url.username = url.password = url.hostname = url.port = null;
	} else {
		var authorityData = [url.authority, url.authority.length,
								{}, {}, {}, {}, {}, {}, {}];
		parser.parseAuthority.apply(parser, authorityData);
		let [{ value: usernamePos }, { value: usernameLen },
			{ value: passwordPos }, { value: passwordLen },
			{ value: hostnamePos }, { value: hostnameLen },
			{ value: port}] = authorityData.slice(2);

		setAttribute('username', url.authority, usernamePos, usernameLen);
		setAttribute('password', url.authority, passwordPos, passwordLen);
		setAttribute('hostname', url.authority, hostnamePos, hostnameLen);
		url.port = port == -1 ? null : port;
	}

	return url;
};

URL.newURL = function(urlString, base) {
	var baseURI;

	if (base instanceof Ci.nsIURI)
		baseURI = base;
	else if (base === undefined)
		baseURI = null;
	else
		baseURI = URL.newURL(base);

	var url = Cc[ContractID_StandardURL].createInstance(Ci.nsIStandardURL);
	url.init(url.URLTYPE_STANDARD, null, urlString, null, baseURI);
	url.QueryInterface(Ci.nsIURL);

	return url;
};

URL.newURI = function(uriString) {
    var uri = Cc[ContractID_SimpleURL].createInstance(Ci.nsIURI);
    uri.spec = uriString;
    return uri;
};

