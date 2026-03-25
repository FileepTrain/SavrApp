import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

// Check if the user's auth token is expired (when first opening the app)
const isIdTokenExpired = (token: string): boolean => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const exp = typeof payload.exp === "number" ? payload.exp : 0;

    // exp is seconds since epoch.
    return exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export default function Index() {
  useEffect(() => {
    const routeUser = async () => {
      // Utilize auth info from AsyncStorage to determine redirect route
      const idToken = await AsyncStorage.getItem("idToken");

      if (!idToken || isIdTokenExpired(idToken)) {
        await AsyncStorage.multiRemove(["idToken", "uid", "username", "email", "onboarded"]);
        router.replace("/login");
        return;
      }

      const onboardedValue = await AsyncStorage.getItem("onboarded");
      const isOnboarded = onboardedValue === "true";

      router.replace(isOnboarded ? "/home" : "/onboarding");
    };

    void routeUser();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-app-background">
      <ActivityIndicator size="large" color="red" />
    </View>
  );
}
