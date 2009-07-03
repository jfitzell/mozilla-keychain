#include "MacOSKeychainService.h"
#include "MacOSKeychainItem.h"
#include "nsIGenericFactory.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychainService);
NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychainItem);

static const nsModuleComponentInfo components[] =
{
  { "Mac OS Keychain Service",
    IMACOSKEYCHAINSERVICE_IID,
    MACOSKEYCHAINSERVICE_CONTRACTID,
    MacOSKeychainServiceConstructor },
  { "Mac OS Keychain Item",
    IMACOSKEYCHAINITEM_IID,
    MACOSKEYCHAINITEM_CONTRACTID,
    MacOSKeychainItemConstructor },
};

NS_IMPL_NSGETMODULE(MacOSKeychainModule, components)