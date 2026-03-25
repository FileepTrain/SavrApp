// app/account/settings.tsx (or wherever this file lives)
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccountMenuItem } from "@/components/account/account-menu-item";
import Button from "@/components/ui/button";
import { LocationSharingSection } from "@/components/preferences";


async function saveLocationEnabled(enabled: boolean) {
  await AsyncStorage.setItem("LOCATION_ENABLED", enabled ? "true" : "false");
  console.log("Location enabled =", enabled);
}

async function getLocationEnabled() {
  const value = await AsyncStorage.getItem("LOCATION_ENABLED");
  return value === "true";
}

export default function SettingsPage() {
  const [locationEnabled, setLocationEnabled] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      const value = await AsyncStorage.getItem("LOCATION_ENABLED");
      setLocationEnabled(value === "true");
    };

    loadSetting();
  }, []);

  const toggleSwitch = async (value: boolean) => {
    setLocationEnabled(value);
    await saveLocationEnabled(value);
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["idToken", "uid", "username", "email", "onboarded"]);
    router.replace("/login");
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <ScrollView className="px-4 h-full">
        <View className="gap-2">
          <Text className="text-base font-medium text-muted-foreground">Account</Text>
          <View className="rounded-xl shadow-sm overflow-hidden">
            {/* Edit Profile Setting Item */}
            <AccountMenuItem
              title="Edit Profile"
              subtitle="Name, email, and more"
              iconName="account-outline"
              onPress={() => router.push("/account/edit-profile")}
            />
            {/* Change Password Setting Item */}
            <AccountMenuItem
              title="Change Password"
              subtitle="Update your account password"
              iconName="lock-outline"
              onPress={() => router.push("/account/change-password")}
            />
            {/* My Cookware Setting Item */}
            <AccountMenuItem
              title="My Cookware"
              subtitle="Select cookware you have"
              iconName="pot-steam-outline"
              onPress={() => router.push("/account/cookware-settings")}
            />
            {/* Dietary Preferences Setting Item */}
            <AccountMenuItem
              title="Dietary Preferences"
              subtitle="Vegetarian, Vegan, Allergies?"
              iconName="silverware"
              onPress={() => router.push("/account/diet-preference-settings")}
            />
            {/* Budget Preferences Setting Item */}
            <AccountMenuItem
              title="Budget Preferences"
              subtitle="Set your spending limit"
              iconName="currency-usd"
              onPress={() => router.push("/account/budget-preferences")}
              isLast
            />
          </View>
          <View className="mt-4 gap-1">
            <Text className="text-base font-medium text-muted-foreground">Display</Text>
            {/* Accessibility Setting Item */}
            <View className="rounded-xl shadow-sm overflow-hidden">
              <AccountMenuItem
                title="Accessibility"
                subtitle="Adjust app styling"
                iconName="human-handsup"
                onPress={() => router.push("/account/accessibility-settings")}
              />
              {/* Nutrient Display Settings */}
              <AccountMenuItem
                title="Nutrient Display"
                subtitle="Choose which nutrients to show"
                iconName="invoice-list-outline"
                onPress={() => router.push("/account/nutrient-display-settings")}
                isLast
              />
            </View>
          </View>
        </View>
        <View className="mt-4 gap-1">
          <Text className="text-base font-medium text-muted-foreground">Location</Text>
          <LocationSharingSection value={locationEnabled} onChange={toggleSwitch} />
        </View>
        <View className="mt-4 mb-6 gap-1">
          <Text className="text-base font-medium text-muted-foreground">Notifications</Text>
          {/* Notification Settings Item */}
          <View className="rounded-xl shadow-sm overflow-hidden">
            <AccountMenuItem
              title="Notification Settings"
              subtitle="Meal plan and calendar reminders"
              iconName="bell-outline"
              onPress={() => router.push("/account/notifications")}
              isLast
            />
          </View>
        </View>

        {/* Logout Button */}
        <Button
          size="lg"
          onPress={handleLogout}
          variant="destructive"
          className="mt-auto mb-6 w-full rounded-xl"
          textClassName="font-medium text-lg">
          Log out
        </Button>
      </ScrollView>
    </ThemedSafeView >
  );
}
