import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirebaseAuth } from "../firebase/firebase";

/** Web: Firebase popup (native uses @react-native-google-signin in googleAuth.js). */
export const GoogleSignIn = async () => {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const firebaseIdToken = await userCredential.user.getIdToken();
  return {
    firebaseUser: userCredential.user,
    firebaseIdToken,
  };
};
