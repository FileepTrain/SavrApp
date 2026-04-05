import AsyncStorage from "@react-native-async-storage/async-storage";
import { isIdTokenExpired } from "@/utils/auth-session";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

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
