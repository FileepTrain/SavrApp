import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ALL_COOKWARE_SORTED } from "@/utils/cookware";
import Input from "@/components/ui/input";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface MyCookwareSectionProps {
  value: string[];
  onChange: (next: string[]) => void;
  isLoading?: boolean;
}

export function MyCookwareSection({ value, onChange, isLoading = false }: MyCookwareSectionProps) {
  const [searchQuery, setSearchQuery] = React.useState("");

  const toggle = (id: string) => {
    const exists = value.includes(id);
    onChange(exists ? value.filter((v) => v !== id) : [...value, id]);
  };

  const filteredCookware = React.useMemo(
    () => ALL_COOKWARE_SORTED.filter((item) => item.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery]
  );

  return (
    <View className="flex-1">
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

      <View className="px-4 pb-3">
        <Text className="text-muted-foreground">
          {value.length} of {ALL_COOKWARE_SORTED.length} cookware selected
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[16px] text-muted-foreground">Loading...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <View className="gap-2 pb-4">
            {filteredCookware.map((item) => {
              const isSelected = value.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggle(item)}
                  className="bg-background rounded-xl flex-row items-center justify-between px-4 h-[56px] shadow-sm"
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
          </View>
        </ScrollView>
      )}

      <View className="p-4 pb-2 border-t border-background">
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => onChange([...ALL_COOKWARE_SORTED])}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">Select All</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange([])}
            className="flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-foreground font-medium">Clear All</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
