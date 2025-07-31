// Firebase Configuration and Initialization
// This file contains only the Firebase configuration and database initialization

const firebaseConfig = {
  apiKey: "AIzaSyAVEq6zfCKEPJtslSz8Jg7Aw9XtTeVzf58",
  authDomain: "fark-8fc62.firebaseapp.com",
  databaseURL: "https://fark-8fc62-default-rtdb.firebaseio.com",
  projectId: "fark-8fc62",
  storageBucket: "fark-8fc62.firebasestorage.app",
  messagingSenderId: "589413345531",
  appId: "1:589413345531:web:89f76f6e6ec49ecc32a85e",
  measurementId: "G-DDRBC3DVXM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Export for global access
window.database = database;

// console.log('🔥 Firebase initialized successfully');
