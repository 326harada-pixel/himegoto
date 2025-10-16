
himegoto build009 - CONFIG PATCH
================================

WHY YOU SEE "FIREBASE_CONFIG missing"
------------------------------------
The app expects a global variable `window.FIREBASE_CONFIG` to initialize Firebase.
If it isn't present, the login button shows: "FIREBASE_CONFIG missing".

WHAT TO DO
----------
1) Open Firebase Console → Project settings → General → "SDK setup and configuration" (Web app).
2) Copy the values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
3) Edit the included `config.js` and paste your values.
4) Upload BOTH files (`config.js` and this app's other files) to the GitHub `himegoto` root so the path is:
   - himegoto/config.js
5) Deploy. On refresh, the login dialog will work. No separate "register" button is needed—
   phone verification both creates an account (first time) and logs in.

NOTES
-----
- Domain allowlist: Firebase Console → Authentication → Settings → Authorized domains must include:
  - localhost (dev), himegoto-web.firebaseapp.com, himegoto-web.web.app, himegoto.vercel.app
- Phone Auth test numbers: Authentication → Sign-in method → Phone → "Phone numbers for testing".
- Japan numbers: input as +81XXXXXXXXXX (the app will auto-convert 080/090/070 → +81...).

Version: build009 • ver.1.22
