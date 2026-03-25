import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { allergies, diets } from "@/utils/diet-preferences";
import { Collapsible } from "@/components/ui/collapsible";

interface DietaryPreferencesSectionProps {
  selectedDiets: string[];
  selectedAllergies: string[];
  onChangeDiets: (next: string[]) => void;
  onChangeAllergies: (next: string[]) => void;
}

export function DietaryPreferencesSection({
  selectedDiets,
  selectedAllergies,
  onChangeDiets,
  onChangeAllergies,
}: DietaryPreferencesSectionProps) {
  const toggleDiet = (id: string) => {
    const exists = selectedDiets.includes(id);
    onChangeDiets(exists ? selectedDiets.filter((v) => v !== id) : [...selectedDiets, id]);
  };

  const toggleAllergy = (id: string) => {
    const exists = selectedAllergies.includes(id);
    onChangeAllergies(exists ? selectedAllergies.filter((v) => v !== id) : [...selectedAllergies, id]);
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 16 }}>
        <Collapsible title="Allergies">
          {allergies.map((item) => {
            const isSelected = selectedAllergies.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() => toggleAllergy(item)}
                className="bg-background rounded-xl flex-row items-center justify-between px-4 h-[56px] shadow-sm mb-2"
              >
                <Text className="text-foreground font-medium flex-1">{item}</Text>
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
        </Collapsible>

        <Collapsible title="Diets">
          {diets.map((item) => {
            const isSelected = selectedDiets.includes(item);
            return (
              <Pressable
                key={item}
                onPress={() => toggleDiet(item)}
                className="bg-background rounded-xl flex-row items-center justify-between px-4 h-[56px] shadow-sm mb-2"
              >
                <Text className="text-foreground font-medium flex-1">{item}</Text>
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
        </Collapsible>
      </ScrollView>
    </View>
  );
}
