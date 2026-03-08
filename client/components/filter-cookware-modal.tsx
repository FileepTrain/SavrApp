import { IconSymbol } from "@/components/ui/icon-symbol";
import { ALL_COOKWARE_SORTED } from "@/utils/cookware";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type FilterCookwareModalProps = {
  visible: boolean;
  onClose: (draftSelection?: string[]) => void;
  /** Call with items to add to the filter (exclude list); parent merges into draft.cookware */
  onApply: (added: string[], useMyCookwareOnly: boolean) => void;
  /** Cookware already in the filter; these are hidden from the list (like recipeCookware in Add Cookware) */
  excludeCookware: string[];
  /** Last selection when user closed without adding (restored when reopening) */
  draftSelection: string[];
  initialUseMyCookwareOnly: boolean;
};

export function FilterCookwareModal({
  visible,
  onClose,
  onApply,
  excludeCookware,
  draftSelection,
  initialUseMyCookwareOnly,
}: FilterCookwareModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [useMyCookwareOnly, setUseMyCookwareOnly] = useState(initialUseMyCookwareOnly);

  /** List only cookware not already in the filter (like Add Cookware: added items disappear from list) */
  const availableList = ALL_COOKWARE_SORTED.filter((c) => !excludeCookware.includes(c));
  const filteredList = availableList.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  useEffect(() => {
    if (!visible) return;
    setSearchQuery("");
    setUseMyCookwareOnly(initialUseMyCookwareOnly);
    const available = ALL_COOKWARE_SORTED.filter((c) => !excludeCookware.includes(c));
    setSelected(new Set(draftSelection.filter((c) => available.includes(c))));
  }, [visible, excludeCookware.join(","), draftSelection.join(","), initialUseMyCookwareOnly]);

  const toggle = (item: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const handleAdd = () => {
    onApply(Array.from(selected), useMyCookwareOnly);
    onClose();
  };

  const handleBackdropClose = () => {
    onClose(Array.from(selected));
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable onPress={handleBackdropClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}>
        <Pressable onPress={() => {}} style={{ flex: 1, marginHorizontal: 16, marginVertical: 24 }}>
          <View style={{ flex: 1, maxWidth: 400, alignSelf: "center", width: "100%" }} className="bg-background rounded-xl overflow-hidden shadow-xl">
            {/* Header - match Add Cookware */}
            <View className="w-full h-[62px] bg-red-primary flex-row items-center justify-between px-6">
              <Text className="text-background text-lg font-bold tracking-[0.5px]">Filter by cookware</Text>
              <Pressable onPress={handleBackdropClose}>
                <IconSymbol name="close" size={24} color="--color-background" />
              </Pressable>
            </View>

            {/* Search - match Add Cookware / My Cookware page */}
            <View className="px-4 pt-4 pb-2">
              <View className="bg-white rounded-[12px] flex-row items-center px-4 h-12 shadow-sm">
                <IconSymbol name="magnify" size={20} color="#666666" />
                <TextInput
                  className="flex-1 ml-3 text-[16px] text-black"
                  placeholder="Search cookware..."
                  placeholderTextColor="#999999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <IconSymbol name="close" size={18} color="#666666" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Stats - like Add Cookware */}
            <View className="px-4 pb-3">
              <Text className="text-[14px] text-[#666666]">
                {selected.size} selected · {availableList.length} cookware
              </Text>
            </View>

            {/* My cookware - same row/checkbox style as list items below */}
            <Pressable
              onPress={() => setUseMyCookwareOnly((v) => !v)}
              className="mx-4 mb-2 bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm"
            >
              <Text className="text-[16px] font-medium text-black flex-1">My cookware</Text>
              <View className={`w-8 h-8 rounded-full items-center justify-center ${useMyCookwareOnly ? "bg-red-primary" : "border-2 border-[#CCCCCC] bg-white"}`}>
                {useMyCookwareOnly && <Text className="text-white text-base font-bold">✓</Text>}
              </View>
            </Pressable>

            {/* List with X for selected (exclude these recipes) - match Add Cookware row style */}
            <ScrollView className="px-4 flex-1" style={{ flex: 1 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
              {filteredList.length === 0 ? (
                <View className="py-6 px-2">
                  <Text className="text-center text-[#666666]">
                    {availableList.length === 0 ? "All cookware added to filter." : "No cookware match your search."}
                  </Text>
                </View>
              ) : (
                <View className="gap-2 pb-4">
                  {filteredList.map((item) => {
                    const isSelected = selected.has(item);
                    return (
                      <Pressable
                        key={item}
                        onPress={() => toggle(item)}
                        className="bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm"
                      >
                        <Text className="text-[16px] font-medium text-black flex-1">{item}</Text>
                        <View className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? "bg-red-primary" : "border-2 border-[#CCCCCC] bg-white"}`}>
                          {isSelected && <Text className="text-white text-base font-bold">✕</Text>}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Footer - enabled when adding cookware and/or applying My cookware */}
            <View className="p-4 border-t border-muted-background">
              <Pressable
                onPress={handleAdd}
                disabled={selected.size === 0 && !useMyCookwareOnly}
                className={`rounded-xl h-14 items-center justify-center ${selected.size === 0 && !useMyCookwareOnly ? "bg-gray-300" : "bg-red-primary"}`}
              >
                <Text className={`text-lg font-semibold ${selected.size === 0 && !useMyCookwareOnly ? "text-gray-500" : "text-white"}`}>
                  {selected.size > 0 ? `Add ${selected.size} cookware` : useMyCookwareOnly ? "Apply" : "Add cookware"}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
