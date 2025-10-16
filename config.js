// himegoto - Firebase config (build009 full version)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-gLP5rIErS678UewraA0vt59JbLZpzhU",
  authDomain: "himegoto-web.firebaseapp.com",
  projectId: "himegoto-web",
  storageBucket: "himegoto-web.firebasestorage.app",
  messagingSenderId: "363882081243",
  appId: "1:363882081243:web:09e3827701cbc6d1d2f4fe"
};

// Auto Firebase initialization hook
if (typeof firebase === 'undefined' && typeof initializeApp === 'function') {
  initializeApp(window.FIREBASE_CONFIG);
}