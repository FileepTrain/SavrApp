import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function RecipeLayout() {
  const isWeb = Platform.OS === "web";
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: !isWeb,
        header: (props) => <ToolbarSubstackScreenHeader {...props} columnVariant="recipe" />,
      }}
    >
      <Stack.Screen
        name="[recipeId]"
        options={{
          headerShown: false,
          title: "Recipe Details",
          // New id = new screen instance so a hidden tab cannot briefly show the previous recipe.
          getId: ({ params }) => {
            const r = (params as { recipeId?: string | string[] })?.recipeId;
            const raw = Array.isArray(r) ? r[0] : r;
            return raw != null && String(raw) !== "" ? String(raw) : undefined;
          },
        }}
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
