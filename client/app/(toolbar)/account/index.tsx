import { AccountMenuItem } from "@/components/account/account-menu-item";
import { AccountProfileCard } from "@/components/account/account-profile-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";

export default function AccountPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const loadUserData = useCallback(async () => {
    const storedName = await AsyncStorage.getItem("username");
    const storedEmail = await AsyncStorage.getItem("email");

    setUsername(storedName || "Unknown User");
    setEmail(storedEmail || "Unknown Email");
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8]">
      {/* Title */}
      <View className="mt-6 px-4">
        <Text className="text-[24px] font-bold tracking-[0.5px] text-black">
          Account
        </Text>
      </View>

      {/* Profile */}
      <AccountProfileCard
        name={username ?? "Loading..."}
        email={email ?? "Loading..."}
      />

      {/* Menu */}
      <View className="mt-6 mx-4 bg-white rounded-xl shadow-sm overflow-hidden">
        <AccountMenuItem
          title="My Pantry"
          subtitle="Manage your ingredients"
          iconName="food-apple-outline"
          onPress={() => router.push("/account/pantry")}
        />

        <AccountMenuItem
          title="Favorited Recipes"
          subtitle="Recipes you've saved"
          iconName="heart-outline"
          onPress={() => router.push("/account/favorites")}
        />

        <AccountMenuItem
          title="Personal Recipes"
          subtitle="Your own creations"
          iconName="book-open-outline"
          onPress={() => router.push("/account/personal-recipes")}
        />

        <AccountMenuItem
          title="Settings"
          subtitle="Preferences and more"
          iconName="cog-outline"
          isLast
          onPress={() => router.push("/account/settings")}
        />
      </View>
    </ThemedSafeView>
  );
}
