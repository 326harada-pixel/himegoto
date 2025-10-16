// himegoto - Firebase config (build012 full)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD-gLP5rIErS678UewraA0vt59JbLZpzhU",
  authDomain: "himegoto-web.firebaseapp.com",
  projectId: "himegoto-web",
  storageBucket: "himegoto-web.firebasestorage.app",
  messagingSenderId: "363882081243",
  appId: "1:363882081243:web:09e3827701cbc6d1d2f4fe"
};

// Auto init hook for non-module usage (safely no-op if not present)
try {
  if (typeof initializeApp === 'function') {
    initializeApp(window.FIREBASE_CONFIG);
  }
} catch (e) {
  /* ignore - module init will happen in firebase-auth-modal.js */
}
