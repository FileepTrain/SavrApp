// app/(auth)/sign-up.tsx

import { AuthFormScroll } from "@/components/auth/auth-form-scroll";
import ContinueWithGoogle from "@/components/continue-with-google";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { images } from "@/constants";
import { router } from "expo-router";
import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/firebase/firebase";
import { SafeAreaView } from "react-native-safe-area-context";
import { showAppAlert } from "@/utils/app-alert";

import { SERVER_URL } from "@/utils/server-url";

const SignUpPage = () => {
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const checkUsername = async (name: string) => {
    if (!name) return;

    try {
      const res = await fetch(`${SERVER_URL}/api/auth/check-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      setUsernameAvailable(data.available);
    } catch (err) {
      console.log("username check error", err);
      setUsernameAvailable(null);
    }
  };

  const handleSignUp = async () => {
    if (!username || !email || !password) {
      showAppAlert("Error", "Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      // Check username availability
      const resCheck = await fetch(`${SERVER_URL}/api/auth/check-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const checkData = await resCheck.json();
      if (!checkData.available) {
        showAppAlert("Username taken", "Please choose another username.");
        setUsernameAvailable(false);
        return;
      }

      // Register user
      const res = await fetch(`${SERVER_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const regData = await res.json();

      if (!res.ok) {
        throw new Error(regData.error || "Registration failed");
      }

      // Verify Email used in sign-up + force user to log in after verifying
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await signOut(auth);
      showAppAlert(
        "Verify your email!",
        "A verification link has been sent to your email. Please verify your account before logging in.",
      );
      router.replace("/login");
      
      // Original Auto-Login Setup
      // const loginRes = await fetch(`${SERVER_URL}/api/auth/login`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email, password }),
      // });

      // const loginData = await loginRes.json();

      // if (!loginRes.ok) {
      //   throw new Error(loginData.error || "Login after signup failed");
      // }

      // await AsyncStorage.multiSet([
      //   ["idToken", loginData.idToken],
      //   ["uid", loginData.uid],
      //   ["username", loginData.username ?? username],
      //   ["email", loginData.email ?? email],
      //   ["onboarded", loginData.onboarded ? "true" : "false"],
      // ]);

      // // Determine redirect route: onboarding if user is not onboarded, home if user is onboarded
      // const onboarded = loginData.onboarded;
      // if (!onboarded) {
      //   router.replace("/onboarding");
      // } else {
      //   router.replace("/home");
      // }
    } catch (err: any) {
      showAppAlert("Sign Up failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom", "left", "right"]}>
      <AuthFormScroll>
        <Image
          source={images.logo}
          resizeMode="contain"
          style={{
            width: 234,
            height: 76,
            alignSelf: "center",
          }}
        />
        <View className="mt-4 gap-2 w-full items-center px-1">
          <Text className="text-foreground text-3xl font-bold text-center">
            Create Account
          </Text>
          <Text className="text-foreground text-center">Sign up to get started</Text>
        </View>

        <View className="mt-8 gap-5 w-full">
          <Input
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setUsernameAvailable(null);
            }}
            onBlur={() => checkUsername(username)}
          />
          {username.length > 0 && usernameAvailable === false && (
            <Text className="text-red-500 text-xs">
              Username is already taken.
            </Text>
          )}
          {username.length > 0 && usernameAvailable === true && (
            <Text className="text-green-500 text-xs">
              Username is available!
            </Text>
          )}

          <Input
            label="Email"
            placeholder="Enter your email"
            inputType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="Enter your password"
            inputType="password"
            value={password}
            onChangeText={setPassword}
          />

          <Button size="lg" onPress={handleSignUp} disabled={loading} textClassName="font-medium text-lg">
            {loading ? "Signing Up..." : "Sign Up"}
          </Button>
        </View>

        <View className="items-center justify-center my-10 w-full">
          <View className="border-t border-muted-foreground opacity-30 w-full my-4" />
          <Text className="absolute text-muted-foreground bg-background rounded-full px-2">
            Or
          </Text>
        </View>

        <View className="gap-4 w-full">
          <ContinueWithGoogle />
          <Button
            size="lg"
            variant="outline"
            onPress={() => router.push("/login")}
            textClassName="font-medium text-lg"
          >
            Already have an account?
          </Button>
        </View>
      </AuthFormScroll>
    </SafeAreaView>
  );
};

export default SignUpPage;
