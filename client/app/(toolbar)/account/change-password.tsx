// app/account/change-password.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const idToken = await AsyncStorage.getItem("idToken");

      if (!idToken) {
        Alert.alert(
          "Session expired",
          "Please log in again to change your password.",
          [{ text: "OK", onPress: () => router.replace("/login") }]
        );
        return;
      }

      const res = await fetch(`${SERVER_URL}/api/auth/update-account`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          password: newPassword, // backend treats this as new password
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      Alert.alert("Success", "Your password has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8] pt-safe-or-20">
      {/* Form container */}
      <View className="px-4 gap-6">
        {/* Current password (for UX only) */}
        <View className="gap-2">
          <Text className="text-[14px] text-[#1E1E1E]">Current Password</Text>
          <View className="bg-[#F2F2F2] rounded-[28px] px-5">
            <Input
              label=""
              placeholder="Enter current password"
              inputType="password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
          </View>
        </View>

        {/* New password */}
        <View className="gap-2">
          <Text className="text-[14px] text-[#1E1E1E]">New Password</Text>
          <View className="bg-[#F2F2F2] rounded-[28px] px-5">
            <Input
              label=""
              placeholder="Enter new password"
              inputType="password"
              value={newPassword}
              onChangeText={setNewPassword}
            />
          </View>
        </View>

        {/* Confirm new password */}
        <View className="gap-2">
          <Text className="text-[14px] text-[#1E1E1E]">
            Confirm New Password
          </Text>
          <View className="bg-[#F2F2F2] rounded-[28px] px-5">
            <Input
              label=""
              placeholder="Confirm new password"
              inputType="password"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
            />
          </View>
        </View>

        {/* Change Password button */}
        <View className="mt-4">
          <Button
            size="lg"
            onPress={handleChangePassword}
            disabled={loading}
            className="rounded-full bg-[#FFB0B2]"
          >
            {loading ? "Changing Password..." : "Change Password"}
          </Button>
        </View>
      </View>
    </ThemedSafeView>
  );
}
