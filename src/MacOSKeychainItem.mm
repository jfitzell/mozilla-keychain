#include "MacOSKeychainItem.h"

#import <Foundation/Foundation.h>
#include "nsStringAPI.h"

// Prior to 10.5, we can't use kSecLabelItemAttr due to a bug in Keychain
// Services (see bug 420665). The recommendation from Apple is to use the raw
// index instead of the attribute, which for password items is 7.
// Once we are 10.5+, we can just use kSecLabelItemAttr instead.
static const unsigned int kRawKeychainLabelIndex = 7;

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

NS_IMPL_ISUPPORTS1(MacOSKeychainItem, MacOSKeychainItemInterface)

MacOSKeychainItem::MacOSKeychainItem()
{
  mDataLoaded = PR_FALSE;
  mPasswordLoaded = PR_FALSE;
  mPort = 0;
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
  attrInfo.format = NULL;

  SecKeychainAttributeList *attrList;
  OSStatus result = SecKeychainItemCopyAttributesAndData(mKeychainItemRef, &attrInfo,
                                                         NULL, &attrList, NULL, NULL);
  if (result != noErr) {
    if (attrList)
      SecKeychainItemFreeAttributesAndData(attrList, NULL);
    
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
      
    }
    else if (attr.tag == kSecSecurityDomainItemAttr) {
      mSecurityDomain = NS_ConvertUTF8toUTF16((char*)attr.data, attr.length);
    }
    else if (attr.tag == kRawKeychainLabelIndex || attr.tag == kSecLabelItemAttr) {
      
    }
    else if (attr.tag == kSecPortItemAttr) {
      mPort = attr.data ? *((UInt16*)(attr.data)) : 0;
    }
    else if (attr.tag == kSecProtocolItemAttr) {
      mProtocol = attr.data ? *((SecProtocolType*)(attr.data)) : 0;
    }
    else if (attr.tag == kSecAuthenticationTypeItemAttr) {
      //mAuthenticationType = attr.data ? *((SecAuthenticationType*)(attr.data)) : 0;
    }
    else if (attr.tag == kSecCreatorItemAttr) {
      //mCreator = attr.data ? *((OSType*)(attr.data)) : 0;
    }
  }
  SecKeychainItemFreeAttributesAndData(attrList, NULL);
  mDataLoaded = PR_TRUE;
  
  return NS_OK;
}

nsresult MacOSKeychainItem::LoadPassword()
{
  if (! IsStored())
    return NS_ERROR_FAILURE;
  UInt32 passwordLength;
  char* passwordData;
  OSStatus rv = SecKeychainItemCopyAttributesAndData(mKeychainItemRef, NULL, NULL, NULL,
                                                    &passwordLength, (void**)(&passwordData));
  
  if (rv == noErr) {
    mPassword.Assign(NS_ConvertUTF8toUTF16(passwordData, passwordLength));
    SecKeychainItemFreeAttributesAndData(NULL, (void*)passwordData);
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

/**
 *  MacOSKeychainItemInterface implementation
 *
 */

/* attribute AString accountName; */
NS_IMETHODIMP MacOSKeychainItem::GetAccountName(nsAString & accountName)
{
  //accountName.Assign(NS_ConvertUTF8toUTF16(mAccountName));
  if ( IsStored() && ! mDataLoaded )
    LoadData();
  
  accountName = mAccountName;
  
  return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetAccountName(const nsAString & accountName)
{
  mAccountName = accountName;
  
  return NS_OK;
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
  mPassword = password;
  
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
  mServerName = serverName;
  
  return NS_OK;
}

/* attribute short port; */
NS_IMETHODIMP MacOSKeychainItem::GetPort(PRInt16 *aPort)
{
    *aPort = mPort;
    
    return NS_OK;
}
NS_IMETHODIMP MacOSKeychainItem::SetPort(PRInt16 aPort)
{
    mPort = aPort;
    
    return NS_OK;
}


/* attribute AString comment; */
NS_IMETHODIMP MacOSKeychainItem::GetComment(nsAString & aComment)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}
NS_IMETHODIMP MacOSKeychainItem::SetComment(const nsAString & aComment)
{
    return NS_ERROR_NOT_IMPLEMENTED;
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
  mSecurityDomain = securityDomain;
  
  return NS_OK;
}

/* attribute AString label; */
NS_IMETHODIMP MacOSKeychainItem::GetLabel(nsAString & aLabel)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}
NS_IMETHODIMP MacOSKeychainItem::SetLabel(const nsAString & aLabel)
{
    return NS_ERROR_NOT_IMPLEMENTED;
}

/* void delete (); */
NS_IMETHODIMP MacOSKeychainItem::Delete()
{
  if (! IsStored())
    return NS_ERROR_FAILURE;
  
  return ConvertOSStatus(SecKeychainItemDelete(mKeychainItemRef));
}