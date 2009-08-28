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
 
#include "MacOSKeychainService.h"

#import <Foundation/Foundation.h>
#include "nsStringAPI.h"
#include "nsCOMPtr.h"
#include "nsIMutableArray.h"
#include "nsComponentManagerUtils.h"

#include "MacOSKeychainUtils.h"
#include "MacOSKeychainItem.h"

NS_IMPL_ISUPPORTS1(MacOSKeychainService, IMacOSKeychainService)

MacOSKeychainService::MacOSKeychainService()
{
  /* member initializers and constructor code */
}

MacOSKeychainService::~MacOSKeychainService()
{
  /* destructor code */
}

NS_IMETHODIMP
MacOSKeychainService::AddInternetPasswordItem(const nsAString & accountName,
                                      const nsAString & password,
                                      const nsAString & protocol,
                                      const nsAString & serverName,
                                      PRUint16 port,
                                      const nsAString & path,
                                      const unsigned short authTypeEnum,
                                      const nsAString & securityDomain,
                                      const nsAString & comment,
                                      const nsAString & label,
                                      IMacOSKeychainItem **_retval NS_OUTPARAM)
{
  if (_retval)
    *_retval = nsnull;

  nsCAutoString accountNameUTF8		= NS_ConvertUTF16toUTF8(accountName);
  nsCAutoString passwordUTF8		= NS_ConvertUTF16toUTF8(password);
  nsCAutoString serverNameUTF8		= NS_ConvertUTF16toUTF8(serverName);
  nsCAutoString pathUTF8			= NS_ConvertUTF16toUTF8(path);
  nsCAutoString securityDomainUTF8	= NS_ConvertUTF16toUTF8(securityDomain);
  
  SecProtocolType protocolType		= ConvertStringToSecProtocol(protocol);
  SecAuthenticationType authenticationType =
      MacOSKeychainItem::ConvertToSecAuthenticationType(authTypeEnum);
  
  SecKeychainItemRef keychainItemRef;
  
  OSStatus oss = SecKeychainAddInternetPassword(nsnull,
                         serverNameUTF8.Length(), serverNameUTF8.get(),
                         securityDomainUTF8.Length(), securityDomainUTF8.get(),
                         accountNameUTF8.Length(), accountNameUTF8.get(),
                         pathUTF8.Length(), pathUTF8.get(),
                         port, protocolType, authenticationType,
                         passwordUTF8.Length(), passwordUTF8.get(),
                         &keychainItemRef);
  
  nsresult rv = ConvertOSStatus(oss);
  NS_ENSURE_SUCCESS(rv, rv);
  
  nsCOMPtr<MacOSKeychainItem> item = do_CreateInstance(MACOSKEYCHAINITEM_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);
  item->InitWithRef(keychainItemRef);
  NS_ENSURE_SUCCESS(rv, rv);
  
  if (_retval) {
    NS_ADDREF(item);
    *_retval = item;
  }
  
  if (label.IsVoid()) {
    rv = item->SetDefaultLabel();
  } else {
    rv = item->SetLabel(label);
  }
  NS_ENSURE_SUCCESS(rv, rv);
  
  rv = item->SetComment(comment);
  NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}

