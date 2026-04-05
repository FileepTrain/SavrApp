import { AccountMenuItem } from "@/components/account/account-menu-item";
import { AccountProfileCard } from "@/components/account/account-profile-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Text, View } from "react-native";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

export default function AccountPage() {
  const [username, setUsername] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  const loadUserData = useCallback(async () => {
    const [storedName, storedEmail, storedUid, idToken] = await Promise.all([
      AsyncStorage.getItem("username"),
      AsyncStorage.getItem("email"),
      AsyncStorage.getItem("uid"),
      AsyncStorage.getItem("idToken"),
    ]);

    setUsername(storedName || "Unknown User");
    setEmail(storedEmail || "Unknown Email");
    setUid(storedUid);

    if (storedUid && idToken) {
      try {
        const res = await fetch(
          `${SERVER_URL}/api/auth/users/${encodeURIComponent(storedUid)}/profile`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        const data = await res.json().catch(() => ({}));
        const raw =
          res.ok && typeof data.profilePhotoUrl === "string" ? data.profilePhotoUrl.trim() : "";
        setProfilePhotoUrl(raw.length > 0 ? raw : null);
      } catch {
        setProfilePhotoUrl(null);
      }
    } else {
      setProfilePhotoUrl(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [loadUserData])
  );

  return (
    <ThemedSafeView className="flex-1 bg-app-background">
      {/* Title */}
      <View className="px-4">
        <Text className="text-foreground text-2xl font-semibold">
          Account
        </Text>
      </View>

      {/* Profile */}
      <AccountProfileCard
        name={username ?? "Loading..."}
        email={email ?? "Loading..."}
        photoUrl={profilePhotoUrl}
        onPress={
          uid
            ? () =>
                router.push({
                  pathname: "/profile/[userId]",
                  params: { userId: uid },
                })
            : undefined
        }
      />

      {/* Menu */}
      <View className="mt-6 mx-4 rounded-xl shadow-sm overflow-hidden">
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
          title="Collections"
          subtitle="Organize saved recipes"
          iconName="folder-outline"
          onPress={() => router.push("/account/collections")}
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
