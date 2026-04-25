// app/(toolbar)/calendar/_layout.tsx
import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { MealPlanFilterProvider } from "@/contexts/meal-plan-filter-context";
import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function CalendarStackLayout() {
  const isWeb = Platform.OS === "web";
  return (
  <MealPlanFilterProvider>
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: !isWeb,
        header: (props) => <ToolbarSubstackScreenHeader {...props} />,
      }}
    >
      {/* Calendar */}
      <Stack.Screen name="index" options={{ title: "Calendar", headerShown: false }} />
      {/* Meal-plan */}
      <Stack.Screen name="meal-plan" options={{ title: "Meal Plan" }} />
      <Stack.Screen name="meal-plan-nutrient-preview" options={{ title: "Average Daily Nutrient" }} />
    </Stack>
  </MealPlanFilterProvider>
  );
}
