// app/(auth)/login.tsx

import { AuthFormScroll } from "@/components/auth/auth-form-scroll";
import ContinueWithGoogle from "@/components/continue-with-google";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { images } from "@/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isIdTokenExpired } from "@/utils/auth-session";
import { hrefFromRedirectTo, mergeLoginLooseParamsIntoRedirect } from "@/utils/href-from-redirect";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, Text, View } from "react-native";
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/firebase/firebase";
import { SafeAreaView } from "react-native-safe-area-context";
import { SERVER_URL } from "@/utils/server-url";
import { showAppAlert } from "@/utils/app-alert";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const params = useLocalSearchParams<{
    redirectTo?: string;
    tab?: string;
    mealPlanId?: string;
  }>();
  const { redirectTo, tab: looseTab, mealPlanId: looseMealPlanId } = params;

  const getSafeRedirectTarget = () =>
    mergeLoginLooseParamsIntoRedirect(redirectTo, {
      tab: looseTab,
      mealPlanId: looseMealPlanId,
    });

  // Share links open savr://login?redirectTo=... — if already signed in, skip this screen.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken || isIdTokenExpired(idToken)) return;

      const onboardedValue = await AsyncStorage.getItem("onboarded");
      const isOnboarded = onboardedValue === "true";
      if (cancelled) return;

      if (isOnboarded) {
        router.replace(hrefFromRedirectTo(getSafeRedirectTarget()));
      } else {
        router.replace("/onboarding");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [redirectTo, looseTab, looseMealPlanId]);

  const handleLogin = async () => {
    setErrorMessage("");
    if (!email || !password) {
      const msg = "Please enter email and password.";
      setErrorMessage(msg);
      showAppAlert("Error", msg);
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const raw = await res.text();
      let data: {
        error?: string;
        code?: string;
        idToken?: string;
        uid?: string;
        username?: string;
        email?: string;
        onboarded?: boolean;
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          `Could not read server response (HTTP ${res.status}). Is the API running at ${SERVER_URL}?`,
        );
      }

      if (!res.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            await signOut(auth);
            Alert.alert(
              "Verify your email!",
              "Your email is not verified. We've sent you a new verification link."
            );
          } catch (err) {
            Alert.alert(
              "Email not verified",
              "Please check your inbox and verify your email before signing in."
          );
          }
          return;
        }
        throw new Error(data.error || "Login failed");
      }

      if (!data.idToken || !data.uid) {
        throw new Error("Login succeeded but the server response was incomplete.");
      }

      // Store auth info for later (account page, update/delete, etc.)
      await AsyncStorage.multiSet([
        ["idToken", data.idToken],
        ["uid", data.uid],
        ["username", data.username ?? ""],
        ["email", data.email ?? email],
        ["onboarded", data.onboarded ? "true" : "false"],
      ]);

      const onboarded = data.onboarded;
      if (!onboarded) {
        router.replace("/onboarding");
      } else {
        router.replace(hrefFromRedirectTo(getSafeRedirectTarget()));
      }
    } catch (err: any) {
      const msg = err?.message ?? "Login failed";
      setErrorMessage(msg);
      showAppAlert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Enter email and password first.");
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      await signOut(auth);

      Alert.alert("Success", "Verification email sent.");
    } catch (err) {
      Alert.alert("Error", "Could not resend verification email.");
    }
  };

  const getDeviceId = async () => {
    let deviceId = await AsyncStorage.getItem("deviceId");

    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2);
      await AsyncStorage.setItem("deviceId", deviceId);
    }
    return deviceId;
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
            Welcome Back
          </Text>
          <Text className="text-foreground text-center">Sign in to continue</Text>
        </View>

        <View className="mt-8 gap-5 w-full">
          <Input
            label="Email"
            labelClassName="text-lg"
            placeholder="Enter your email"
            inputType="email-address"
            value={email}
            onChangeText={setEmail}
            inputClassName="text-lg py-4 min-h-[56px]"
          />
          <Input
            label="Password"
            labelClassName="text-lg"
            placeholder="Enter your password"
            inputType="password"
            value={password}
            onChangeText={setPassword}
            inputClassName="text-lg py-4 min-h-[56px]"
          />
          <Text
            className="text-right text-foreground font-medium text-lg"
            onPress={() => router.push("/forgot-password")}
          >
            Forgot Password?
          </Text>
          {errorMessage ? (
            <Text className="text-red-primary text-sm text-center">{errorMessage}</Text>
          ) : null}
          <Button size="lg" onPress={handleLogin} disabled={loading} textClassName="font-medium text-lg">
            {loading ? "Signing In..." : "Sign In"}
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
            onPress={() => router.push("/sign-up")}
            textClassName="font-medium text-lg"
          >
            Create New Account
          </Button>
        </View>
      </AuthFormScroll>
    </SafeAreaView>
  );
};

export default LoginPage;
