import { ThemedSafeView } from "@/components/themed-safe-view";
import { View, Text } from "react-native";

export default function ShareRecipePage() {
  return (
    <ThemedSafeView className="flex-1 p-6">
      <Text className="text-xl font-bold">Share Recipe</Text>
      <Text className="mt-2">This page will show sharing options.</Text>
    </ThemedSafeView>
  );
}
