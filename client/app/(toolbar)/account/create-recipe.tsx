import { ThemedSafeView } from "@/components/themed-safe-view";
import { Text } from "react-native";

export default function CreateRecipePage() {
  return (
    <ThemedSafeView className="flex-1">
      <Text className="text-[24px] font-bold mb-6">Create Recipe</Text>

      <Text className="text-[16px] text-gray-600">
        TODO: Add input fields, image uploader, instructions, etc.
      </Text>
    </ThemedSafeView>
  );
}
