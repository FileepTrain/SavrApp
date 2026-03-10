import { ThemedSafeView } from "@/components/themed-safe-view";
import { View, Text } from "react-native";

export default function ShareRecipePage() {
  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <Text className="text-xl font-bold text-foreground">Share Recipe Page</Text>
      <Text className="mt-2 text-muted-foreground">This page will show sharing options.</Text>
    </ThemedSafeView>
  );
}
