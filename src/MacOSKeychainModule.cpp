/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Keychain Services Integration Extension for Mozilla.
 *
 * The Initial Developer of the Original Code is
 * Julian Fitzell <jfitzell@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
#ifdef GECKO_2
#include "mozilla/ModuleUtils.h"
#else //GECKO_2
#include "nsIGenericFactory.h"
#endif //GECKO_2

#include "MacOSKeychainService.h"
#include "MacOSKeychainItem.h"

NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychainService);
NS_GENERIC_FACTORY_CONSTRUCTOR(MacOSKeychainItem);

#ifdef GECKO_2
// The following line defines a kMACOSKEYCHAINSERVICE_CID CID variable.
NS_DEFINE_NAMED_CID(MACOSKEYCHAINSERVICE_CID);
// The following line defines a kMACOSKEYCHAINITEM_CID CID variable.
NS_DEFINE_NAMED_CID(MACOSKEYCHAINITEM_CID);

// Build a table of ClassIDs (CIDs) which are implemented by this module. CIDs
// should be completely unique UUIDs.
// each entry has the form { CID, service, factoryproc, constructorproc }
// where factoryproc is usually NULL.
static const mozilla::Module::CIDEntry kMacOSKeychainCIDs[] = {
    { &kMACOSKEYCHAINSERVICE_CID, true, NULL, MacOSKeychainServiceConstructor },
    { &kMACOSKEYCHAINITEM_CID, false, NULL, MacOSKeychainItemConstructor },
    { NULL }
};

// Build a table which maps contract IDs to CIDs.
// A contract is a string which identifies a particular set of functionality. In some
// cases an extension component may override the contract ID of a builtin gecko component
// to modify or extend functionality.
static const mozilla::Module::ContractIDEntry kMacOSKeychainContracts[] = {
    { MACOSKEYCHAINSERVICE_CONTRACTID, &kMACOSKEYCHAINSERVICE_CID },
    { MACOSKEYCHAINITEM_CONTRACTID, &kMACOSKEYCHAINITEM_CID },
    { NULL }
};

// Category entries are category/key/value triples which can be used
// to register contract ID as content handlers or to observe certain
// notifications. Most modules do not need to register any category
// entries: this is just a sample of how you'd do it.
// @see nsICategoryManager for information on retrieving category data.
static const mozilla::Module::CategoryEntry kMacOSKeychainCategories[] = {
//    { "my-category", "my-key", NS_SAMPLE_CONTRACTID },
    { NULL }
};

static const mozilla::Module kMacOSKeychainModule = {
    mozilla::Module::kVersion,
    kMacOSKeychainCIDs,
    kMacOSKeychainContracts,
    kMacOSKeychainCategories
};

// The following line implements the one-and-only "NSModule" symbol exported from this
// shared library.
NSMODULE_DEFN(MacOSKeychainModule) = &kMacOSKeychainModule;

// The following line implements the one-and-only "NSGetModule" symbol
// for compatibility with mozilla 1.9.2. You should only use this
// if you need a binary which is backwards-compatible and if you use
// interfaces carefully across multiple versions.
NS_IMPL_MOZILLA192_NSGETMODULE(&kMacOSKeychainModule)

#else //GECKO_2

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

#endif //GECKO_2



