import { StyleSheet, Text, View } from "react-native";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";

export default function CalendarPage() {
  return (
    <ThemedSafeView>
      <Text className="text-[24px] font-bold text-foreground">
        Calendar
      </Text>
    </ThemedSafeView>
  );
}
