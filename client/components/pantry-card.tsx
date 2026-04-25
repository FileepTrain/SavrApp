import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { IconSymbol } from "@/components/ui/icon-symbol";

/* Default pantry item card */
type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

type Props = {
  item: PantryItem;
  onEdit: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void | Promise<void>;
};

export function SwipeablePantryItemCard({ item, onEdit, onDelete }: Props) {
  const [loading, setLoading] = useState(false);

  /* Delete pantry item */
  const handleDelete = async () => {
    try {
      setLoading(true);
      await onDelete(item);
    } catch (err) {
      console.error("Error deleting pantry item:", err);
      Alert.alert("Error", "Failed to delete pantry item");
    } finally {
      setLoading(false);
    }
  };
  /* Render right actions with edit and delete */
  const renderRightActions = (
    _progress: unknown,
    _translation: unknown,
    swipeableMethods: { close: () => void }
  ) => (
    <View className="ml-2 flex flex-row">
      <Pressable
        onPress={() => {
          swipeableMethods.close();
          onEdit(item);
        }}
        className="bg-orange-500 justify-center items-center w-20 rounded-xl rounded-r-none gap-1"
      >
        <IconSymbol name="pencil-outline" size={28} color="--color-background" />
        <Text className="text-background text-sm font-medium">Edit</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          swipeableMethods.close();
          handleDelete();
        }}
        className="bg-red-primary justify-center items-center w-20 rounded-xl rounded-l-none gap-1"
      >
        <IconSymbol name="trash-can-outline" size={28} color="--color-background" />
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text className="text-background text-sm font-medium">Delete</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View className="bg-background rounded-xl shadow-sm p-4 mb-3">
        <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">{item.name}</Text>
        <Text className="text-[12px] text-muted-foreground tracking-[0.5px] mt-0.5">
          {item.quantity} {item.unit}
        </Text>
      </View>
    </ReanimatedSwipeable>
  );
}