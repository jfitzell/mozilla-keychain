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
  SecAuthenticationType mAuthenticationType;

protected:

};