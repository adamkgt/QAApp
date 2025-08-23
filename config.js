// config.js
const firebaseConfig = {
  apiKey: "TU_SWÓJ_API_KEY",
  authDomain: "TU_SWÓJ_AUTH_DOMAIN",
  projectId: "TU_SWÓJ_PROJECT_ID",
  storageBucket: "TU_SWÓJ_STORAGE_BUCKET",
  messagingSenderId: "TU_SWÓJ_MESSAGING_SENDER_ID",
  appId: "TU_SWÓJ_APP_ID",
  measurementId: "TU_SWÓJ_MEASUREMENT_ID"
};

// Inicjalizacja Firebase (tylko raz)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Obiekty globalne do użycia w całej aplikacji
const auth = firebase.auth();
const db = firebase.firestore();
