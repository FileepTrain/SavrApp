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
      <Stack.Screen
        name="[userId]"
        options={{
          headerShown: false,
          title: "Profile",
          getId: ({ params }) => {
            const u = (params as { userId?: string | string[] })?.userId;
            const id = Array.isArray(u) ? u[0] : u;
            return id != null && String(id) !== "" ? String(id) : undefined;
          },
        }}
      />
      <Stack.Screen name="collection-preview" options={{ title: "Collection" }} />
    </Stack>
  );
}
