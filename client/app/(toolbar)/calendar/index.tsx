// app/(toolbar)/calendar/index.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import { StyleSheet, Text, View, Button } from "react-native";
import React, { useEffect, useState } from "react";
import { router } from "expo-router";
import { usePathname, useSegments } from "expo-router";

export default function CalendarPage() {
  return (
    <ThemedSafeView>
      <View className="gap-4 flex-1 px-4">

        <Text className="text-foreground text-2xl font-semibold">Calendar</Text>

        {/* temp button */}
        <View className="flex-row items-center">
          <Button title="Meal Plan" onPress={() => router.push("/calendar/meal-plan")} />
        </View>
      </View>
    </ThemedSafeView>
  );
}