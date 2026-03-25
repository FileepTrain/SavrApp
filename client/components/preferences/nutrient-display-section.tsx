import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ALL_NUTRIENTS, DEFAULT_DISPLAY_NUTRIENTS } from "@/utils/nutrients";
import Input from "@/components/ui/input";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface NutrientDisplaySectionProps {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}

export function NutrientDisplaySection({ value, onChange, error }: NutrientDisplaySectionProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const toggle = (nutrient: string) => {
    const exists = value.includes(nutrient);
    onChange(exists ? value.filter((item) => item !== nutrient) : [...value, nutrient]);
  };

  const filteredNutrients = React.useMemo(
    () => ALL_NUTRIENTS.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase().trim())),
    [searchQuery]
  );

  return (
    <View className="flex-1">
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-2">
        <Input
          className="flex-1"
          inputClassName="text-base"
          placeholder="Search nutrients"
          iconName="magnify"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} className="p-2 rounded-full bg-muted-background">
            <IconSymbol name="close" size={18} color="--color-icon" />
          </Pressable>
        )}
      </View>

      <View className="px-4 pb-3">
        <Text className="text-[14px] text-muted-foreground">
          {value.length} of {ALL_NUTRIENTS.length} nutrients selected
        </Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        <View className="gap-2 pb-4">
          {filteredNutrients.map((nutrient) => {
            const isSelected = value.includes(nutrient);
            return (
              <Pressable
                key={nutrient}
                onPress={() => toggle(nutrient)}
                className="bg-background rounded-xl flex-row items-center justify-between px-4 h-[56px] shadow-sm"
              >
                <Text className="text-foreground font-medium flex-1">{nutrient}</Text>
                <View
                  className={`w-6 h-6 rounded-[6px] border-2 items-center justify-center ${isSelected
                    ? "bg-red-primary border-red-primary"
                    : "border-muted-background bg-background"
                    }`}
                >
                  {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="px-4 pb-4 pt-2 border-t border-background">
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => onChange([...ALL_NUTRIENTS])}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">Select All</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange([])}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">Clear All</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange([...DEFAULT_DISPLAY_NUTRIENTS])}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">Default</Text>
          </Pressable>
        </View>
      </View>

      {!!error && <Text className="text-red-primary">{error}</Text>}
    </View>
  );
}
