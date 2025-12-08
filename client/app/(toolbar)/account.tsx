// app/account.tsx
import { AccountMenuItem } from "@/components/account/account-menu-item";
import { AccountProfileCard } from "@/components/account/account-profile-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";

export default function AccountPage() {
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
        name="John Doe"
        email="john.doe@email.com"
      />

      {/* Menu */}
      <View className="mt-6 mx-4 bg-white rounded-xl shadow-sm overflow-hidden">
        <AccountMenuItem
          title="My Pantry"
          subtitle="Manage your ingredients"
          iconName="kitchen"
          onPress={() => router.push("/pantry")}
        />
        <AccountMenuItem
          title="Favorited Recipes"
          subtitle="Recipes you've saved"
          iconName="favorite-border"
          onPress={() => router.push("/favorites")}
        />
        <AccountMenuItem
          title="Personal Recipes"
          subtitle="Your own creations"
          iconName="edit"
          onPress={() => router.push("/personal-recipes")}
        />
        <AccountMenuItem
          title="Settings"
          subtitle="Preferences and more"
          iconName="settings"
          isLast
          onPress={() => router.push("/settings")}
        />
      </View>
    </ThemedSafeView>
  );
}