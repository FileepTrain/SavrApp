import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";
import Button from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Filter modal state options
export type Filters = {
  budgetMin: number;
  budgetMax: number;
  allergies: string[];
  foodTypes: string[];
  cookware: string[];
};

// Filter actions
type Props = {
  visible: boolean;
  draft: Filters;
  onChangeDraft: (next: Filters) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
};

export default function FilterModal({
  visible,
  draft,
  onChangeDraft,
  onApply,
  onCancel,
  onReset,
}: Props) {
  const budgetLabel = useMemo(
    () => `$${draft.budgetMin}-${draft.budgetMax}`,
    [draft.budgetMin, draft.budgetMax]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} className="flex-1 bg-black/30 items-center justify-center px-6">
        <Pressable onPress={() => { }} className="w-full max-w-[420px] bg-background rounded-2xl overflow-hidden">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-muted-background">
            <Text className="text-xl font-bold text-foreground">Filter by</Text>
            <Pressable onPress={onCancel} hitSlop={12} className="p-2 rounded-full bg-muted-background">
              <IconSymbol name="close" size={18} color="--color-icon" />
            </Pressable>
          </View>

          <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
            {/* Budget */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-foreground">Budget Range</Text>
                <Text className="text-base text-foreground">{budgetLabel}</Text>
              </View>

              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={draft.budgetMax}
                onValueChange={(v) =>
                  onChangeDraft({
                    ...draft,
                    budgetMax: Math.max(draft.budgetMin, v),
                  })
                }
              />

              <View className="flex-row justify-between mt-1">
                <Text className="text-muted-foreground">$0</Text>
                <Text className="text-muted-foreground">$100</Text>
              </View>
            </View>

            {/* Allergies */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Allergies</Text>
              </View>
              <Pressable className="rounded-xl border border-muted-background border-dashed py-3 px-4 flex-row items-center justify-center" onPress={() => {}}>
                <Text className="text-base font-medium text-foreground">+ Add filter</Text>
              </Pressable>
            </View>

            {/* Food Types */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Food Types</Text>
              </View>
              <Pressable className="rounded-xl border border-muted-background border-dashed py-3 px-4 flex-row items-center justify-center" onPress={() => {}}>
                <Text className="text-base font-medium text-foreground">+ Add filter</Text>
              </Pressable>
            </View>

            {/* Cookware */}
            <View className="mb-2">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Cookware Types</Text>
              </View>
              <Pressable className="rounded-xl border border-muted-background border-dashed py-3 px-4 flex-row items-center justify-center" onPress={() => {}}>
                <Text className="text-base font-medium text-foreground">+ Add filter</Text>
              </Pressable>
            </View>

            {/* Buttons */}
            <View className="mt-6 gap-3 pb-2">
              <Button
                variant="default"
                className="h-14 rounded-xl"
                textClassName="text-base font-semibold text-primary"
                onPress={onApply}
              >
                Apply Filters
              </Button>

              <Button
                variant="muted"
                className="h-14 rounded-xl"
                textClassName="text-base font-semibold text-foreground"
                onPress={onReset}
              >
                Reset Filters
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}