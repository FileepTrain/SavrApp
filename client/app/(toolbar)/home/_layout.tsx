import { HomeFilterProvider } from "@/contexts/home-filter-context";
import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { Stack } from "expo-router";

export default function HomeStackLayout() {
  return (
    <HomeFilterProvider>
      <Stack
        screenOptions={{
          headerShown: true,
          headerTransparent: false,
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
