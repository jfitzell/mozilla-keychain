#ifndef __MacOSKeychain_h
#define __MacOSKeychain_h

#include <Security/Security.h>
#include <CoreServices/CoreServices.h>
#include <Foundation/Foundation.h>

#define PROTYPES_H // hack so we don't get typedef conflicts

#include "xpcom-config.h"
#include "nsILoginManagerStorage.h"
//#include "nsStringAPI.h"

#define MACOSKEYCHAIN_CID \
{ 0x87d15ebf, 0x2a51, 0x4e54, { 0x92, 0x90, 0x31, 0x5a, 0x54, 0xfe, 0xea, 0x25}}

static const char kMacOSKeychainContractID[] = "@mozilla.org/macos-keychain;1";

class MacOSKeychain : public nsILoginManagerStorage
{
public:
  MacOSKeychain();
  ~MacOSKeychain();
  NS_DECL_ISUPPORTS
  NS_DECL_NSILOGINMANAGERSTORAGE

protected:
  NSArray* FetchLogins(const nsAString & aHostname,
                       const nsAString & aActionURL,
                       const nsAString & aHttpRealm);

};

#endif /* __MacOSKeychain_h */

