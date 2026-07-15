// ============================================================
// إعدادات Firebase — عبّي القيم تحت من لوحة تحكم مشروعك بـ Firebase
// (اتبع خطوات README.md خطوة بخطوة، وبتوصل هون آخر شي)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBPW81iRZDA64z-4VLDkNUlMHKdj039S84",
  authDomain: "menu-cd0c8.firebaseapp.com",
  projectId: "menu-cd0c8",
  storageBucket: "menu-cd0c8.firebasestorage.app",
  messagingSenderId: "633409214251",
  appId: "1:633409214251:web:ec1d94f02b8fbfb73f576e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
