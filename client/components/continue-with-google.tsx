import { View, Text, Image } from "react-native";
import React from "react";
import Button from "./ui/button";
import { images } from "@/constants";
import {GoogleSignIn} from "@/services/googleAuth";
import AsyncStorage from "@react-native-async-storage/async-storage"
import {router} from "expo-router";

const SERVER_URL = "http://10.0.2.2:3000"

const ContinueWithGoogle = () => {
  return (
    <Button 
      size="lg"
      className="bg-white border border-muted-background"
      onPress={async () => {
        try {
          const result = await GoogleSignIn();
          // Send firebase token to backend
          const res = await fetch(`${SERVER_URL}/api/auth/oauth-login`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${result.firebaseIdToken}`,
            },
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "OAuth login failed")
          }
          // Store User Session
          await AsyncStorage.multiSet([
            ["idToken", result.firebaseIdToken],
            ["uid", data.uid],
            ["email", data.email ?? ""],
            ["username", data.username ?? ""],
            ["onboarded", data.onboarded ? "true" : "false"],
          ]);
          // Route user
          if (!data.onboarded) {
            router.replace("/onboarding");
          } else {
            router.replace("/home");
          }
        } catch (err) {
          console.error(err)
        }
      }}  
    >
      <View className="flex-row items-center gap-[10px]">
        <Image
          source={images.googleIcon}
          resizeMode="contain"
          className="w-10 h-10"
        />
        <Text className="text-black text-lg font-roboto-medium">
          Continue with Google
        </Text>
      </View>
    </Button>
  );
};

export default ContinueWithGoogle;
