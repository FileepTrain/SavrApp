import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { loadAllergies, loadDiets, saveAllergies, saveDiets } from "@/utils/diet-preferences";
import { DietaryPreferencesSection } from "@/components/preferences";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";

export default function DietaryPreferencesPage() {
  const [selectedAllergies, setSelectedAllergies] = useState<Set<string>>(new Set());
  const [selectedDiets, setSelectedDiets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const savedDiets = await loadDiets();
      setSelectedDiets(savedDiets);

      const savedAllergies = await loadAllergies();
      setSelectedAllergies(savedAllergies);
      setIsLoading(false);
    };

    load();
  }, []);

  return (
    <ThemedSafeView className="flex-1 bg-app-background pt-safe-or-20">
      <AccountWebColumn className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-[14px] text-muted-foreground tracking-[0.5px]">Loading…</Text>
          </View>
        ) : (
          <DietaryPreferencesSection
            selectedAllergies={[...selectedAllergies]}
            selectedDiets={[...selectedDiets]}
            onChangeAllergies={(next) => {
              const updated = new Set(next);
              setSelectedAllergies(updated);
              void saveAllergies(updated);
            }}
            onChangeDiets={(next) => {
              const updated = new Set(next);
              setSelectedDiets(updated);
              void saveDiets(updated);
            }}
          />
        )}
      </AccountWebColumn>
    </ThemedSafeView>
  );
}