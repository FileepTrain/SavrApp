import React from 'react'
import { View } from 'react-native'
import { ThemedSafeView } from '@/components/themed-safe-view'
import { useAppPreferences } from '@/contexts/app-preferences-context'
import { AccessibilitySection } from '@/components/preferences'

const AccessibilitySettingsPage = () => {
  const { themePreference, setThemePreference, textSize, setTextSize } = useAppPreferences()

  return (
    <ThemedSafeView className="flex-1 bg-app-background pt-safe-or-20">
      <View className="gap-4">
        <AccessibilitySection
          value={{ themePreference, textSize }}
          onChange={(next) => {
            setThemePreference(next.themePreference);
            setTextSize(next.textSize);
          }}
        />
      </View>
    </ThemedSafeView>
  )
}

export default AccessibilitySettingsPage