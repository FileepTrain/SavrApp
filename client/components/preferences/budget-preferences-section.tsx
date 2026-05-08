import React from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import Input from "@/components/ui/input";
import { useThemePalette } from "@/components/theme-provider";

interface BudgetPreferencesSectionProps {
  value: number;
  onChange: (next: number) => void;
}

export function BudgetPreferencesSection({ value, onChange }: BudgetPreferencesSectionProps) {
  const theme = useThemePalette();

  const handleInputChange = (rawValue: string) => {
    const numericValue = Number(rawValue.replace("$", ""));
    if (!numericValue || numericValue < 0) {
      onChange(0);
      return;
    }
    if (numericValue > 100) {
      onChange(100);
      return;
    }
    onChange(numericValue);
  };

  return (
    <View className="gap-4">
      <Text className="text-base text-muted-foreground">
        Your budget preferences are considered when searching for recipes and meal plans.
      </Text>
      <Slider
        minimumValue={0}
        maximumValue={100}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={theme["--color-foreground"]}
        thumbTintColor={theme["--color-foreground"]}
        StepMarker={({ index, min, max }) => (
          <View className="mt-4">
            {index === min ? (
              <Text className="font-medium text-muted-foreground">$0</Text>
            ) : index === max ? (
              <Text className="font-medium text-muted-foreground">$100</Text>
            ) : null}
          </View>
        )}
      />
      <Input
        inputType="numeric"
        inputClassName="text-xl self-center font-medium"
        value={`$${value}`}
        onChangeText={handleInputChange}
        placeholder="$0"
      />
    </View>
  );
}
