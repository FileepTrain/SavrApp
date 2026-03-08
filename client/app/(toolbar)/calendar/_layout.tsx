// app/(toolbar)/calendar/_layout.tsx
import {  TouchableOpacity } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function CalendarStackLayout() {
  return(
    <Stack
      screenOptions={{
              headerShown: true,
              headerTransparent: true,
              headerTintColor: "black",
              headerBackTitleVisible: false,
      }}
    >
      {/* Calendar */}
      <Stack.Screen name="index" options={{ title: "Calendar", headerShown: false }}/>
      {/* Meal-plan */}
      <Stack.Screen name="meal-plan" options={{ title: "Meal Plan" }}/>
      <Stack.Screen name="meal-plan-nutrient-preview" options={{ title: "Average Daily Nutrient" }}/>
    </Stack>
  );
}
