import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { getFirebaseAuth } from "../firebase/firebase";

export const GoogleSignIn = async () => {
  try {
    const auth = getFirebaseAuth();
    GoogleSignin.configure({
        webClientId: "396753555804-a01q42ddj5lg4pnbustfuks06tej142a.apps.googleusercontent.com",
    });
    await GoogleSignin.signOut();

    await GoogleSignin.hasPlayServices();

    const userInfo = await GoogleSignin.signIn();
    const idToken = userInfo.data?.idToken;
    console.log("ID TOKEN:", userInfo.idToken);
    console.log("FULL USER:", userInfo);
    if (!idToken) {
        throw new Error("No ID token returned from Google")
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);

    const firebaseIdToken = await userCredential.user.getIdToken();

    console.log("Google user:", userInfo);

    return {
      firebaseUser: userCredential.user,
      firebaseIdToken,
    };
  } catch (error) {
    console.error("Google Sign-In error:", error);
    throw error;
  }
};

// export const signInWithGoogle = async () => {
//   try {
//     await GoogleSignin.hasPlayServices();

//     const userInfo = await GoogleSignin.signIn();

//     const idToken = userInfo.idToken;

//     if (!idToken) {
//       throw new Error("No ID token from Google");
//     }

//     const credential = GoogleAuthProvider.credential(idToken);
//     const userCredential = await signInWithCredential(auth, credential);

//     const firebaseIdToken = await userCredential.user.getIdToken();

//     return {
//       firebaseUser: userCredential.user,
//       firebaseIdToken,
//     };
//   } catch (error) {
//     console.error("Google Sign-In error:", error);
//     throw error;
//   }
// };