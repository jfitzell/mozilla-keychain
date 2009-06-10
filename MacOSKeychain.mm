#include "MacOSKeychain.h"
#include "nsILoginInfo.h"
#include "nsIGenericFactory.h"
#include "nsMemory.h"
#include "nsICategoryManager.h"
#include "nsCOMPtr.h"
//#include "nsNetUtil.h"
//#include "nsCOMArray.h"
#include "nsServiceManagerUtils.h"

NS_IMPL_ISUPPORTS1(MacOSKeychain, nsILoginManagerStorage)

MacOSKeychain::MacOSKeychain() {}

MacOSKeychain::~MacOSKeychain() {}

NS_IMETHODIMP
MacOSKeychain::Init()
{
  return NS_OK;
}

NS_IMETHODIMP
MacOSKeychain::InitWithFile(nsIFile *aInputFile,
                            nsIFile *aOutputFile)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}


NS_IMETHODIMP
MacOSKeychain::AddLogin(nsILoginInfo *aLogin)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::RemoveLogin(nsILoginInfo *aLogin)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::ModifyLogin(nsILoginInfo *aOldLogin,
                           nsISupports *newLoginData)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::RemoveAllLogins()
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::GetAllLogins(PRUint32 *count,
                            nsILoginInfo ***logins)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::GetAllEncryptedLogins(PRUint32 *count,
                                     nsILoginInfo ***logins)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::SearchLogins(PRUint32 *count,
                            nsIPropertyBag *matchData,
                            nsILoginInfo ***logins)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::GetAllDisabledHosts(PRUint32 *count,
                                   PRUnichar ***hostnames)
{
  // TODO implement me
  *count = 0;
  *hostnames = nsnull;

  return NS_OK;
}

NS_IMETHODIMP
MacOSKeychain::GetLoginSavingEnabled(const nsAString &aHost,
                                     PRBool *_retval)
{
  // TODO implement me
  *_retval = PR_TRUE;

  return NS_OK;;
}

NS_IMETHODIMP
MacOSKeychain::SetLoginSavingEnabled(const nsAString &aHost,
                                     PRBool aEnabled)
{
  // TODO implement me

  return NS_OK;
}

NS_IMETHODIMP
MacOSKeychain::FindLogins(PRUint32 *count,
                          const nsAString &aHostname,
                          const nsAString &aActionURL,
                          const nsAString &aHttpRealm,
                          nsILoginInfo ***logins)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

NS_IMETHODIMP
MacOSKeychain::CountLogins(const nsAString & aHostname,
                           const nsAString & aActionURL,
                           const nsAString & aHttpRealm,
                           PRUint32 *_retval)
{
  return NS_ERROR_NOT_IMPLEMENTED;
}

static NS_METHOD
MacOSKeychainRegister(nsIComponentManager *compMgr,
                                         nsIFile *path,
                                         const char *loaderStr,
                                         const char *type,
                                         const nsModuleComponentInfo *info)
{
  nsCOMPtr<nsICategoryManager> cat =
      do_GetService(NS_CATEGORYMANAGER_CONTRACTID);
  NS_ENSURE_STATE(cat);

  cat->AddCategoryEntry("login-manager-storage", "nsILoginManagerStorage",
                        kMacOSKeychainContractID, PR_TRUE,
                        PR_TRUE, nsnull);
  return NS_OK;
}


static NS_METHOD
MacOSKeychainUnregister(nsIComponentManager* aCompMgr,
                        nsIFile* aPath,
                        const char* registryLocation,
                        const nsModuleComponentInfo* info)
{
  nsCOMPtr<nsICategoryManager> cat =
    do_GetService(NS_CATEGORYMANAGER_CONTRACTID);
  NS_ENSURE_STATE(cat);

  cat->DeleteCategoryEntry("login-manager-storage", "nsILoginManagerStorage",
                           PR_TRUE);

  return NS_OK;
}

NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychain);

static const nsModuleComponentInfo components[] =
{
  { "Mac OS Keychain Integration",
    MACOSKEYCHAIN_CID,
    kMacOSKeychainContractID,
    MacOSKeychainConstructor,
    MacOSKeychainRegister,
    MacOSKeychainUnregister },
};

NS_IMPL_NSGETMODULE(MacOSKeychain, components)

