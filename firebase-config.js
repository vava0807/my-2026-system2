// Firebase 配置
const firebaseConfig = {
  // 在這裡填入你的 Firebase 專案配置
  // 請到 Firebase Console 取得這些資訊：https://console.firebase.google.com/
  apiKey: "AIzaSyDpuLk-g7tSbhulifMtW1qFpR9HhBX3fM8",
  authDomain: "my-2026-system.firebaseapp.com",
  databaseURL: "https://my-2026-system-default-rtdb.firebaseio.com",
  projectId: "my-2026-system",
  storageBucket: "my-2026-system.firebasestorage.app",
  messagingSenderId: "117966706809",
  appId: "1:117966706809:web:073930b6ba501e0ae7dca8",
  measurementId: "G-Q81S79YY54"
};

// 初始化 Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase 已初始化');
}
