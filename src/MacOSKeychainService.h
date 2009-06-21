#include "MacOSKeychainModule.h"
#include "MacOSKeychainServiceInterface.h"

class MacOSKeychainService : public MacOSKeychainServiceInterface
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_MACOSKEYCHAINSERVICEINTERFACE

  MacOSKeychainService();

private:
  ~MacOSKeychainService();

protected:
  /* additional members */
};