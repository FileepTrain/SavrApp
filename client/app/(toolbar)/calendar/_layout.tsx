// app/(toolbar)/calendar/_layout.tsx
import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { MealPlanFilterProvider } from "@/contexts/meal-plan-filter-context";
import { Stack } from "expo-router";

export default function CalendarStackLayout() {
  return (
  <MealPlanFilterProvider>
    <Stack
      screenOptions={{
        headerShown: true,
        /** Opaque header matches account stack and avoids web measurement issues with transparent headers. */
        headerTransparent: false,
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
