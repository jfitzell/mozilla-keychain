#include "MacOSKeychain.h"
#include "nsILoginInfo.h"
#include "nsIGenericFactory.h"
#include "nsMemory.h"
#include "nsICategoryManager.h"
#include "nsComponentManagerUtils.h"
#include "nsCOMPtr.h"
//#include "nsNetUtil.h"
#include "nsCOMArray.h"
#include "nsServiceManagerUtils.h"

#include "KeychainItem.h"

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
  NS_ENSURE_ARG_POINTER(aLogin);

  NSString *hostname, *formSubmitURL, *httpRealm, *username, *password;
  NSNumber *port;
  SecProtocolType protocol;
  SecAuthenticationType authenticationType;

  nsString buffer;
  (void)aLogin->GetHostname(buffer);
  hostname = [NSString stringWithCharacters: buffer.get() length: buffer.Length()];
  
  NSURL *hostnameURL = [NSURL URLWithString: hostname];
  
  hostname = [hostnameURL host];
  port = [hostnameURL port];
  protocol = kSecProtocolTypeHTTP; // can be determined from the URL
  authenticationType = kSecAuthenticationTypeDefault; // default
  
  (void)aLogin->GetFormSubmitURL(buffer);
  if (!buffer.IsVoid()) {
    authenticationType = kSecAuthenticationTypeHTMLForm;
    formSubmitURL = [NSString stringWithCharacters: buffer.get() length: buffer.Length()];
  }
          
  (void)aLogin->GetHttpRealm(buffer);
  httpRealm = [NSString stringWithCharacters: buffer.get() length: buffer.Length()];
  
  (void)aLogin->GetUsername(buffer);
  username = [NSString stringWithCharacters: buffer.get() length: buffer.Length()];

  (void)aLogin->GetPassword(buffer);
  password = [NSString stringWithCharacters: buffer.get() length: buffer.Length()];

  KeychainItem *item = [KeychainItem addKeychainItemForHost: hostname
                                  port: [port unsignedLongValue]
                              protocol: protocol
                    authenticationType: authenticationType
                          withUsername: username
                              password: password ];
                               
  [item setComment: hostname ];
  
  return NS_OK;
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
  *count = 0;
  return NS_OK;
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

NSArray*
MacOSKeychain::FetchLogins(const nsAString & aHostname,
                           const nsAString & aActionURL, // used only to figure out if it's a form
                           const nsAString & aHttpRealm ) // not yet used
{
  if (aHostname.IsVoid()) { // a NULL value should not match any logins and should return a count of 0
  	return [NSArray array];
  }

  NSString *hostname = NULL;
  if (! aHostname.IsEmpty()) {
    const PRUnichar* data;
    PRUint32 length = NS_StringGetData(aHostname, &data);
    NSString *urlString = [NSString stringWithCharacters: data length: length];
    NSURL *url = [NSURL URLWithString: urlString];
    hostname = [url host];
  }
  
  SecAuthenticationType authenticationType;
  if (aActionURL.IsVoid()) { // NULL means do not match form passwords
    authenticationType = kSecAuthenticationTypeDefault;
  } else { // Empty string or any value
  	authenticationType = kSecAuthenticationTypeHTMLForm;
  }
  
  NSArray* keychainArray = [KeychainItem allKeychainItemsForHost: hostname
                                                            port: 0
                                                        protocol: NULL
                                              authenticationType: authenticationType
                                                         creator: NULL];
  
  return keychainArray;
}

NS_IMETHODIMP
MacOSKeychain::FindLogins(PRUint32 *count,
                          const nsAString &aHostname,
                          const nsAString &aActionURL,
                          const nsAString &aHttpRealm,
                          nsILoginInfo ***logins)
{
  NSArray* keychainArray = FetchLogins(aHostname, aActionURL, aHttpRealm);

  NSEnumerator *enumerator = [keychainArray objectEnumerator];
  KeychainItem *item;
  nsCOMArray<nsILoginInfo> results;
  while (item = [enumerator nextObject]) {
    nsCOMPtr<nsILoginInfo> info = do_CreateInstance(NS_LOGININFO_CONTRACTID);
    if (!info) {
      return NS_ERROR_OUT_OF_MEMORY;
    }
    nsresult rv;
    rv = info->Init(NS_ConvertUTF8toUTF16((char*)[[item host] UTF8String]),
                    EmptyString(),
                    EmptyString(),
                    NS_ConvertUTF8toUTF16((char*)[[item username] UTF8String]),
                    NS_ConvertUTF8toUTF16((char*)[[item password] UTF8String]),
                    EmptyString(),
                    EmptyString());
    if (NS_SUCCEEDED(rv))
      (void)results.AppendObject(info);
  }

  *count = [keychainArray count];
  
  if (0 == *count) {
    *logins = nsnull;
    return NS_OK;
  }
  
  nsILoginInfo **retval = (nsILoginInfo **)NS_Alloc(sizeof(nsILoginInfo *) * *count);
  for (PRInt32 i = 0; i < *count; i++)
    NS_ADDREF(retval[i] = results[i]);
  *logins = retval;
  
  return NS_OK;
}

NS_IMETHODIMP
MacOSKeychain::CountLogins(const nsAString & aHostname,
                           const nsAString & aActionURL, // used only to figure out if it's a form
                           const nsAString & aHttpRealm, // not yet used
                           PRUint32 *_retval)
{
  NSArray* keychainArray = FetchLogins(aHostname, aActionURL, aHttpRealm);
  
  *_retval = [keychainArray count];
  
  return NS_OK;
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

