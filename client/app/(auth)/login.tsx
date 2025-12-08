import { images } from "@/constants";
import React, { useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
// Components
import ContinueWithGoogle from "@/components/continue-with-google";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { router } from "expo-router";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
          <Text className="text-foreground">Sign up to get started</Text>
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
          <Button size="lg" onPress={() => router.replace("/")}>
            Sign In
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
