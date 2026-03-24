// app/account/settings.tsx (or wherever this file lives)
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AccountMenuItem } from "@/components/account/account-menu-item";
import Button from "@/components/ui/button";


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
        <View className="my-0 gap-2">
          <Text className="text-base font-medium text-muted-foreground">Location</Text>
          {/* Location Button*/}
          <View
            className="rounded-xl shadow-sm overflow-hidden flex-row items-center justify-between px-4 h-[77px] bg-background"
          >
            {/* left side */}
            <View className="flex-row items-center gap-4">
              <View className="w-10 h-10 rounded-xl bg-muted-background items-center justify-center">
                <IconSymbol name="map-marker-outline" size={20} color="--color-foreground" />
              </View>

              <View className="gap-0.5">
                <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">
                  Share Your Location
                </Text>
                <Text className="text-[12px] text-muted-foreground tracking-[0.5px]">
                  Sharing is {locationEnabled ? "enabled" : "disabled"}
                </Text>
              </View>
            </View>

            <Switch
              style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
              trackColor={{ false: "#9c989e", true: "#2adb47" }}
              thumbColor="#ffffff"
              value={locationEnabled}
              onValueChange={toggleSwitch}
            />
          </View>
        </View>
        <View className="my-4 gap-1">
          <Text className="text-base font-medium text-muted-foreground">Notifications</Text>

          <Pressable
            onPress={() => router.push("/account/notifications")}
            className="w-full h-[77px] bg-white rounded-[12px] flex-row items-center justify-between px-4 shadow-sm"
            style={{
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 3,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center gap-4">
              <View className="w-10 h-10 rounded-[10px] bg-[#F2F2F2] items-center justify-center">
                <IconSymbol name="bell-outline" size={20} color="#666666" />
              </View>

              <View className="flex-col">
                <Text className="text-[16px] font-medium leading-6 tracking-[0.5px] text-black">
                  Notifications
                </Text>
                <Text className="text-[12px] leading-[18px] tracking-[0.5px] text-[#666666]">
                  Meal plan and calendar reminders
                </Text>
              </View>
            </View>

            <View className="w-5 h-5 items-center justify-center">
              <View className="w-3 h-3 border-r-[1.7px] border-b-[1.7px] border-[#666666] rotate-[-45deg]" />
            </View>
          </Pressable>
        </View>

        {/* Logout Button */}
        <Button
          size="lg"
          onPress={() => router.replace("/login")}
          variant="destructive"
          className="mt-auto mb-6 w-full rounded-xl"
          textClassName="font-medium text-lg">
          Log out
        </Button>
      </ScrollView>
    </ThemedSafeView >
  );
}
