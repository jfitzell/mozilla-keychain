#include "MacOSKeychainModule.h"
#include "IMacOSKeychainService.h"

class MacOSKeychainService : public IMacOSKeychainService
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_IMACOSKEYCHAINSERVICE

  MacOSKeychainService();

private:
  ~MacOSKeychainService();

protected:
  /* additional members */
};