import { ThemedSafeView } from "@/components/themed-safe-view";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function PersonalRecipesPage() {
  return (
    <ThemedSafeView className="flex-1">
      <Text className="text-[24px] font-bold mb-6">Personal Recipes</Text>

      {/* New Recipe Button */}
      <Pressable
        onPress={() => router.push("/account/create-recipe")}
        className="absolute left-[16px] top-[120px] w-[362px] h-[81.67px] bg-white rounded-[10px] px-[86]"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      >
        <View className="flex-1 justify-center">
          <Text className="text-[16px] font-medium">Create New Recipe</Text>
        </View>
      </Pressable>
    </ThemedSafeView>
  );
}
