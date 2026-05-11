// app/(toolbar)/account/_layout.tsx
import { PersonalRecipesProvider } from "@/contexts/personal-recipes-context";
import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { useToolbarHistoryBack } from "@/contexts/toolbar-history-context";
import { Stack, useRouter } from "expo-router";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import React, { useCallback } from "react";
import { Platform } from "react-native";

function singleParam(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  return undefined;
}

/**
 * Profile → collection passes `fromProfile=1`. We must handle back before
 * `navigation.goBack()`, otherwise RN can pop the wrong navigator and land on Home.
 */
function AccountStackHeader(props: NativeStackHeaderProps) {
  const { navigation, route } = props;
  const router = useRouter();
  const backInTabHistory = useToolbarHistoryBack();

  const handleBack = useCallback(() => {
    if (backInTabHistory()) return;

    const p = (route.params ?? {}) as Record<string, unknown>;
    const collectionId = singleParam(p.collectionId);
    const ownerUid = singleParam(p.ownerUid);
    const fromProfile = singleParam(p.fromProfile);

    if (collectionId && fromProfile === "1" && ownerUid) {
      router.replace({
        pathname: "/profile/[userId]",
        params: { userId: ownerUid },
      });
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (collectionId) {
      if (ownerUid) {
        router.replace({
          pathname: "/profile/[userId]",
          params: { userId: ownerUid },
        });
        return;
      }
      router.replace("/account/collections");
      return;
    }

    router.replace("/account");
  }, [backInTabHistory, navigation, route.params, router]);

  return <ToolbarSubstackScreenHeader {...props} onPressBack={handleBack} />;
}

export default function AccountStackLayout() {
  const isWeb = Platform.OS === "web";
  return (
    <PersonalRecipesProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: !isWeb,
          header: (props) => <AccountStackHeader {...props} />,
        }}
      >
        {/* Account */}
        <Stack.Screen
          name="index"
          options={{ title: "Account", headerShown: false }}
        />
        {/* My Pantry */}
        <Stack.Screen
          name="pantry"
          options={{ title: "My Pantry" }}
        />
        {/* Favorited Recipes */}
        <Stack.Screen
          name="favorites"
          options={{ title: "Favorited Recipes" }}
        />
        {/* Personal Recipes */}
        <Stack.Screen
          name="personal-recipes"
          options={{ title: "Personal Recipes" }}
        />
        <Stack.Screen
          name="collections"
          options={{ title: "Collections" }}
        />
        <Stack.Screen
          name="recipe-history"
          options={{ title: "View History" }}
        />
        <Stack.Screen
          name="collection/[collectionId]"
          options={{ title: "Collection" }}
        />
        <Stack.Screen
          name="create-recipe"
          options={{ title: "Create New Recipe" }}
        />
        <Stack.Screen
          name="edit-recipe/[recipeId]"
          options={{ title: "Edit Recipe" }}
        />
        {/* Settings */}
        <Stack.Screen
          name="settings"
          options={{ title: "Settings" }}
        />
        <Stack.Screen
          name="change-password"
          options={{ title: "Change Password" }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ title: "Edit Profile" }}
        />
        <Stack.Screen
          name="cookware-settings"
          options={{ title: "My Cookware" }}
        />
        <Stack.Screen
          name="diet-preference-settings"
          options={{ title: "Dietary Preferences" }}
        />
        <Stack.Screen
          name="budget-preferences"
          options={{ title: "Budget Preferences" }}
        />
        <Stack.Screen
          name="accessibility-settings"
          options={{ title: "Accessibility" }}
        />
        <Stack.Screen
          name="nutrient-display-settings"
          options={{ title: "Nutrient Display" }}
        />
        <Stack.Screen
          name="notifications"
          options={{ title: "Notifications" }}
        />
      </Stack>
    </PersonalRecipesProvider>
  );
}
