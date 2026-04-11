import { HapticTab } from "@/components/haptic-tab";
import { OfflineBanner } from "@/components/offline-banner";
import { useThemePalette } from "@/components/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MealPlanSelectionProvider } from "@/contexts/meal-plan-selection-context";
import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";

export default function TabLayout() {
  const theme = useThemePalette();

  return (
    <MealPlanSelectionProvider>
      {/* OfflineBanner slides in at the top whenever the device loses connectivity */}
      <View className="flex-1 bg-app-background">
        <OfflineBanner />
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: theme["--color-red-primary"],
            headerShown: false,
            tabBarButton: HapticTab,
            tabBarStyle: {
              backgroundColor: theme["--color-background"],
              borderTopColor: theme["--color-background"],
            },
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: "Home",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="home" color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="calendar"
            options={{
              title: "Calendar",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="calendar-month" color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="grocery-list"
            options={{
              title: "Grocery List",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="shopping-outline" color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="account"
            options={{
              title: "Account",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="account-outline" color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </MealPlanSelectionProvider>
  );
}
