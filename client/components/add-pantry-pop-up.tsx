// components/pantry/add-pantry-pop-up.tsx
import { IconSymbol } from "@/components/ui/icon-symbol";
import Input from "@/components/ui/input";
import React, { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    Text,
    TouchableWithoutFeedback,
    View,
} from "react-native";

type AddPantryItemModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: { name: string; quantity: string; unit: string }) => void;
};

export function AddPantryItemModal({
  visible,
  onClose,
  onSubmit,
}: AddPantryItemModalProps) {
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  // Reset form whenever the modal opens
  useEffect(() => {
    if (visible) {
      setItemName("");
      setQuantity("");
      setUnit("");
    }
  }, [visible]);

  const handleAddItem = () => {
    onSubmit({ name: itemName, quantity, unit });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View className="flex-1 bg-[rgba(0,0,0,0.3)] items-center justify-center">
          {/* Card (stop propagation inside) */}
          <TouchableWithoutFeedback>
            <View
              className="w-[345px] h-[364px] bg-white rounded-[20px] overflow-hidden"
              style={{
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              {/* Red header */}
              <View className="w-full h-[62px] bg-[#EB2D2D] flex-row items-center justify-between px-6">
                <Text className="text-white text-[20px] font-bold tracking-[0.5px]">
                  Add Pantry Item
                </Text>

                <Pressable onPress={handleCancel}>
                  <IconSymbol name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Body */}
              <View className="flex-1 px-6 pt-6 pb-4 gap-4">
                {/* Item Name */}
                <View className="gap-2">
                  <Text className="text-[14px] text-[#666666] font-medium">
                    Item Name
                  </Text>
                  <Input
                    placeholder="e.g., Milk"
                    value={itemName}
                    onChangeText={setItemName}
                    className="w-full"
                    inputClassName="h-[52px]"
                  />
                </View>

                {/* Quantity + Unit */}
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-2">
                    <Text className="text-[14px] text-[#666666] font-medium">
                      Quantity
                    </Text>
                    <Input
                        placeholder="1"
                        value={quantity}
                        onChangeText={setQuantity}
                        inputType="number-pad"
                        className="w-full"
                        inputClassName="h-[52px]"
                        />
                  </View>

                  <View className="flex-1 gap-2">
                    <Text className="text-[14px] text-[#666666] font-medium">
                      Unit
                    </Text>
                    <Input
                      placeholder="each"
                      value={unit}
                      onChangeText={setUnit}
                      className="w-full"
                      inputClassName="h-[52px]"
                      iconName="arrow-drop-down"
                    />
                  </View>
                </View>

                {/* Buttons row */}
                <View className="flex-row gap-3 pt-2">
                  {/* Cancel */}
                  <Pressable
                    onPress={handleCancel}
                    className="flex-1 h-[52px] border-[2px] border-[#EB2D2D] rounded-[12px] items-center justify-center"
                  >
                    <Text className="text-[16px] font-bold text-[#EB2D2D]">
                      Cancel
                    </Text>
                  </Pressable>

                  {/* Add Item */}
                  <Pressable
                    onPress={handleAddItem}
                    className="flex-1 h-[52px] bg-[#EB2D2D] rounded-[12px] items-center justify-center"
                    style={{
                      shadowColor: "#000",
                      shadowOpacity: 0.15,
                      shadowRadius: 4,
                      shadowOffset: { width: 0, height: 2 },
                      elevation: 5,
                    }}
                  >
                    <Text className="text-[16px] font-bold text-white">
                      Add Item
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
