#include "MacOSKeychainService.h"
#include "MacOSKeychainItem.h"
#include "nsIGenericFactory.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychainService);
NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychainItem);

static const nsModuleComponentInfo components[] =
{
  { "Mac OS Keychain Service",
    MACOSKEYCHAINSERVICEINTERFACE_IID,
    MACOSKEYCHAINSERVICE_CONTRACTID,
    MacOSKeychainServiceConstructor },
  { "Mac OS Keychain Item",
    MACOSKEYCHAINITEMINTERFACE_IID,
    MACOSKEYCHAINITEM_CONTRACTID,
    MacOSKeychainItemConstructor },
};

NS_IMPL_NSGETMODULE(MacOSKeychainModule, components)