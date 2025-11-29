import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";

export default function GroceryListPage() {
  return (
    <ThemedSafeView>
      <Text className="text-foreground text-2xl font-semibold">
        Grocery List
      </Text>
    </ThemedSafeView>
  );
}
