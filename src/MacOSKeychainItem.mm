#include "MacOSKeychainItem.h"

#import <Foundation/Foundation.h>
#include "nsStringAPI.h"

#include "MacOSKeychainUtils.h"

// Prior to 10.5, we can't use kSecLabelItemAttr due to a bug in Keychain
// Services (see bug 420665). The recommendation from Apple is to use the raw
// index instead of the attribute, which for password items is 7.
// Once we are 10.5+, we can just use kSecLabelItemAttr instead.
static const unsigned int kRawKeychainLabelIndex = 7;

NS_IMPL_ISUPPORTS1(MacOSKeychainItem, IMacOSKeychainItem)

PRUint16
MacOSKeychainItem::ConvertFromSecAuthenticationType(SecAuthenticationType authType)
{
  switch (authType) {
    case nsnull:
      return nsnull;
    case kSecAuthenticationTypeHTMLForm:
      return IMacOSKeychainItem::AuthTypeHTMLForm;
    case kSecAuthenticationTypeHTTPBasic:
      return IMacOSKeychainItem::AuthTypeHTTPBasic;
    case kSecAuthenticationTypeDefault:
    default:
      return IMacOSKeychainItem::AuthTypeDefault;
  }
}

SecAuthenticationType
MacOSKeychainItem::ConvertToSecAuthenticationType(PRUint16 authTypeInt)
{
  switch (authTypeInt) {
    case nsnull:
      return nsnull;
    case IMacOSKeychainItem::AuthTypeHTMLForm:
      return kSecAuthenticationTypeHTMLForm;
    case IMacOSKeychainItem::AuthTypeHTTPBasic:
      return kSecAuthenticationTypeHTTPBasic;
    case IMacOSKeychainItem::AuthTypeDefault:
    default:
      return kSecAuthenticationTypeDefault;
  }
}

MacOSKeychainItem::MacOSKeychainItem()
{
  mDataLoaded = PR_FALSE;
  mPasswordLoaded = PR_FALSE;
  mPort = 0;
  mAuthenticationType = kSecAuthenticationTypeDefault;
}

MacOSKeychainItem::~MacOSKeychainItem()
{
  if (mKeychainItemRef)
    CFRelease(mKeychainItemRef);
}

PRBool MacOSKeychainItem::IsStored()
{
  if (mKeychainItemRef)
    return PR_TRUE;
  else
    return PR_FALSE;
}

void MacOSKeychainItem::InitWithRef(SecKeychainItemRef ref)
{
  mKeychainItemRef = ref;
  mDataLoaded = PR_FALSE;
  mPasswordLoaded = PR_FALSE;
}

nsresult MacOSKeychainItem::LoadData()
{
  if (! IsStored())
    return NS_ERROR_FAILURE;
    
  SecKeychainAttributeInfo attrInfo;
  UInt32 tags[9];
  tags[0] = kSecAccountItemAttr;
  tags[1] = kSecServerItemAttr;
  tags[2] = kSecPortItemAttr;
  tags[3] = kSecProtocolItemAttr;
  tags[4] = kSecAuthenticationTypeItemAttr;
  tags[5] = kSecSecurityDomainItemAttr;
  tags[6] = kSecCreatorItemAttr;
  tags[7] = kSecCommentItemAttr;
  tags[8] = kRawKeychainLabelIndex;
  attrInfo.count = sizeof(tags)/sizeof(UInt32);
  attrInfo.tag = tags;
  attrInfo.format = nsnull;

  SecKeychainAttributeList *attrList;
  OSStatus result = SecKeychainItemCopyAttributesAndData(mKeychainItemRef, &attrInfo,
                                                         nsnull, &attrList, nsnull, nsnull);
  if (result != noErr) {
    if (attrList)
      SecKeychainItemFreeAttributesAndData(attrList, nsnull);
    
    return ConvertOSStatus(result);
  }
  
  unsigned int i;
  for (i = 0; i < attrList->count; i++) {
    SecKeychainAttribute attr = attrList->attr[i];
    if (attr.tag == kSecAccountItemAttr) {
      mAccountName = NS_ConvertUTF8toUTF16((char*)attr.data, attr.length);
    }
    else if (attr.tag == kSecServerItemAttr) {
      mServerName = NS_ConvertUTF8toUTF16((char*)attr.data, attr.length);
    }
    else if (attr.tag == kSecCommentItemAttr) {
      mComment = NS_ConvertUTF8toUTF16((char*)attr.data, attr.length);
    }
    else if (attr.tag == kSecSecurityDomainItemAttr) {
      mSecurityDomain = NS_ConvertUTF8toUTF16((char*)attr.data, attr.length);
    }
    else if (attr.tag == kRawKeychainLabelIndex || attr.tag == kSecLabelItemAttr) {
      mLabel = NS_ConvertUTF8toUTF16((char*)attr.data, attr.length);
    }
    else if (attr.tag == kSecPortItemAttr) {
      mPort = attr.data ? *((UInt16*)(attr.data)) : 0;
    }
    else if (attr.tag == kSecProtocolItemAttr) {
      mProtocol = attr.data ? *((SecProtocolType*)(attr.data)) : 0;
    }
    else if (attr.tag == kSecAuthenticationTypeItemAttr) {
      mAuthenticationType = attr.data ? *((SecAuthenticationType*)(attr.data)) : 0;
    }
    else if (attr.tag == kSecCreatorItemAttr) {
      //mCreator = attr.data ? *((OSType*)(attr.data)) : 0;
    }
  }
  SecKeychainItemFreeAttributesAndData(attrList, nsnull);
  mDataLoaded = PR_TRUE;
  
  return NS_OK;
}

