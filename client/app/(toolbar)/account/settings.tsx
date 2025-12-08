import { ThemedSafeView } from "@/components/themed-safe-view";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function SettingsPage() {
  return (
    <ThemedSafeView className="flex-1">

      <Text className="text-[24px] font-bold mb-6">Settings</Text>

      {/* Logout Button */}
      <Pressable
        onPress={() => router.replace("/login")}
        className="absolute left-[12px] top-[687px] w-[361px] h-[48px] bg-[#EB2D2D] rounded-[12px] shadow"
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
