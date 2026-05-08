import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { images } from "@/constants";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase/firebase";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(auth, email);

      Alert.alert(
        "Reset Email Sent",
        "Check your inbox to reset your password."
      );

      router.replace("/login");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 bg-background">
        <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="w-full px-4">
        <Image
          source={images.logo}
          resizeMode="contain"
          style={{ width: 234, height: 76 }}
        />
        <View className="mt-4 gap-2">
          <Text className="text-foreground text-3xl font-bold">
            Reset Password
          </Text>
          <Text className="text-foreground">
            Enter your email to receive a reset link.
          </Text>
        </View>
        <View className="mt-8 gap-5">
          <Input
            label="Email"
            placeholder="Enter your email"
            inputType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button
            size="lg"
            onPress={handleReset}
            disabled={loading}
            textClassName="font-medium text-lg"
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </Button>
          <Text
            className="text-right text-foreground font-medium"
            onPress={() => router.replace("/login")}
          >
            Back to Login
          </Text>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
};

export default ForgotPasswordPage;