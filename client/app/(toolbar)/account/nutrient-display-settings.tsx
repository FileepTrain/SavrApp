import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import {
  loadNutrientDisplayPrefs,
  saveNutrientDisplayPrefs,
} from "@/utils/nutrients";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { NutrientDisplaySection } from "@/components/preferences";

export default function NutrientDisplaySettingsPage() {
  const [selectedNutrients, setSelectedNutrients] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const saved = await loadNutrientDisplayPrefs();
      setSelectedNutrients(saved);
      setIsLoading(false);
    };
    load();
  }, []);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <AccountWebColumn className="flex-1">
        <AccountSubpageBody>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[14px] text-muted-foreground tracking-[0.5px]">Loading…</Text>
        </View>
      ) : (
        <NutrientDisplaySection
          value={[...selectedNutrients]}
          onChange={(next) => {
            const updated = new Set(next);
            setSelectedNutrients(updated);
            void saveNutrientDisplayPrefs(updated);
          }}
        />
      )}
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}
