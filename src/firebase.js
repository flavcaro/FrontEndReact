// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2wy_RD0w5d13nsg2JBbSPtPJGuRsSr3c",
  authDomain: "sketchandguess-959e6.firebaseapp.com",
  databaseURL: "https://sketchandguess-959e6-default-rtdb.firebaseio.com",
  projectId: "sketchandguess-959e6",
  storageBucket: "sketchandguess-959e6.firebasestorage.app",
  messagingSenderId: "834259164506",
  appId: "1:834259164506:web:039f69e7a0542bc099a763",
  measurementId: "G-VB7R1P3J02"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
