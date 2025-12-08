// app/(toolbar)/account/_layout.tsx
import { Stack } from "expo-router";

export default function AccountStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: "Account" }}
      />
      <Stack.Screen
        name="pantry"
        options={{ title: "My Pantry" }}
      />
      <Stack.Screen
        name="favorites"
        options={{ title: "Favorited Recipes" }}
      />
      <Stack.Screen
        name="personal-recipes"
        options={{ title: "Personal Recipes" }}
      />
      <Stack.Screen
        name="create-recipe"
        options={{ title: "Create Recipe" }}
      />
      <Stack.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Stack>
  );
}
