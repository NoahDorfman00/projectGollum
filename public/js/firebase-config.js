// Firebase configuration — replace with your project's config
const firebaseConfig = {
  apiKey: "AIzaSyBFtUZShhq3isaRkFwZsqtWJqp0UDgjxEA",
  authDomain: "projectgollum.firebaseapp.com",
  projectId: "projectgollum",
  storageBucket: "projectgollum.firebasestorage.app",
  messagingSenderId: "757521647182",
  appId: "1:757521647182:web:0d64019c028e36571de51f",
  measurementId: "G-LV2XKNJP46"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
