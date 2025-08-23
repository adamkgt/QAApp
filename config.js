// config.js
const firebaseConfig = {
    apiKey: "AIzaSyA7qtIYm01pZdvY-5CNwOKVYgAIO0Vm25w",
    authDomain: "tc-managment.firebaseapp.com",
    projectId: "tc-managment",
    storageBucket: "tc-managment.firebasestorage.app",
    messagingSenderId: "514951940531",
    appId: "1:514951940531:web:a6a2d9bf9c0e57e10923c6",
    measurementId: "G-3VCJZWPJ2F"
};
// 🔹 Inicjalizacja Firebase
firebase.initializeApp(firebaseConfig);

// 🔹 Eksport do innych plików (żeby script.js miał dostęp)
window.auth = auth;
window.db = db;
