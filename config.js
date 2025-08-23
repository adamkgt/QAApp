// config.js
const firebaseConfig = {
  apiKey: "TU_WSTAW_SWÓJ_API_KEY",
  authDomain: "TU_WSTAW_SWÓJ_AUTH_DOMAIN",
  projectId: "TU_WSTAW_SWÓJ_PROJECT_ID",
  storageBucket: "TU_WSTAW_SWÓJ_STORAGE_BUCKET",
  messagingSenderId: "TU_WSTAW_SWÓJ_MESSAGING_SENDER_ID",
  appId: "TU_WSTAW_SWÓJ_APP_ID",
  measurementId: "TU_WSTAW_SWÓJ_MEASUREMENT_ID"
};

// Inicjalizacja Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();
