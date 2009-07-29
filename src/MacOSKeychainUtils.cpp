#include "MacOSKeychainUtils.h"

nsresult ConvertOSStatus(OSStatus result)
{
  switch (result) {
    case noErr:
      return NS_OK;
    case paramErr:
      return NS_ERROR_INVALID_ARG;
  };

  return NS_ERROR_FAILURE;
}

SecProtocolType ConvertStringToSecProtocol(const nsAString & protocol)
{
  if (protocol.EqualsLiteral("http"))
    return kSecProtocolTypeHTTP;
  else if (protocol.EqualsLiteral("ftp"))
    return kSecProtocolTypeFTP;
  else if (protocol.EqualsLiteral("irc"))
    return kSecProtocolTypeIRC;
  else if (protocol.EqualsLiteral("pop3"))
    return kSecProtocolTypePOP3;
  else if (protocol.EqualsLiteral("smtp"))
    return kSecProtocolTypeSMTP;
  else if (protocol.EqualsLiteral("imap"))
    return kSecProtocolTypeIMAP;
  else if (protocol.EqualsLiteral("ftps"))
    return kSecProtocolTypeFTPS;
  else if (protocol.EqualsLiteral("https"))
    return kSecProtocolTypeHTTPS;
  else if (protocol.EqualsLiteral("imaps"))
    return kSecProtocolTypeIMAPS;
  else if (protocol.EqualsLiteral("ircs"))
    return kSecProtocolTypeIRCS;
  else if (protocol.EqualsLiteral("pop3s"))
    return kSecProtocolTypePOP3S;

  return kSecProtocolTypeHTTP;
}

const nsString ConvertSecProtocolToString(SecProtocolType protocol)
{
  switch (protocol) {
    case kSecProtocolTypeHTTP:
      return NS_LITERAL_STRING("http");
    case kSecProtocolTypeFTP:
      return NS_LITERAL_STRING("ftp");
    case kSecProtocolTypeIRC:
      return NS_LITERAL_STRING("irc");
    case kSecProtocolTypePOP3:
      return NS_LITERAL_STRING("pop3");
    case kSecProtocolTypeSMTP:
      return NS_LITERAL_STRING("smtp");
    case kSecProtocolTypeIMAP:
      return NS_LITERAL_STRING("imap");
    case kSecProtocolTypeFTPS:
      return NS_LITERAL_STRING("ftps");
    case kSecProtocolTypeHTTPS:
      return NS_LITERAL_STRING("https");
    case kSecProtocolTypeIMAPS:
      return NS_LITERAL_STRING("imaps");
    case kSecProtocolTypeIRCS:
      return NS_LITERAL_STRING("ircs");
    case kSecProtocolTypePOP3S:
      return NS_LITERAL_STRING("pop3s");
    
    default:
      return NS_LITERAL_STRING("http");
  }
}