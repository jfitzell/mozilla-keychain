Store your Firefox website usernames and passwords in Apple's Keychain Services, just like Safari and other browsers do on OS X. This allows you to use the same stored logins in any browser that uses the Keychain. It also allows you to take advantage of the security features of Keychain Services such as auto-locking when the screensaver is activated.

Install the extension here: https://addons.mozilla.org/en-US/firefox/addon/13509/

The first time you run Firefox with this extension enabled, you will be prompted to migrate your existing stored passwords (if any) to the Mac OS X Keychain. Thereafter, new credentials will no longer be stored in your Firefox profile. This means, for example, that your credentials will not be included if you later migrate your Firefox profile to another computer.

This extension tries as hard as possible to avoid requesting access to your passwords until it needs them, however it is ultimately Firefox/Thunderbird that decides what passwords to ask for when. If you find you're getting a lot of prompts, your only real option is to click "Always Allow" (or ask Mozilla to avoid asking for passwords until they actually need them).

To enable detailed logging, go to `about:config` and set the `signon.debug` preference to `true`. Some log messages will appear in the Browser Console; yet more detail should be visible in OS X's Console.app.

# Development
To help out with development:

1. Get the code:
`git clone git@github.com:jfitzell/mozilla-keychain.git`
2. Download a version of Firefox [Developer Edition](https://www.mozilla.org/en-GB/firefox/developer/), [Nightly](https://www.mozilla.org/en-US/firefox/nightly/), or an [unbranded build](https://wiki.mozilla.org/Add-ons/Extension_Signing#Unbranded_Builds)
3. (Optional) Create a [profile for development](https://developer.mozilla.org/en-US/Add-ons/Setting_up_extension_development_environment#Development_profile) (some of the other recommendations in that link may also be helpful)
4. Enabled unsigned extensions:
  1. type `about:config` into the URL bar in Firefox
  2. in the Search box type `xpinstall.signatures.required`
  3. double-click the preference, or right-click and select "Toggle", to set it to `false`.
5. Tell Firefox to [load the extension directly from the folder](https://developer.mozilla.org/en-US/Add-ons/Setting_up_extension_development_environment#Firefox_extension_proxy_file) where you cloned the repository
6. Enable logging by setting `signon.debug` to `true`; logging is visible in the Browser Console. For trace level logging, start Firefox from the command line with `/path/to/Firefox.app/Contents/MacOS/firefox-bin -ProfileManager`.
7. It can also be useful to use another keychain specifically for development and testing. In `about:config` set `extensions.macos-keychain.search-path` and `extensions.macos-keychain.write-file` to e.g. `~/Library/Keychains/test.keychain`

# Packaging
To create a new package:

1. Update `install.rdf` with new version number and update minVersion and maxVersion as appropriate
2. Update `CHANGES` with the major changes since the last release
3. Zip up the folder. From inside the repository run `zip -r ../releases/macos-keychain-VERSION.xpi *`
