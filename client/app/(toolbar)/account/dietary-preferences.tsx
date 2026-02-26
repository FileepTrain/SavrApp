import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Collapsible } from "@/components/ui/collapsible";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

const allergies = [
  "Gluten",
  "Egg",
  "Fish",
  "Peanut",
  "Treenuts",
  "Soy",
  "Sesame",
  "Wheat",
  "Shellfish",
  "Milk",
];

const diets = [
  "Keto",
  "Vegan",
  "Vegetarian",
  "Paleo",
  "Mediterranean",
  "Atkins",
  "DASH",
  "Pescatarian",

];

export default function DietaryPreferencesPage() {
  const [selectedAllergies, setSelectedAllergies] = useState<Set<string>>(new Set());
  const [selectedDiets, setSelectedDiets] = useState<Set<string>>(new Set());

  const toggleAllergy = async (item: string) => {
    const updated = new Set(selectedAllergies);
    if (updated.has(item)) updated.delete(item);
    else updated.add(item);
    setSelectedAllergies(updated);
  
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/update-allergies`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allergies: Array.from(updated) }),
      });
      if (!res.ok) console.warn("Failed to save allergies", await res.json());
    } catch (e) {
      console.warn("Error saving allergies", e);
    }
  };

  const toggleDiet = async (item: string) => {
    const updated = new Set(selectedDiets);
    if (updated.has(item)) updated.delete(item);
    else updated.add(item);
    setSelectedDiets(updated);
  
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/update-diets`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ diets: Array.from(updated) }),
      });
      if (!res.ok) console.warn("Failed to save diets", await res.json());
    } catch (e) {
      console.warn("Error saving diets", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
  
    async function load() {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
  
      try {
        const headers = {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        };
  
        const [allergiesRes, dietsRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/auth/get-allergies`, { method: "GET", headers }),
          fetch(`${SERVER_URL}/api/auth/get-diets`, { method: "GET", headers }),
        ]);
  
        if (cancelled) return;
        if (allergiesRes.ok) {
          const data = await allergiesRes.json();
          if (data.success && Array.isArray(data.allergies)) {
            setSelectedAllergies(new Set(data.allergies));
          }
        }
        if (dietsRes.ok) {
          const data = await dietsRes.json();
          if (data.success && Array.isArray(data.diets)) {
            setSelectedDiets(new Set(data.diets));
          }
        }
      } catch (e) {
        if (!cancelled) console.warn("Failed to load dietary preferences", e);
      }
    }
  
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8] pt-safe-or-20">
      <ScrollView className="flex-1 px-4">
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
    </ThemedSafeView>
  );
}