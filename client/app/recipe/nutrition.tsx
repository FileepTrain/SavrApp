import { ThemedSafeView } from "@/components/themed-safe-view";
import { View, Text } from "react-native";

export default function NutritionPage() {
  return (
    <ThemedSafeView className="flex-1 p-6">
      <Text className="text-xl font-bold">Nutrition Page</Text>
      <Text className="mt-2">This will contain nutrition facts.</Text>
    </ThemedSafeView>
  );
}
