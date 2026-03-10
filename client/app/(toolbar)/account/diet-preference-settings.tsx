import { ThemedSafeView } from "@/components/themed-safe-view";
import { loadAllergies, loadDiets, saveAllergies, saveDiets, diets, allergies } from "@/utils/diet-preferences";
import { Collapsible } from "@/components/ui/collapsible";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";

export default function DietaryPreferencesPage() {
  const [selectedAllergies, setSelectedAllergies] = useState<Set<string>>(new Set());
  const [selectedDiets, setSelectedDiets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const toggleAllergy = async (item: string) => {
    setSelectedAllergies(prev => {
      const updated = new Set(prev);
      if (updated.has(item)) updated.delete(item);
      else updated.add(item);

      saveAllergies(updated);
      return updated;
    });
  };

  const toggleDiet = async (item: string) => {
    setSelectedDiets(prev => {
      const updated = new Set(prev);
      if (updated.has(item)) updated.delete(item);
      else updated.add(item);

      saveDiets(updated);
      return updated;
    });
  };

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
    <ThemedSafeView className="flex-1 bg-[#F5E7E8] pt-safe-or-20">
      {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-[16px] text-[#666666]">Loading...</Text>
          </View>
      ) : (
      <ScrollView className="flex-1 px-4" contentContianerStyle={{ paddingBottom: 16 }}>
        <Collapsible title="Allergies">
          {allergies.map((item) => {
            const isSelected = selectedAllergies.has(item);

            return (
              <Pressable
                key={item}
                onPress={() => toggleAllergy(item)}
                className="bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm mb-2"
              >
                <Text className="text-[16px] font-medium text-black flex-1">
                  {item}
                </Text>

                {/* Checkbox */}
                <View
                  className={`w-6 h-6 rounded-[6px] border-2 items-center justify-center ${
                    isSelected
                      ? "bg-red-primary border-red-primary"
                      : "border-[#CCCCCC] bg-white"
                  }`}
                >
                  {isSelected && (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Collapsible>

        <Collapsible title="Diets">
          {diets.map((item) => {
            const isSelected = selectedDiets.has(item);

            return(
              <Pressable
                key={item}
                onPress={() => toggleDiet(item)}
                className="bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm mb-2"
              >
                <Text className="text-[16px] font-medium text-black flex-1">
                  {item}
                </Text>

                {/* Checkbox */}
                <View
                  className={`w-6 h-6 rounded-[6px] border-2 items-center justify-center ${
                    isSelected
                      ? "bg-red-primary border-red-primary"
                      : "border-[#CCCCCC] bg-white"
                  }`}
                >
                  {isSelected && (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  )}
                </View>
              </Pressable>
            )
          })}
        </Collapsible>
      </ScrollView>
      )}
    </ThemedSafeView>
  );
}