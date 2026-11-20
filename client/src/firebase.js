// Import the functions you need from the SDKs you need
import { initializeApp ,  getApps, getApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAx8ruxJCIBgI8ODeKn2nks3hkgXP2bhB0",
  authDomain: "vaanshika-6a813.firebaseapp.com",
  projectId: "vaanshika-6a813",
  storageBucket: "vaanshika-6a813.firebasestorage.app",
  messagingSenderId: "80715735047",
  appId: "1:80715735047:web:84e644cef2e335d5ae0aa2",
  measurementId: "G-8P7GJN4MR5"
};

// Initialize Firebase
const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider, signInWithPopup };