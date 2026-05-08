import { HomeFilterProvider } from "@/contexts/home-filter-context";
import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function HomeStackLayout() {
  const isWeb = Platform.OS === "web";
  return (
    <HomeFilterProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: !isWeb,
          header: (props) => <ToolbarSubstackScreenHeader {...props} />,
        }}
      >
        {/* Home feed */}
        <Stack.Screen name="index" options={{ title: "Home", headerShown: false }} />

        {/* Search (child screen of Home) */}
        <Stack.Screen name="search" options={{ title: "Search" }} />
      </Stack>
    </HomeFilterProvider>
  );
}
