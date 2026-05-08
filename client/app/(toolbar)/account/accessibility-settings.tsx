import React from 'react'
import { View } from 'react-native'
import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from '@/components/themed-safe-view'
import { useAppPreferences } from '@/contexts/app-preferences-context'
import { AccessibilitySection } from '@/components/preferences'

const AccessibilitySettingsPage = () => {
  const { themePreference, setThemePreference, textSize, setTextSize } = useAppPreferences()

  return (
    <ThemedSafeView className="flex-1 bg-app-background pt-safe-or-20">
      <AccountWebColumn className="flex-1">
        <AccountSubpageBody>
      <View className="gap-4">
        <AccessibilitySection
          value={{ themePreference, textSize }}
          onChange={(next) => {
            setThemePreference(next.themePreference);
            setTextSize(next.textSize);
          }}
        />
      </View>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  )
}

export default AccessibilitySettingsPage