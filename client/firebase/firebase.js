import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDZk4dq29XZEJpkY1ZQg4JRAMWt8hMdYnA",
  authDomain: "savr-6ab25.firebaseapp.com",
  databaseURL: "https://savr-6ab25-default-rtdb.firebaseio.com",
  projectId: "savr-6ab25",
  storageBucket: "savr-6ab25.firebasestorage.app",
  messagingSenderId: "396753555804",
  appId: "1:396753555804:web:da9c18dfb026ade8da7199",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;