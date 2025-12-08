import { HapticTab } from "@/components/haptic-tab";
import { useThemePalette } from "@/components/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  const theme = useThemePalette();

  return (
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
        name="index"
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
            <IconSymbol size={28} name="shopping-bag" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person-outline" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
