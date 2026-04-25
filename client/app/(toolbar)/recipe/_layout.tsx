import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { Stack } from "expo-router";

export default function RecipeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: false,
        header: (props) => <ToolbarSubstackScreenHeader {...props} columnVariant="recipe" />,
      }}
    >
      <Stack.Screen
        name="[recipeId]"
        options={{ headerShown: false, title: "Recipe Details" }}
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
