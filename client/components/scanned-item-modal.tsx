import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from "react-native";

type ScannedItem = {
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: ScannedItem) => void;
  initialData: ScannedItem;
};

export function ConfirmScannedItemModal({
  visible,
  onClose,
  onSubmit,
  initialData,
}: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("each");
  const [expirationDate, setExpirationDate] = useState("");

  useEffect(() => {
    if (visible) {
      setName(initialData?.name ?? "");
      setQuantity(String(initialData?.quantity ?? 1));
      setUnit(initialData?.unit ?? "each");
      setExpirationDate(initialData?.expirationDate ?? "");
    }
  }, [visible, initialData]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    const parsedQuantity = parseFloat(quantity);

    if (!trimmedName) {
      Alert.alert("Error", "Item name is required");
      return;
    }

    if (!quantity || isNaN(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert("Error", "Enter a valid quantity");
      return;
    }

    onSubmit({
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
            Confirm Item
          </Text>

          <View className="gap-4">
            {/* Name */}
            <View>
              <Text className="text-foreground font-semibold mb-2">
                Item Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Item name"
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
            </View>

            {/* Quantity */}
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

            {/* Unit */}
            <View>
              <Text className="text-foreground font-semibold mb-2">
                Unit
              </Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="each, oz, g, etc."
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
            </View>

            {/* Expiration Date */}
            <View>
              <Text className="text-foreground font-semibold mb-2">
                Expiration Date (Optional)
              </Text>
              <TextInput
                value={expirationDate}
                onChangeText={setExpirationDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                className="bg-white rounded-xl px-4 py-3 text-foreground"
              />
              <Text className="text-xs text-muted-foreground mt-1">
                Example: 2026-05-01
              </Text>
            </View>
          </View>

          {/* Buttons */}
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
              <Text className="text-white font-bold">Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}