nsresult MacOSKeychainItem::LoadPassword()
{
  if (! IsStored())
    return NS_ERROR_FAILURE;
  UInt32 passwordLength;
  char* passwordData;
  OSStatus rv = SecKeychainItemCopyAttributesAndData(mKeychainItemRef, nsnull, nsnull, nsnull,
                                                    &passwordLength, (void**)(&passwordData));
  
  if (rv == noErr) {
    mPassword.Assign(NS_ConvertUTF8toUTF16(passwordData, passwordLength));
    SecKeychainItemFreeAttributesAndData(nsnull, (void*)passwordData);
  }
  else {
    // Being denied access isn't a failure case, so don't log it.
    if (rv != errSecAuthFailed)
      NSLog(@"Couldn't load keychain data (error %d)", rv);
  }
  // Mark it as loaded either way, so that we can return nil password as an
  // indicator that the item is inaccessible.
  mPasswordLoaded = PR_TRUE;
  
  return NS_OK;
}

nsresult MacOSKeychainItem::SetAttribute(SecKeychainAttrType type, PRUint16 integer)
{
  return SetAttribute(type, (void*)&integer, sizeof(PRUint16));
}

nsresult MacOSKeychainItem::SetAttribute(SecKeychainAttrType type, const nsAString & string)
{
  nsCAutoString stringUTF8 = NS_ConvertUTF16toUTF8(string);
  char *stringData;
  NS_CStringGetMutableData(stringUTF8, PR_UINT32_MAX, &stringData);
  return SetAttribute(type, (void*)stringData, stringUTF8.Length());
}

nsresult MacOSKeychainItem::SetAttribute(SecKeychainAttrType type, void *value, PRUint16 length)
{
  if (! IsStored())
    return NS_ERROR_FAILURE;
  
  SecKeychainAttribute attribute;
  attribute.tag = type;
  attribute.data = value;
  attribute.length = length;
  SecKeychainAttributeList attributeList;
  attributeList.count = 1;
  attributeList.attr = &attribute;
  OSStatus oss = SecKeychainItemModifyAttributesAndData(mKeychainItemRef,
                                                        &attributeList, 0, nsnull);
  return ConvertOSStatus(oss);
}

nsresult MacOSKeychainItem::SetDefaultLabel()
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
    
  nsAutoString label;
  label.Append(mServerName);
  label.Append(NS_LITERAL_STRING(" ("));
  label.Append(mAccountName);
  label.Append(NS_LITERAL_STRING(")"));
  
  return SetLabel(label);
}

/**
 *  MacOSKeychainItemInterface implementation
 *
 */

