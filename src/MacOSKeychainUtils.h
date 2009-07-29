#import <CoreServices/CoreServices.h>
#import <Security/Security.h>

#include "nsStringAPI.h"

nsresult ConvertOSStatus(OSStatus result);
SecProtocolType ConvertStringToSecProtocol(const nsAString & protocol);
const nsString ConvertSecProtocolToString(SecProtocolType protocol);