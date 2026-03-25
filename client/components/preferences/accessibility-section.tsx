import React from "react";
import { Text, View } from "react-native";
import Slider from "@react-native-community/slider";
import RadioButton from "@/components/ui/radio-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { UserPreferencesDraft } from "./types";

type AccessibilityValue = UserPreferencesDraft["accessibility"];

interface AccessibilitySectionProps {
  value: AccessibilityValue;
  onChange: (next: AccessibilityValue) => void;
}

export function AccessibilitySection({ value, onChange }: AccessibilitySectionProps) {
  const theme = useThemePalette();

  return (
    <View className="gap-4">
      <Text className="text-lg font-medium text-foreground">Text Size</Text>
      <Slider
        minimumValue={1}
        maximumValue={5}
        step={1}
        value={value.textSize}
        onValueChange={(textSize) => onChange({ ...value, textSize })}
        minimumTrackTintColor={theme["--color-foreground"]}
        thumbTintColor={theme["--color-foreground"]}
        StepMarker={({ index, min, max }) => (
          <View className="mt-4">
            {index === min ? (
              <IconSymbol name="format-letter-case" size={20} color="--color-foreground" />
            ) : index === max ? (
              <IconSymbol name="format-letter-case" size={30} color="--color-foreground" />
            ) : null}
          </View>
        )}
      />

      <Text className="mt-4 text-lg font-medium text-foreground">Theme</Text>
      <View className="flex-row gap-4">
        <View className="flex-1 items-center gap-2 border border-muted-background bg-background rounded-xl p-4">
          <IconSymbol name="weather-sunny" size={64} color="--color-red-secondary" />
          <RadioButton
            label="Light"
            selected={value.themePreference === "light"}
            onPress={() => onChange({ ...value, themePreference: "light" })}
          />
        </View>
        <View className="flex-1 items-center gap-2 border border-muted-background bg-background rounded-xl p-4">
          <IconSymbol name="weather-night" size={64} color="--color-red-secondary" />
          <RadioButton
            label="Dark"
            selected={value.themePreference === "dark"}
            onPress={() => onChange({ ...value, themePreference: "dark" })}
          />
        </View>
        <View className="flex-1 items-center gap-2 border border-muted-background bg-background rounded-xl p-4">
          <IconSymbol name="lightbulb-outline" size={64} color="--color-red-secondary" />
          <RadioButton
            label="System"
            selected={value.themePreference === "system"}
            onPress={() => onChange({ ...value, themePreference: "system" })}
          />
        </View>
      </View>
    </View>
  );
}
