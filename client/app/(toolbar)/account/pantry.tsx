import { AddPantryItemModal } from "@/components/add-pantry-pop-up";
import { ThemedSafeView } from "@/components/themed-safe-view";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function PantryPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleSubmitNewItem = (item: {
    name: string;
    quantity: string;
    unit: string;
  }) => {
    console.log("New pantry item:", item);
    // TODO: Add this item to your pantry state or send to backend
  };

  return (
    <ThemedSafeView className="flex-1">
      {/* Title */}
      <Text className="text-[24px] font-bold mb-6">My Pantry</Text>

      {/* Add Item card */}
      <Pressable
        onPress={() => setIsAddOpen(true)}
        className="absolute left-[16px] top-[120px] w-[362px] h-[81.67px] bg-white rounded-[10px]"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      >
        <View className="flex-1 items-center justify-center">
          <Text className="text-[16px] font-medium">Add Pantry Item</Text>
        </View>
      </Pressable>

      {/* Later: pantry items list goes here */}

      {/* Modal component */}
      <AddPantryItemModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleSubmitNewItem}
      />
    </ThemedSafeView>
  );
}
