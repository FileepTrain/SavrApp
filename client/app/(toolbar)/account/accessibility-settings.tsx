import React from 'react'
import { View, Text } from 'react-native'
import { ThemedSafeView } from '@/components/themed-safe-view'
import Slider from '@react-native-community/slider'
import Button from '@/components/ui/button'
import RadioButton from '@/components/ui/radio-button'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { useAppPreferences } from '@/contexts/app-preferences-context'
import { useThemePalette } from '@/components/theme-provider'

const AccessibilitySettingsPage = () => {
  const { themePreference, setThemePreference, textSize, setTextSize } = useAppPreferences()
  const theme = useThemePalette();

  return (
    <ThemedSafeView className="flex-1 bg-app-background pt-safe-or-20">
      <View className="gap-4">

        {/* Change Text Size */}
        <View >

          <Text className="text-lg font-medium text-foreground">Text Size</Text>
          <Slider
            minimumValue={1}
            maximumValue={5}
            step={1}
            value={textSize}
            onValueChange={(value) => setTextSize(value)}
            minimumTrackTintColor={theme["--color-foreground"]}
            thumbTintColor={theme["--color-foreground"]}
            StepMarker={({ index, min, max }) => <View className="mt-4">
              {index === min ? <IconSymbol name="format-letter-case" size={20} color="--color-foreground" /> : index === max ? <IconSymbol name="format-letter-case" size={30} color="--color-foreground" /> : null}
            </View>}
          />
        </View>

        {/* Change Theme */}
        <Text className="mt-4 text-lg font-medium text-foreground">Theme</Text>
        <View className="flex-row gap-4">
          <View className="flex-1 items-center gap-2 border border-muted-background bg-background rounded-xl p-4">
            <IconSymbol name="weather-sunny" size={64} color="--color-red-secondary" />
            <RadioButton label="Light" selected={themePreference === "light"} onPress={() => setThemePreference("light")} />
          </View>
          <View className="flex-1 items-center gap-2 border border-muted-background bg-background rounded-xl p-4">
            <IconSymbol name="weather-night" size={64} color="--color-red-secondary" />
            <RadioButton label="Dark" selected={themePreference === "dark"} onPress={() => setThemePreference("dark")} />
          </View>
          <View className="flex-1 items-center gap-2 border border-muted-background bg-background rounded-xl p-4">
            <IconSymbol name="lightbulb-outline" size={64} color="--color-red-secondary" />
            <RadioButton label="System" selected={themePreference === "system"} onPress={() => setThemePreference("system")} />
          </View>
        </View>
      </View>
    </ThemedSafeView>
  )
}

export default AccessibilitySettingsPage