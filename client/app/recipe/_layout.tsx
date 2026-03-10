import { IconSymbol } from "@/components/ui/icon-symbol";
import { Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native";
import { Text } from "react-native";

export default function RecipeLayout() {
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
            <Text className="text-2xl font-bold text-foreground">{options.title}</Text>
          </SafeAreaView>
        ),
      }}
    >
      <Stack.Screen
        name="[recipeId]"
        options={{ headerShown: false, title: "Recipe Details" }}
      />
      <Stack.Screen
        name="nutrition"
        options={{ headerShown: true, title: "Nutrition" }}
      />
      <Stack.Screen
        name="reviews"
        options={{ headerShown: true, title: "Reviews" }}
      />
      <Stack.Screen
        name="share"
        options={{ headerShown: true, title: "Share Recipe" }}
      />
    </Stack>
  );
}
