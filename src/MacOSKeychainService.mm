#include "MacOSKeychainService.h"

#import <Foundation/Foundation.h>
#include "nsStringAPI.h"
#include "nsCOMPtr.h"
#include "nsIMutableArray.h"
#include "nsComponentManagerUtils.h"

#include "MacOSKeychainItem.h"

static nsresult
ConvertOSStatus(OSStatus result)
{
  switch (result) {
    case noErr:
      return NS_OK;
    case paramErr:
      return NS_ERROR_INVALID_ARG;
  };

  return NS_ERROR_FAILURE;
}

static SecProtocolType
ConvertStringToSecProtocol(const nsAString & protocol)
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

NS_IMPL_ISUPPORTS1(MacOSKeychainService, MacOSKeychainServiceInterface)

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
                                      const nsAString & securityDomain,
                                      const nsAString & comment,
                                      const nsAString & label,
                                      MacOSKeychainItemInterface **_retval NS_OUTPARAM)
{
  if (_retval)
    *_retval = nsnull;

  nsCAutoString accountNameUTF8		= NS_ConvertUTF16toUTF8(accountName);
  nsCAutoString passwordUTF8		= NS_ConvertUTF16toUTF8(password);
  nsCAutoString serverNameUTF8		= NS_ConvertUTF16toUTF8(serverName);
  nsCAutoString pathUTF8			= NS_ConvertUTF16toUTF8(path);
  nsCAutoString securityDomainUTF8	= NS_ConvertUTF16toUTF8(securityDomain);
  
  SecProtocolType protocolType		= ConvertStringToSecProtocol(protocol);
  SecAuthenticationType authenticationType = kSecAuthenticationTypeHTTPBasic;
  
  SecKeychainItemRef keychainItemRef;
  
  OSStatus oss = SecKeychainAddInternetPassword(NULL,
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
  
  if (! label.IsVoid()) {
    rv = item->SetLabel(label);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  //rv = item->SetComment(comment);
  //NS_ENSURE_SUCCESS(rv, rv);
  
  return NS_OK;
}

NS_IMETHODIMP
MacOSKeychainService::FindInternetPasswordItems(const nsAString & accountName,
                          const nsAString & protocol,
                          const nsAString & serverName,
                          PRUint16 port,
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
  
  if (port > 0) {
    attributes[usedAttributes].tag = kSecPortItemAttr;
    attributes[usedAttributes].data = (void*)(&port);
    attributes[usedAttributes].length = sizeof(port);
    ++usedAttributes;
  }
  
  /*if (authType) {
    attributes[usedAttributes].tag = kSecAuthenticationTypeItemAttr;
    attributes[usedAttributes].data = (void*)(&authType);
    attributes[usedAttributes].length = sizeof(authType);
    ++usedAttributes;
  }
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
  OSStatus oss = SecKeychainSearchCreateFromAttributes(NULL,
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