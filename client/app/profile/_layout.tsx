import { IconSymbol } from "@/components/ui/icon-symbol";
import { Stack } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        header: ({ options, navigation }) => (
          <SafeAreaView className="px-4 pt-7 flex-row items-center">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <IconSymbol name="chevron-left" size={30} color="--color-foreground" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground flex-1" numberOfLines={1}>
              {options.title ?? "Profile"}
            </Text>
            {typeof options.headerRight === "function" ? (
              <View className="min-w-[52px] items-end justify-center">
                {options.headerRight({ canGoBack: navigation.canGoBack() })}
              </View>
            ) : null}
          </SafeAreaView>
        ),
      }}
    >
      <Stack.Screen name="[userId]" options={{ headerShown: false, title: "Profile" }} />
      <Stack.Screen name="collection-preview" options={{ title: "Collection" }} />
    </Stack>
  );
}
