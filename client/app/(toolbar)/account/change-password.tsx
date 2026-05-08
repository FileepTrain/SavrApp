// app/account/change-password.tsx
import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { SERVER_URL } from "@/utils/server-url";

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
    <ThemedSafeView className="flex-1 pt-safe-or-20 app-background">
      <AccountWebColumn className="flex-1">
        <AccountSubpageBody>
      <View className="gap-5">

        {/* Current password (For UX only) */}
        <Input
          label="Current Password"
          placeholder="Enter current password"
          inputType="password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />

        {/* New password */}
        <Input
          label="New Password"
          placeholder="Enter new password"
          inputType="password"
          value={newPassword}
          onChangeText={setNewPassword}
        />

        {/* Confirm new password */}
        <Input
          label="Confirm New Password"
          placeholder="Confirm new password"
          inputType="password"
          value={confirmNewPassword}
          onChangeText={setConfirmNewPassword}
        />
        <Button
          size="lg"
          onPress={handleChangePassword}
          disabled={loading}
          textClassName="text-[16px] font-medium tracking-[0.5px]"
        >
          {loading ? "Changing Password..." : "Change Password"}
        </Button>
      </View>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}
