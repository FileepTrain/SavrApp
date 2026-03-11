// app/(toolbar)/calendar/_layout.tsx
import { TouchableOpacity, Text } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function CalendarStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        header: ({ options, navigation }) => (
          <SafeAreaView className="px-4 pt-7 flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <IconSymbol name="chevron-left" size={30} color="--color-foreground" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">{options.title}</Text>
          </SafeAreaView>
        ),
      }}
    >
      {/* Calendar */}
      <Stack.Screen name="index" options={{ title: "Calendar", headerShown: false }} />
      {/* Meal-plan */}
      <Stack.Screen name="meal-plan" options={{ title: "Meal Plan" }} />
      <Stack.Screen name="meal-plan-nutrient-preview" options={{ title: "Average Daily Nutrient" }} />
    </Stack>
  );
}
