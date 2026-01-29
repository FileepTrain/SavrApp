import { Stack } from "expo-router";
import { Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        header: ({ options, navigation }) => (
          <SafeAreaView className="px-4 pt-7 flex-row items-center">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-4"
            >
              <IconSymbol name="chevron-left" size={30} color="black" />
            </TouchableOpacity>

            <Text className="text-2xl font-bold">{options.title}</Text>
          </SafeAreaView>
        ),
      }}
    >
      {/* Home feed */}
      <Stack.Screen name="index" options={{ title: "Home", headerShown: false }} />

      {/* Search (child screen of Home) */}
      <Stack.Screen name="search" options={{ title: "Search" }} />
    </Stack>
  );
}
