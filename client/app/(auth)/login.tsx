// app/(auth)/login.tsx

import ContinueWithGoogle from "@/components/continue-with-google";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { images } from "@/constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${SERVER_URL}/login`, {
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
      ]);

      router.replace("/home"); // go to home screen
    } catch (err: any) {
      Alert.alert("Login failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedSafeView className="items-center justify-center">
      <ScrollView className="w-full px-4">
        <View className="items-center justify-center gap-2">
          <Image
            source={images.logo}
            resizeMode="contain"
            className="w-[150px] h-[50px]"
          />
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
          <Text className="text-right text-foreground text-sm">
            Forgot Password?
          </Text>
          <Button size="lg" onPress={handleLogin} disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </View>

        <View className="items-center justify-center my-10">
          <View className="border-t border-muted-foreground opacity-30 w-full my-4" />
          <Text className="absolute text-muted-foreground bg-app-background rounded-full px-2">
            Or
          </Text>
        </View>
        <View className="gap-4">
          <ContinueWithGoogle />
          <Button
            size="lg"
            variant="muted"
            onPress={() => router.push("/sign-up")}
          >
            Create New Account
          </Button>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
};

export default LoginPage;
