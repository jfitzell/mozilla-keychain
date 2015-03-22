Store your Firefox website usernames and passwords in Apple's Keychain Services, just like Safari and other browsers do on OS X. This allows you to use the same stored logins in any browser that uses the Keychain. It also allows you to take advantage of the security features of Keychain Services such as auto-locking when the screensaver is activated.

Install the extension here: https://addons.mozilla.org/en-US/firefox/addon/13509/

The first time you run Firefox with this extension enabled, you will be prompted to migrate your existing stored passwords (if any) to the Mac OS X Keychain. Thereafter, new credentials will no longer be stored in your Firefox profile. This means, for example, that your credentials will not be included if you later migrate your Firefox profile to another computer.

This extension tries as hard as possible to avoid requesting access to your passwords until it needs them, however it is ultimately Firefox/Thunderbird that decides what passwords to ask for when. If you find you're getting a lot of prompts, your only real option is to click "Always Allow" (or ask Mozilla to avoid asking for passwords until they actually need them).

To enable detailed logging, go to `about:config` and set the `signon.debug` preference to `true`. Some log messages will appear in the Browser Console; yet more detail should be visible in OS X's Console.app.
