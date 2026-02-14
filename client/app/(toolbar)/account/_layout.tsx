// app/(toolbar)/account/_layout.tsx
import { router, Stack } from "expo-router";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AccountStackLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        header: ({ options, navigation }) => (
          <SafeAreaView className="px-4 pt-7 flex-row items-center">
            <TouchableOpacity onPress={() => navigation.popToTop()} className="mr-4">
              <IconSymbol name="chevron-left" size={30} color="black" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold">{options.title}</Text>
          </SafeAreaView>
        ),
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
    </Stack>
  );
}
