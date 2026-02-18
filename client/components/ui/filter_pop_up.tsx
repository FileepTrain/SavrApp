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
};

// Filter options
const ALLERGY_OPTIONS = ["Dairy", "Gluten", "Egg", "Peanut", "Soy", "Seafood"];
const FOODTYPE_OPTIONS = ["Pasta", "Chicken", "Beef", "Vegetarian", "Vegan", "Dessert"];
const COOKWARE_OPTIONS = ["Air Fryer", "Oven", "Stovetop", "Slow Cooker", "Instant Pot"];

function toggleInList(list: string[], value: string) {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

// Filter UI
function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-2 rounded-xl border ${
        selected
          ? "bg-black border-black"
          : "bg-white border-muted-background"
      }`}
      style={{ alignSelf: "flex-start" }}
    >
      <Text className={selected ? "text-white font-medium" : "text-foreground"}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function FilterModal({
  visible,
  draft,
  onChangeDraft,
  onApply,
  onCancel,
}: Props) {
  const budgetLabel = useMemo(
    () => `$${draft.budgetMin}-${draft.budgetMax}`,
    [draft.budgetMin, draft.budgetMax]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} className="flex-1 bg-black/30 items-center justify-center px-6">
        <Pressable onPress={() => {}} className="w-full max-w-[420px] bg-white rounded-2xl overflow-hidden">
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

              <View className="flex-row flex-wrap gap-2">
                {ALLERGY_OPTIONS.map((a) => (
                  <Chip
                    key={a}
                    label={a}
                    selected={draft.allergies.includes(a)}
                    onPress={() =>
                      onChangeDraft({
                        ...draft,
                        allergies: toggleInList(draft.allergies, a),
                      })
                    }
                  />
                ))}
              </View>
            </View>

            {/* Food Types */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Food Types</Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {FOODTYPE_OPTIONS.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={draft.foodTypes.includes(t)}
                    onPress={() =>
                      onChangeDraft({
                        ...draft,
                        foodTypes: toggleInList(draft.foodTypes, t),
                      })
                    }
                  />
                ))}
              </View>
            </View>

            {/* Cookware */}
            <View className="mb-2">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Cookware Types</Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                {COOKWARE_OPTIONS.map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    selected={draft.cookware.includes(c)}
                    onPress={() =>
                      onChangeDraft({
                        ...draft,
                        cookware: toggleInList(draft.cookware, c),
                      })
                    }
                  />
                ))}
              </View>
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
                onPress={onCancel}
              >
                Cancel
              </Button>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}