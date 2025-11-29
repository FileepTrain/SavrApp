import { Stack } from "expo-router";

export default function RecipeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[recipeId]" />
    </Stack>
  );
}
