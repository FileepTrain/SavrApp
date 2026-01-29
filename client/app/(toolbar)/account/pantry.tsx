import { AddIngredientModal } from "@/components/add-ingredient-modal";
import { ThemedSafeView } from "@/components/themed-safe-view";
import React, { useState } from "react";
import Button from "@/components/ui/button";
import { Ingredient } from "@/types/ingredient";

export default function PantryPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);

  const handleSubmitNewItem = (item: Ingredient) => {
    console.log("New pantry item:", item);
    // TODO: Add this item to your pantry state or send to backend
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      {/* Add Item card */}
      <Button variant="primary" icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-red-primary" }} className="h-24 rounded-xl shadow-lg" textClassName="text-xl font-bold text-red-primary" onPress={() => setIsAddOpen(true)}>
        Add Pantry Item
      </Button>

      {/* Later: pantry items list goes here */}

      {/* Modal component */}
      <AddIngredientModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleSubmitNewItem}
        title="Add Pantry Item"
        nameLabel="Item Name"
        namePlaceholder="e.g., Milk"
      />
    </ThemedSafeView>
  );
}
