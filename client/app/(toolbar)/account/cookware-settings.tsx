import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { loadUserCookware, saveUserCookware, ALL_COOKWARE_SORTED } from "@/utils/cookware";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from "react-native";
import Input from "@/components/ui/input";

export default function CookwareSettingsPage() {
  const [selectedCookware, setSelectedCookware] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const saved = await loadUserCookware();
      setSelectedCookware(saved);
      setIsLoading(false);
    };
    load();
  }, []);

  const toggleCookware = async (item: string) => {
    const updated = new Set(selectedCookware);
    if (updated.has(item)) {
      updated.delete(item);
    } else {
      updated.add(item);
    }
    setSelectedCookware(updated);
    await saveUserCookware(updated);
  };

  const filteredCookware = ALL_COOKWARE_SORTED.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      {/* Search Bar */}
      <View className="px-4 pt-4 pb-2 flex-row items-center gap-2">
        <Input
          className="flex-1"
          inputClassName="text-base"
          placeholder="Search cookware"
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
        <Text className="text-muted-foreground">
          {selectedCookware.size} of {ALL_COOKWARE_SORTED.length} cookware selected
        </Text>
      </View>

      {/* Cookware List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[16px] text-muted-foreground">Loading...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <View className="gap-2 pb-4">
            {filteredCookware.map((item) => {
              const isSelected = selectedCookware.has(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleCookware(item)}
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
      <View className="p-4 pb-2 border-t border-background">
        <View className="flex-row gap-3">
          <Pressable
            onPress={async () => {
              const all = new Set(ALL_COOKWARE_SORTED);
              setSelectedCookware(all);
              await saveUserCookware(all);
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
              setSelectedCookware(none);
              await saveUserCookware(none);
            }}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">
              Clear All
            </Text>
          </Pressable>
        </View>
      </View>
    </ThemedSafeView>
  );
}