/* attribute AString accountName; */
NS_IMETHODIMP MacOSKeychainItem::GetAccountName(nsAString & accountName)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  accountName = mAccountName;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetAccountName(const nsAString & accountName)
{
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecAccountItemAttr, accountName);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mAccountName = accountName;
  
  return SetDefaultLabel();
}

/* attribute AString password; */
NS_IMETHODIMP MacOSKeychainItem::GetPassword(nsAString & password)
{
  if ( IsStored() && ! mPasswordLoaded )
    LoadPassword();
  
  password = mPassword;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetPassword(const nsAString & password)
{
  if (IsStored()) {
    nsCAutoString passwordUTF8 = NS_ConvertUTF16toUTF8(password);
    const char* passwordData = passwordUTF8.get();
    nsresult rv = SecKeychainItemModifyAttributesAndData(mKeychainItemRef,
                                                      nsnull,
                                                      passwordUTF8.Length(),
                                                      passwordData);
    NS_ENSURE_SUCCESS(rv, rv);
  }

  mPassword = password;
  
  return NS_OK;
}

/* attribute AString protocol; */
NS_IMETHODIMP MacOSKeychainItem::GetProtocol(nsAString & protocol)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  protocol = ConvertSecProtocolToString(mProtocol);
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetProtocol(const nsAString & protocol)
{
  SecProtocolType protocolType = ConvertStringToSecProtocol(protocol);
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecProtocolItemAttr, (void*)&protocolType, sizeof(SecProtocolType));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mProtocol = protocolType;
  
  return NS_OK;
}

/* attribute AString serverName; */
NS_IMETHODIMP MacOSKeychainItem::GetServerName(nsAString & serverName)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  serverName = mServerName;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetServerName(const nsAString & serverName)
{
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecServerItemAttr, serverName);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mServerName = serverName;
  
  return SetDefaultLabel();
}

/* attribute short port; */
NS_IMETHODIMP MacOSKeychainItem::GetPort(PRUint16 *port)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
    
  *port = mPort;
    
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetPort(PRUint16 port)
{
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecPortItemAttr, port);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mPort = port;
    
  return NS_OK;
}

/* attribute AString comment; */
NS_IMETHODIMP MacOSKeychainItem::GetComment(nsAString & comment)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  comment = mComment;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetComment(const nsAString & comment)
{
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecCommentItemAttr, comment);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mComment = comment;
  
  return NS_OK;
}

/* attribute AString securityDomain; */
NS_IMETHODIMP MacOSKeychainItem::GetSecurityDomain(nsAString & securityDomain)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  securityDomain = mSecurityDomain;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetSecurityDomain(const nsAString & securityDomain)
{
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecSecurityDomainItemAttr, securityDomain);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mSecurityDomain = securityDomain;
  
  return NS_OK;
}

/* attribute AString label; */
NS_IMETHODIMP MacOSKeychainItem::GetLabel(nsAString & label)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  label = mLabel;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetLabel(const nsAString & label)
{
  if (IsStored()) {
    nsresult rv = SetAttribute(kRawKeychainLabelIndex, label);
    NS_ENSURE_SUCCESS(rv, rv);
  }
  
  mLabel = label;
  
  return NS_OK;
}

/* attribute unsigned short authenticationType; */
NS_IMETHODIMP MacOSKeychainItem::GetAuthenticationType(PRUint16 *authenticationType)
{
  if ( IsStored() && ! mDataLoaded )
    LoadData();
    
  *authenticationType = MacOSKeychainItem::ConvertFromSecAuthenticationType(mAuthenticationType);
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetAuthenticationType(PRUint16 authenticationType)
{
  SecAuthenticationType type = MacOSKeychainItem::ConvertToSecAuthenticationType(authenticationType);
  if (IsStored()) {
    nsresult rv = SetAttribute(kSecAuthenticationTypeItemAttr,
                               (void*)&type,
                               sizeof(SecAuthenticationType));
    NS_ENSURE_SUCCESS(rv, rv);
  }
  mAuthenticationType = type;
  
  return NS_OK;
}


/* void delete (); */
NS_IMETHODIMP MacOSKeychainItem::Delete()
{
  if (! IsStored())
    return NS_ERROR_FAILURE;
  
  return ConvertOSStatus(SecKeychainItemDelete(mKeychainItemRef));
}