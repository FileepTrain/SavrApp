import { useThemePalette } from "@/components/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { WEB_TOOLBAR_SIDEBAR_WIDTH } from "@/hooks/use-web-desktop-layout";
import type { Href } from "expo-router";
import { Link, useSegments } from "expo-router";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";

type TabKey = "home" | "calendar" | "grocery-list" | "account";

const NAV_ITEMS: {
  href: Href;
  tab: TabKey;
  label: string;
  icon: "home" | "calendar-month" | "shopping-outline" | "account-outline";
}[] = [
  { href: "/(toolbar)/home", tab: "home", label: "Home", icon: "home" },
  {
    href: "/(toolbar)/calendar",
    tab: "calendar",
    label: "Calendar",
    icon: "calendar-month",
  },
  {
    href: "/(toolbar)/grocery-list",
    tab: "grocery-list",
    label: "Groceries",
    icon: "shopping-outline",
  },
  {
    href: "/(toolbar)/account",
    tab: "account",
    label: "Account",
    icon: "account-outline",
  },
];

function activeTabFromSegments(segments: string[]): TabKey {
  const tabSegment =
    segments[0] === "(toolbar)" ? segments[1] : segments[0];
  if (tabSegment === "calendar") return "calendar";
  if (tabSegment === "grocery-list") return "grocery-list";
  if (tabSegment === "account") return "account";
  // Detail stacks live next to tab routes; map to the closest primary tab for highlight.
  if (tabSegment === "recipe") return "home";
  if (tabSegment === "profile") return "account";
  // `home`, `home/search`, etc.
  return "home";
}

export function ToolbarWebSidebar() {
  const theme = useThemePalette();
  const segments = useSegments();
  const activeTab = activeTabFromSegments(segments as string[]);

  return (
    <View
      style={{
        width: WEB_TOOLBAR_SIDEBAR_WIDTH,
        minWidth: WEB_TOOLBAR_SIDEBAR_WIDTH,
        borderRightWidth: 1,
        borderRightColor: theme["--color-muted-background"],
        backgroundColor: theme["--color-background"],
        paddingTop: 28,
        paddingHorizontal: 12,
        gap: 4,
      }}
    >
      <Link href="/(toolbar)/home" asChild>
        <Pressable
          className="px-2 mb-4 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Savr"
          accessibilityHint="Go to home"
        >
          <Image
            source={require("@/assets/images/SAVR-logo.png")}
            style={{ width: 132, height: 36 }}
            resizeMode="contain"
          />
        </Pressable>
      </Link>
      {NAV_ITEMS.map((item) => {
        const active = item.tab === activeTab;
        const color = active
          ? theme["--color-red-primary"]
          : theme["--color-muted-foreground"];
        return (
          <Link key={item.tab} href={item.href} asChild>
            <Pressable
              className={`flex-row items-center gap-3 rounded-xl px-3 py-3 ${active ? "bg-muted-background" : ""}`}
            >
              <IconSymbol name={item.icon} size={26} color={color} />
              <Text
                className={`text-base font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