NS_IMETHODIMP
MacOSKeychainService::FindInternetPasswordItems(const nsAString & accountName,
                          const nsAString & protocol,
                          const nsAString & serverName,
                          PRUint16 port,
                          const unsigned short authTypeEnum,
                          const nsAString & securityDomain,
                          nsIArray **_retval NS_OUTPARAM)
{
  if (! _retval) 
    return NS_ERROR_NULL_POINTER;

  *_retval = nsnull;
  nsresult rv;

  nsCOMPtr<nsIMutableArray> results = do_CreateInstance(NS_ARRAY_CONTRACTID, &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  SecKeychainAttribute attributes[5];
  unsigned int usedAttributes = 0;

  nsCAutoString accountNameUTF8;
  char *accountNameData;
  if (! accountName.IsVoid()) {
    accountNameUTF8 = NS_ConvertUTF16toUTF8(accountName);
    NS_CStringGetMutableData(accountNameUTF8, PR_UINT32_MAX, &accountNameData);
    attributes[usedAttributes].tag = kSecAccountItemAttr;
    attributes[usedAttributes].data = (void*)accountNameData;
    attributes[usedAttributes].length = accountNameUTF8.Length();
    ++usedAttributes;
  }
  
  SecProtocolType protocolType;
  if (! protocol.IsVoid()) {
    protocolType = ConvertStringToSecProtocol(protocol);
    attributes[usedAttributes].tag = kSecProtocolItemAttr;
    attributes[usedAttributes].data = (void*)(&protocolType);
    attributes[usedAttributes].length = sizeof(protocolType);
    ++usedAttributes;
  }

  nsCAutoString serverNameUTF8;
  char *serverNameData;
  if (! serverName.IsVoid()) {
    serverNameUTF8 = NS_ConvertUTF16toUTF8(serverName);
    NS_CStringGetMutableData(serverNameUTF8, PR_UINT32_MAX, &serverNameData);
    attributes[usedAttributes].tag = kSecServerItemAttr;
    attributes[usedAttributes].data = (void*)serverNameData;
    attributes[usedAttributes].length = serverNameUTF8.Length();
    ++usedAttributes;
  }
  
  nsCAutoString securityDomainUTF8;
  char *securityDomainData;
  if (! securityDomain.IsVoid()) {
    securityDomainUTF8 = NS_ConvertUTF16toUTF8(securityDomain);
    NS_CStringGetMutableData(securityDomainUTF8, PR_UINT32_MAX, &securityDomainData);
    attributes[usedAttributes].tag = kSecSecurityDomainItemAttr;
    attributes[usedAttributes].data = (void*)securityDomainData;
    attributes[usedAttributes].length = securityDomainUTF8.Length();
    ++usedAttributes;
  }
  
  if (nsnull != port) {
    attributes[usedAttributes].tag = kSecPortItemAttr;
    attributes[usedAttributes].data = (void*)(&port);
    attributes[usedAttributes].length = sizeof(port);
    ++usedAttributes;
  }
  
  SecAuthenticationType authenticationType;
  if (nsnull != authTypeEnum) {
    authenticationType = MacOSKeychainItem::ConvertToSecAuthenticationType(authTypeEnum);
    attributes[usedAttributes].tag = kSecAuthenticationTypeItemAttr;
    attributes[usedAttributes].data = (void*)(&authenticationType);
    attributes[usedAttributes].length = sizeof(authenticationType);
    ++usedAttributes;
  }
  /*
  if (creator) {
    attributes[usedAttributes].tag = kSecCreatorItemAttr;
    attributes[usedAttributes].data = (void*)(&creator);
    attributes[usedAttributes].length = sizeof(creator);
    ++usedAttributes;
  }*/

  SecKeychainAttributeList searchCriteria;
  searchCriteria.count = usedAttributes;
  searchCriteria.attr = attributes;

  SecKeychainSearchRef searchRef;
  OSStatus oss = SecKeychainSearchCreateFromAttributes(nsnull,
                                                          kSecInternetPasswordItemClass,
                                                          &searchCriteria,
                                                          &searchRef);
  if (oss != noErr) {
    NSLog(@"Keychain search for host '%@' failed (error %d)", serverNameUTF8.get(), oss);
    return ConvertOSStatus(oss);
  }

  SecKeychainItemRef keychainItemRef;
  while ((SecKeychainSearchCopyNext(searchRef, &keychainItemRef)) == noErr) {
    nsCOMPtr<MacOSKeychainItem> item = do_CreateInstance(MACOSKEYCHAINITEM_CONTRACTID, &rv);
    NS_ENSURE_SUCCESS(rv, rv);
  
    item->InitWithRef(keychainItemRef);
    rv = results->AppendElement(item, false);
    NS_ENSURE_SUCCESS(rv, rv);
    NS_ADDREF(item);
  }
  CFRelease(searchRef);
  
  *_retval = results;
  NS_ADDREF(*_retval);
  
  return NS_OK;
}