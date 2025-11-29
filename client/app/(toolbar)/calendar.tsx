import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";

export default function CalendarPage() {
  return (
    <ThemedSafeView>
      <Text className="text-foreground text-2xl font-semibold">Calendar</Text>
    </ThemedSafeView>
  );
}
