import React, { useEffect, useState } from "react";
import {Alert, Modal, Pressable, Text, TextInput, View,} from "react-native";

export type PantryModalItem = {
  id?: string | null;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
};

type AddPantryItemModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: PantryModalItem) => void;
  initialItem?: PantryModalItem | null;
};

export function AddPantryItemModal({
  visible,
  onClose,
  onSubmit,
  initialItem,
}: AddPantryItemModalProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [expirationDate, setExpirationDate] = useState("");

  useEffect(() => {
    if (visible) {
      setName(initialItem?.name ?? "");
      setQuantity(String(initialItem?.quantity ?? 1));
      setUnit(initialItem?.unit ?? "each");
      setExpirationDate(initialItem?.expirationDate ?? "");
    }
  }, [visible, initialItem]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const parsedQuantity = Number(quantity);

    if (!trimmedName) {
      Alert.alert("Missing item name", "Please enter an item name.");
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert("Invalid quantity", "Please enter a valid quantity.");
      return;
    }

    onSubmit({
      id: initialItem?.id ?? null,
      name: trimmedName,
      quantity: parsedQuantity,
      unit: unit.trim() || "each",
      expirationDate: expirationDate.trim() || null,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/40 items-center justify-center px-5">
        <View className="bg-background w-full rounded-3xl p-5">
          <Text className="text-2xl font-bold text-foreground mb-5">
            {initialItem ? "Edit Pantry Item" : "Add Pantry Item"}
          </Text>

          <View className="gap-4">
            <View>
              <Text className="text-foreground font-semibold mb-2">
                Item Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g., Milk"
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">
                Quantity
              </Text>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">Unit</Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="each, oz, g, cup, quart..."
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
            </View>

            <View>
              <Text className="text-foreground font-semibold mb-2">
                Expiration Date Optional
              </Text>
              <TextInput
                value={expirationDate}
                onChangeText={setExpirationDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
              <Text className="text-foreground opacity-50 text-xs mt-2">
                Example: 2026-05-01
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-6">
            <Pressable
              onPress={onClose}
              className="flex-1 bg-white rounded-xl py-4 items-center"
            >
              <Text className="text-foreground font-bold">Cancel</Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              className="flex-1 bg-red-500 rounded-xl py-4 items-center"
            >
              <Text className="text-white font-bold">
                {initialItem ? "Save" : "Add"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}