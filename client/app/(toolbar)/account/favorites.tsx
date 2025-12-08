import { ThemedSafeView } from "@/components/themed-safe-view";
import { Text } from "react-native";

export default function FavoritesPage() {
  return (
    <ThemedSafeView className="flex-1">
      <Text className="text-[24px] font-bold mb-6">Favorited Recipes</Text>

      <Text className="text-[16px] text-gray-600">
        TODO: Display user’s saved recipes
      </Text>
    </ThemedSafeView>
  );
}
