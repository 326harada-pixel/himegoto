// himegoto - Firebase config injection
// Paste your actual values from Firebase Console > Project settings > General > SDK setup and configuration.
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// Keep the variable name as-is. index.html/app.js will auto-detect this and initialize Firebase.