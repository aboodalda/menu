// ============================================================
// إعدادات Firebase — عبّي القيم تحت من لوحة تحكم مشروعك بـ Firebase
// (اتبع خطوات README.md خطوة بخطوة، وبتوصل هون آخر شي)
// ============================================================

const firebaseConfig = {
  apiKey: "ضع_القيمة_هون",
  authDomain: "ضع_القيمة_هون",
  projectId: "ضع_القيمة_هون",
  storageBucket: "ضع_القيمة_هون",
  messagingSenderId: "ضع_القيمة_هون",
  appId: "ضع_القيمة_هون"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
