import { HapticTab } from "@/components/haptic-tab";
import { OfflineBanner } from "@/components/offline-banner";
import { useThemePalette } from "@/components/theme-provider";
import { ToolbarWebSidebar } from "@/components/toolbar-web-sidebar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MealPlanSelectionProvider } from "@/contexts/meal-plan-selection-context";
import { ToolbarHistoryProvider } from "@/contexts/toolbar-history-context";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, View } from "react-native";

export default function TabLayout() {
  const theme = useThemePalette();
  const { isWebDesktop } = useWebDesktopLayout();

  return (
    <ToolbarHistoryProvider>
      <MealPlanSelectionProvider>
        {/* OfflineBanner slides in at the top whenever the device loses connectivity */}
        <View
          className={`flex-1 bg-app-background ${Platform.OS === "web" && isWebDesktop ? "flex-row" : ""}`}
        >
          {Platform.OS === "web" && isWebDesktop ? <ToolbarWebSidebar /> : null}
          <View className="flex-1 min-w-0">
            <OfflineBanner />
            <Tabs
            tabBar={(props) =>
              isWebDesktop && Platform.OS === "web" ? null : (
                <BottomTabBar {...props} />
              )
            }
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

          {/* Detail routes: keep toolbar / sidebar shell; hidden from tab bar */}
          <Tabs.Screen name="recipe" options={{ href: null, title: "Recipe" }} />
          <Tabs.Screen name="profile" options={{ href: null, title: "Profile" }} />
            </Tabs>
          </View>
        </View>
      </MealPlanSelectionProvider>
    </ToolbarHistoryProvider>
  );
}
