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

#include "public/MacOSKeychainModule.h"
#include "public/IMacOSKeychainItem.h"

#import <Security/Security.h>

#include "nsStringAPI.h"

class MacOSKeychainItem : public IMacOSKeychainItem
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMACOSKEYCHAINITEM

  MacOSKeychainItem();
  
  void InitWithRef(SecKeychainItemRef ref);
  nsresult LoadData();
  nsresult LoadPassword();

  nsresult SetDefaultLabel();

  static PRUint16 ConvertFromSecAuthenticationType(SecAuthenticationType authType);
  static SecAuthenticationType ConvertToSecAuthenticationType(PRUint16 authTypeInt);

private:
  ~MacOSKeychainItem();

  PRBool IsStored();
  nsresult SetAttribute(SecKeychainAttrType type, PRUint16 integer);
  nsresult SetAttribute(SecKeychainAttrType type, const nsAString & string);
  nsresult SetAttribute(SecKeychainAttrType type, void *value, PRUint16 length);

  SecKeychainItemRef mKeychainItemRef;
  PRBool mDataLoaded;
  PRBool mPasswordLoaded;

  nsString mAccountName;
  nsString mPassword;
  SecProtocolType mProtocol;
  nsString mServerName;
  PRUint16 mPort;
  nsString mSecurityDomain;
  nsString mLabel;
  nsString mComment;
  nsString mDescription;
  SecAuthenticationType mAuthenticationType;

protected:

};