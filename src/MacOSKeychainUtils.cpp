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
 
#include "MacOSKeychainUtils.h"

nsresult ConvertOSStatus(OSStatus result)
{
  switch (result) {
    case noErr:
      return NS_OK;
    case paramErr:
      return NS_ERROR_INVALID_ARG;
  };

  return NS_ERROR_FAILURE;
}

SecProtocolType ConvertStringToSecProtocol(const nsAString & protocol)
{
  if (protocol.EqualsLiteral("http"))
    return kSecProtocolTypeHTTP;
  else if (protocol.EqualsLiteral("ftp"))
    return kSecProtocolTypeFTP;
  else if (protocol.EqualsLiteral("irc"))
    return kSecProtocolTypeIRC;
  else if (protocol.EqualsLiteral("pop3"))
    return kSecProtocolTypePOP3;
  else if (protocol.EqualsLiteral("smtp"))
    return kSecProtocolTypeSMTP;
  else if (protocol.EqualsLiteral("imap"))
    return kSecProtocolTypeIMAP;
  else if (protocol.EqualsLiteral("ftps"))
    return kSecProtocolTypeFTPS;
  else if (protocol.EqualsLiteral("https"))
    return kSecProtocolTypeHTTPS;
  else if (protocol.EqualsLiteral("imaps"))
    return kSecProtocolTypeIMAPS;
  else if (protocol.EqualsLiteral("ircs"))
    return kSecProtocolTypeIRCS;
  else if (protocol.EqualsLiteral("pop3s"))
    return kSecProtocolTypePOP3S;

  return kSecProtocolTypeHTTP;
}

const nsString ConvertSecProtocolToString(SecProtocolType protocol)
{
  switch (protocol) {
    case kSecProtocolTypeHTTP:
      return NS_LITERAL_STRING("http");
    case kSecProtocolTypeFTP:
      return NS_LITERAL_STRING("ftp");
    case kSecProtocolTypeIRC:
      return NS_LITERAL_STRING("irc");
    case kSecProtocolTypePOP3:
      return NS_LITERAL_STRING("pop3");
    case kSecProtocolTypeSMTP:
      return NS_LITERAL_STRING("smtp");
    case kSecProtocolTypeIMAP:
      return NS_LITERAL_STRING("imap");
    case kSecProtocolTypeFTPS:
      return NS_LITERAL_STRING("ftps");
    case kSecProtocolTypeHTTPS:
      return NS_LITERAL_STRING("https");
    case kSecProtocolTypeIMAPS:
      return NS_LITERAL_STRING("imaps");
    case kSecProtocolTypeIRCS:
      return NS_LITERAL_STRING("ircs");
    case kSecProtocolTypePOP3S:
      return NS_LITERAL_STRING("pop3s");
    
    default:
      return NS_LITERAL_STRING("http");
  }
}