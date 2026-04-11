// app/(auth)/login.tsx

import ContinueWithGoogle from "@/components/continue-with-google";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { images } from "@/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isIdTokenExpired } from "@/utils/auth-session";
import { hrefFromRedirectTo, mergeLoginLooseParamsIntoRedirect } from "@/utils/href-from-redirect";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
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
      Alert.alert("Login failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 bg-background">
      <ScrollView className="w-full px-4">
        <Image
          source={images.logo}
          resizeMode="contain"
          style={{
            width: 234,
            height: 76,
          }}
        />
        <View className="mt-4 gap-2">
          <Text className="text-foreground text-3xl font-bold">
            Welcome Back
          </Text>
          <Text className="text-foreground">Sign in to continue</Text>
        </View>

        <View className="mt-8 gap-5">
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
          <Text className="text-right text-foreground font-medium">
            Forgot Password?
          </Text>
          <Button size="lg" onPress={handleLogin} disabled={loading} textClassName="font-medium text-lg">
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </View>

        <View className="items-center justify-center my-10">
          <View className="border-t border-muted-foreground opacity-30 w-full my-4" />
          <Text className="absolute text-muted-foreground bg-background rounded-full px-2">
            Or
          </Text>
        </View>
        <View className="gap-4">
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
      </ScrollView>
    </ThemedSafeView>
  );
};

export default LoginPage;
