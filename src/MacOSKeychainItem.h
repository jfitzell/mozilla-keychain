#include "MacOSKeychainModule.h"
#include "MacOSKeychainItemInterface.h"

#import <Security/Security.h>

#include "nsStringAPI.h"

class MacOSKeychainItem : public MacOSKeychainItemInterface
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_MACOSKEYCHAINITEMINTERFACE

  MacOSKeychainItem();
  
  void InitWithRef(SecKeychainItemRef ref);
  nsresult MacOSKeychainItem::LoadData();
  nsresult MacOSKeychainItem::LoadPassword();

private:
  ~MacOSKeychainItem();

  PRBool IsStored();

  SecKeychainItemRef mKeychainItemRef;
  PRBool mDataLoaded;
  PRBool mPasswordLoaded;

  nsString mAccountName;
  nsString mPassword;
  SecProtocolType mProtocol;
  nsString mServerName;
  PRUint16 mPort;
  nsString mSecurityDomain;

protected:

};