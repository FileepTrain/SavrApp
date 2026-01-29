// app/(auth)/sign-up.tsx

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
      Alert.alert("Error", "Please fill in all fields.");
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
        Alert.alert("Username taken", "Please choose another username.");
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

      // Option 1: auto-login right after register
      const loginRes = await fetch(`${SERVER_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok) {
        throw new Error(loginData.error || "Login after signup failed");
      }

      await AsyncStorage.multiSet([
        ["idToken", loginData.idToken],
        ["uid", loginData.uid],
        ["username", loginData.username ?? username],
        ["email", loginData.email ?? email],
      ]);

      router.replace("/home");
    } catch (err: any) {
      Alert.alert("Sign Up failed", err.message);
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
            Create Account
          </Text>
          <Text className="text-foreground">Sign up to get started</Text>
        </View>

        <View className="mt-8 gap-5">
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

          <Button size="lg" onPress={handleSignUp} disabled={loading}>
            {loading ? "Signing Up..." : "Sign Up"}
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
            onPress={() => router.push("/login")}
          >
            Already have an account?
          </Button>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
};

export default SignUpPage;
