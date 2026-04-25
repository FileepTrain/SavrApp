import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: false,
        header: (props) => <ToolbarSubstackScreenHeader {...props} />,
      }}
    >
      <Stack.Screen name="[userId]" options={{ headerShown: false, title: "Profile" }} />
      <Stack.Screen name="collection-preview" options={{ title: "Collection" }} />
    </Stack>
  );
}
