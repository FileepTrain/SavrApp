import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  ALL_NUTRIENTS,
  DEFAULT_DISPLAY_NUTRIENTS,
  loadNutrientDisplayPrefs,
  saveNutrientDisplayPrefs,
} from "@/utils/nutrients";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";
import Input from "@/components/ui/input";

const ALL_NUTRIENTS_LIST = [...ALL_NUTRIENTS];

export default function NutrientDisplaySettingsPage() {
  const [selectedNutrients, setSelectedNutrients] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
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

  const toggleNutrient = async (item: string) => {
    const updated = new Set(selectedNutrients);
    if (updated.has(item)) {
      updated.delete(item);
    } else {
      updated.add(item);
    }
    setSelectedNutrients(updated);
    await saveNutrientDisplayPrefs(updated);
  };

  const filteredNutrients = ALL_NUTRIENTS_LIST.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      {/* Search Bar */}
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-2">
        <Input
          className="flex-1"
          inputClassName="text-base"
          placeholder="Search nutrients"
          iconName="magnify"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} className="p-2 rounded-full bg-muted-background">
            <IconSymbol name="close" size={18} color="--color-icon" />
          </Pressable>
        )}
      </View>

      {/* Stats */}
      <View className="px-4 pb-3">
        <Text className="text-[14px] text-muted-foreground">
          {selectedNutrients.size} of {ALL_NUTRIENTS_LIST.length} nutrients
          selected
        </Text>
      </View>

      {/* Nutrient List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[16px] text-muted-foreground">Loading...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <View className="gap-2 pb-4">
            {filteredNutrients.map((item) => {
              const isSelected = selectedNutrients.has(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleNutrient(item)}
                  className="bg-background rounded-xl flex-row items-center justify-between px-4 h-[56px] shadow-sm"
                >
                  <Text className="text-foreground font-medium flex-1">
                    {item}
                  </Text>
                  <View
                    className={`w-6 h-6 rounded-[6px] border-2 items-center justify-center ${isSelected
                      ? "bg-red-primary border-red-primary"
                      : "border-muted-background bg-background"
                      }`}
                  >
                    {isSelected && (
                      <Text className="text-foreground text-xs font-bold">✓</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Quick Actions */}
      <View className="px-4 pb-4 pt-2 border-t border-background">
        <View className="flex-row gap-3">
          <Pressable
            onPress={async () => {
              const all = new Set(ALL_NUTRIENTS_LIST);
              setSelectedNutrients(all);
              await saveNutrientDisplayPrefs(all);
            }}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">
              Select All
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              const none = new Set<string>();
              setSelectedNutrients(none);
              await saveNutrientDisplayPrefs(none);
            }}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">
              Clear All
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              const defaultSet = new Set(DEFAULT_DISPLAY_NUTRIENTS);
              setSelectedNutrients(defaultSet);
              await saveNutrientDisplayPrefs(defaultSet);
            }}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">
              Default
            </Text>
          </Pressable>
        </View>
      </View>
    </ThemedSafeView>
  );
}
