import { OfflineBanner } from "@/components/offline-banner";
import { useThemePalette } from "@/components/theme-provider";
import { ToolbarWebSidebar } from "@/components/toolbar-web-sidebar";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { MealPlanSelectionProvider } from "@/contexts/meal-plan-selection-context";
import {
  logToolbarNavFlow,
  ToolbarHistoryProvider,
  useToolbarPrimaryTabDoublePress,
  type ToolbarTab,
} from "@/contexts/toolbar-history-context";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs, useGlobalSearchParams, usePathname } from "expo-router";
import React, { useMemo } from "react";
import { Platform, View } from "react-native";

/** Match expo-router pathname with or without route groups for tab highlight rules. */
function pathnameForToolbarTabs(pathname: string): string {
  const raw = pathname.split("?")[0] ?? "";
  const segs = raw
    .split("/")
    .filter(Boolean)
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  if (segs.length === 0) return "/";
  return `/${segs.join("/")}`;
}

function singleToolbarQueryParam(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v) && v[0] != null && String(v[0]).trim()) return String(v[0]).trim();
  return undefined;
}

/** Routes that belong to the Home tab visually (recipe is a sibling screen with `href: null`). */
function isHomeToolbarContextPath(path: string, toolbarCtx: string | undefined): boolean {
  const p = path.split("?")[0] ?? "";
  if (!p) return false;
  if (p.startsWith("/recipe/")) {
    const t = toolbarCtx;
    if (t === "account" || t === "calendar" || t === "grocery-list") return false;
    return true;
  }
  return p === "/home" || p.startsWith("/home/");
}

/** Routes that belong to the Account tab visually (profile is a sibling screen with `href: null`). */
function isAccountToolbarContextPath(path: string, toolbarCtx: string | undefined): boolean {
  const p = path.split("?")[0] ?? "";
  if (!p) return false;
  if (p.startsWith("/recipe/")) {
    return toolbarCtx === "account";
  }
  return p === "/account" || p.startsWith("/account/") || p.startsWith("/profile/");
}

const PRIMARY_TOOLBAR_TABS = new Set<string>(["home", "calendar", "grocery-list", "account"]);

/**
 * Bottom-tab `tabPress` runs with a real `route` / `navigation` (unlike `tabBarButton`, where
 * `route.name` can be null on Android). History + `preventDefault` live here.
 */
function makeToolbarTabPressListener(
  screen: string,
  handlePrimaryTabDoublePress: (
    tab: ToolbarTab,
    isSelected: boolean,
    defaultOnPress: () => void,
  ) => boolean,
) {
  if (!PRIMARY_TOOLBAR_TABS.has(screen)) {
    return () => ({
      tabPress: () => {
        if (__DEV__) {
          console.warn("[ToolbarHistory tabPress]", screen);
        }
        logToolbarNavFlow({ kind: "TabsScreen.tabPress", screen, detailRoute: true });
      },
    });
  }
  const tab = screen as ToolbarTab;
  return ({ navigation }: { navigation: { isFocused: () => boolean } }) => ({
    tabPress: (e: { preventDefault?: () => void }) => {
      if (__DEV__) {
        console.warn("[ToolbarHistory tabPress]", tab);
      }
      logToolbarNavFlow({ kind: "TabsScreen.tabPress", screen: tab, source: "tab_listener" });
      const isSelected = navigation.isFocused();
      // When we do not consume, React Navigation performs default tab behavior (do not call preventDefault).
      const consumed = handlePrimaryTabDoublePress(tab, isSelected, () => {});
      logToolbarNavFlow({
        kind: "TabsScreen.tabPress",
        phase: "result",
        screen: tab,
        consumed,
        isSelected,
      });
      if (consumed && typeof e.preventDefault === "function") {
        e.preventDefault();
      }
    },
  });
}

export default function TabLayout() {
  return (
    <ToolbarHistoryProvider>
      <MealPlanSelectionProvider>
        <TabLayoutBody />
      </MealPlanSelectionProvider>
    </ToolbarHistoryProvider>
  );
}

function TabLayoutBody() {
  const theme = useThemePalette();
  const { isWebDesktop } = useWebDesktopLayout();
  const pathname = usePathname();
  const globalParams = useGlobalSearchParams();
  const pathKey = useMemo(() => pathnameForToolbarTabs(pathname), [pathname]);
  const recipeToolbarCtx = singleToolbarQueryParam(
    globalParams.toolbarCtx as string | string[] | undefined,
  );
  const homeToolbarActive = isHomeToolbarContextPath(pathKey, recipeToolbarCtx);
  const accountToolbarActive = isAccountToolbarContextPath(pathKey, recipeToolbarCtx);
  const { handlePrimaryTabDoublePress } = useToolbarPrimaryTabDoublePress();

  const activeTint = theme["--color-red-primary"];
  const inactiveTint = theme["--color-muted-foreground"];

  return (
    <View
      className={`flex-1 bg-app-background ${Platform.OS === "web" && isWebDesktop ? "flex-row" : ""}`}
    >
      {Platform.OS === "web" && isWebDesktop ? <ToolbarWebSidebar /> : null}
      <View className="flex-1 min-w-0">
        <OfflineBanner />
        <Tabs
          tabBar={(props) =>
            isWebDesktop && Platform.OS === "web" ? null : <BottomTabBar {...props} />
          }
          screenOptions={{
            tabBarActiveTintColor: theme["--color-red-primary"],
            headerShown: false,
            tabBarStyle: {
              backgroundColor: theme["--color-background"],
              borderTopColor: theme["--color-background"],
            },
          }}
        >
          <Tabs.Screen
            name="home"
            listeners={makeToolbarTabPressListener("home", handlePrimaryTabDoublePress)}
            options={{
              title: "Home",
              tabBarIcon: ({ focused }) => (
                <IconSymbol
                  size={28}
                  name="home"
                  color={focused || homeToolbarActive ? activeTint : inactiveTint}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="calendar"
            listeners={makeToolbarTabPressListener("calendar", handlePrimaryTabDoublePress)}
            options={{
              title: "Calendar",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="calendar-month" color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="grocery-list"
            listeners={makeToolbarTabPressListener("grocery-list", handlePrimaryTabDoublePress)}
            options={{
              title: "Grocery List",
              tabBarIcon: ({ color }) => (
                <IconSymbol size={28} name="shopping-outline" color={color} />
              ),
            }}
          />

          <Tabs.Screen
            name="account"
            listeners={makeToolbarTabPressListener("account", handlePrimaryTabDoublePress)}
            options={{
              title: "Account",
              tabBarIcon: ({ focused }) => (
                <IconSymbol
                  size={28}
                  name="account-outline"
                  color={focused || accountToolbarActive ? activeTint : inactiveTint}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="recipe"
            listeners={makeToolbarTabPressListener("recipe", handlePrimaryTabDoublePress)}
            options={{ href: null, title: "Recipe" }}
          />
          <Tabs.Screen
            name="profile"
            listeners={makeToolbarTabPressListener("profile", handlePrimaryTabDoublePress)}
            options={{ href: null, title: "Profile" }}
          />
        </Tabs>
      </View>
    </View>
  );
}
