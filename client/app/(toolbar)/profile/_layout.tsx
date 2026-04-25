import { ToolbarSubstackScreenHeader } from "@/components/toolbar-substack-screen-header";
import { Stack } from "expo-router";
import { Platform } from "react-native";

export default function ProfileLayout() {
  const isWeb = Platform.OS === "web";
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: !isWeb,
        header: (props) => <ToolbarSubstackScreenHeader {...props} />,
      }}
    >
      <Stack.Screen name="[userId]" options={{ headerShown: false, title: "Profile" }} />
      <Stack.Screen name="collection-preview" options={{ title: "Collection" }} />
    </Stack>
  );
}
