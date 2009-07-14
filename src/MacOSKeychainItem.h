#include "MacOSKeychainModule.h"
#include "IMacOSKeychainItem.h"

#import <Security/Security.h>

#include "nsStringAPI.h"

class MacOSKeychainItem : public IMacOSKeychainItem
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMACOSKEYCHAINITEM

  MacOSKeychainItem();
  
  void InitWithRef(SecKeychainItemRef ref);
  nsresult MacOSKeychainItem::LoadData();
  nsresult MacOSKeychainItem::LoadPassword();

  nsresult MacOSKeychainItem::SetDefaultLabel();


private:
  ~MacOSKeychainItem();

  PRBool IsStored();
  nsresult MacOSKeychainItem::SetAttribute(SecKeychainAttrType type, PRUint16 integer);
  nsresult MacOSKeychainItem::SetAttribute(SecKeychainAttrType type, const nsAString & string);
  nsresult MacOSKeychainItem::SetAttribute(SecKeychainAttrType type, void *value, PRUint16 length);

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

protected:

};