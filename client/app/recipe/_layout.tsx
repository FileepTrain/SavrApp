import { Stack } from "expo-router";

export default function RecipeLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[recipeId]"
        options={{ headerShown: true, title: "Recipe Details" }}
      />
      <Stack.Screen
        name="nutrition"
        options={{ headerShown: true, title: "Nutrition" }}
      />
      <Stack.Screen
        name="reviews"
        options={{ headerShown: true, title: "Reviews" }}
      />
      <Stack.Screen
        name="share"
        options={{ headerShown: true, title: "Share Recipe" }}
      />
    </Stack>
  );
}
