// app/account/settings.tsx (or wherever this file lives)
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { router } from "expo-router";
import React, {useEffect, useState} from "react";
import { Image, Pressable, Text, View, Switch } from "react-native";
import profileIcon from "../../../assets/images/ProfileIcon.png";
import AsyncStorage from "@react-native-async-storage/async-storage";


async function saveLocationEnabled(enabled: boolean) {
  await AsyncStorage.setItem("LOCATION_ENABLED", enabled ? "true" : "false");
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
    <ThemedSafeView className="flex-1 bg-[#F5E7E8] px-4 pt-safe-or-20">
      {/* Edit Profile Setting Item */}
      <Pressable
        onPress={() => router.push("/account/edit-profile")}
        className="w-full h-[77px] bg-white rounded-[12px] flex-row items-center justify-between px-4 mb-6
                   shadow-sm"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        {/*icon + text box*/}
        <View className="flex-row items-center gap-4">
          {/*Icon*/}
          <Image source={profileIcon} style={{ width: 32, height: 32 }} resizeMode="contain" />


          {/*Text container*/}
          <View className="flex-col">
            <Text className="text-[16px] font-medium leading-6 tracking-[0.5px] text-black">
              Edit Profile
            </Text>
            <Text className="text-[12px] leading-[18px] tracking-[0.5px] text-[#666666]">
              Name, email, and more
            </Text>
          </View>
        </View>

        {/* Right: chevron icon substitute */}
        <View className="w-5 h-5 items-center justify-center">
          <View className="w-3 h-3 border-r-[1.7px] border-b-[1.7px] border-[#666666] rotate-[-45deg]" />
        </View>
      </Pressable>

      {/* Change Password Setting Item */}
      <Pressable
        onPress={() => router.push("/account/change-password")}
        className="w-full h-[77px] bg-white rounded-[12px] flex-row items-center justify-between px-4 mb-6
                   shadow-sm"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        {/* Left: icon + text */}
        <View className="flex-row items-center gap-4">
          {/* Icon container */}
          <View className="w-10 h-10 rounded-[10px] bg-[#F2F2F2] items-center justify-center">
            {/* Simple “settings/lock” glyph substitute */}
            <View className="w-5 h-5 border-[1.7px] border-[#666666] rounded-[4px]" />
          </View>

          {/* Text container */}
          <View className="flex-col">
            <Text className="text-[16px] font-medium leading-6 tracking-[0.5px] text-black">
              Change Password
            </Text>
            <Text className="text-[12px] leading-[18px] tracking-[0.5px] text-[#666666]">
              Update your account password
            </Text>
          </View>
        </View>

        {/* Right: chevron icon substitute */}
        <View className="w-5 h-5 items-center justify-center">
          <View className="w-3 h-3 border-r-[1.7px] border-b-[1.7px] border-[#666666] rotate-[-45deg]" />
        </View>
      </Pressable>

      {/* Cookware Settings */}
      <Pressable
        onPress={() => router.push("/account/cookware-settings")}
        className="w-full h-[77px] bg-white rounded-[12px] flex-row items-center justify-between px-4 mb-6
                   shadow-sm"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        {/*icon + text box*/}
        <View className="flex-row items-center gap-4">
          {/*Icon*/}
          <View className="w-10 h-10 rounded-[10px] bg-[#F2F2F2] items-center justify-center">
            <IconSymbol name="pot-steam-outline" size={20} color="#666666" />
          </View>

          {/*Text container*/}
          <View className="flex-col">
            <Text className="text-[16px] font-medium leading-6 tracking-[0.5px] text-black">
              My Cookware
            </Text>
            <Text className="text-[12px] leading-[18px] tracking-[0.5px] text-[#666666]">
              Select cookware you have
            </Text>
          </View>
        </View>

        {/* Right: chevron icon substitute */}
        <View className="w-5 h-5 items-center justify-center">
          <View className="w-3 h-3 border-r-[1.7px] border-b-[1.7px] border-[#666666] rotate-[-45deg]" />
        </View>
      </Pressable>

      {/* Location Button*/}
      <View className="w-full h-[77px] bg-white rounded-[12px] flex-row items-center justify-between px-4 mb-6
                   shadow-sm"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: 1 },
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        {/*icon + text box*/}
        <View className="flex-row items-center gap-4">
          {/*Icon*/}
          <View className="w-10 h-10 bg-gray-200 rounded-[12]" />

          {/*Text container*/}
          <View className="flex-col">
            <Text className="text-[16px] font-medium leading-6 tracking-[0.5px] text-black">
              Share Your Location
            </Text>
            <Text className="text-[12px] leading-[18px] tracking-[0.5px] text-[#666666]">
              Sharing is {locationEnabled ? "enabled": "disabled"}
            </Text>
          </View>
        </View>

        <Switch
          style={{transform: [{ scaleX: 1.3}, {scaleY: 1.3}] }}
          trackColor={{ false: "#9c989e", true: "#2adb47" }}
          thumbColor= "#ffffff"
          value={locationEnabled}
          onValueChange={toggleSwitch}
        />
      </View>


      {/* Logout Button */}
      <Pressable
        onPress={() => router.replace("/login")}
        className="mt-auto mb-6 w-full h-[48px] bg-[#EB2D2D] rounded-[12px]"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 4,
          elevation: 5,
        }}
      >
        <View className="flex-1 items-center justify-center">
          <Text className="text-white font-semibold text-[16px]">Log Out</Text>
        </View>
      </Pressable>
    </ThemedSafeView>
  );
}
