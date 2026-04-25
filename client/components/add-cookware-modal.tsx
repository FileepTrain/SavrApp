import { useThemePalette } from "@/components/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ALL_COOKWARE_SORTED, loadUserCookware } from "@/utils/cookware";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type AddCookwareModalProps = {
  visible: boolean;
  onClose: (draftSelection?: string[]) => void;
  onSubmit: (selected: string[]) => void;
  /** Cookware already on the recipe; shown in list as checked and disabled */
  recipeCookware: string[];
  /** Last selection when user closed without adding (restored when reopening) */
  draftSelection: string[];
  /** On first open, suggest cookware mentioned in this text */
  summaryAndInstructions?: string;
};

/** Find cookware items that appear in the given text (case-insensitive) */
function suggestCookwareFromText(text: string, available: string[]): string[] {
  if (!text || text.trim().length === 0) return [];
  const lower = text.toLowerCase();
  return available.filter((item) => lower.includes(item.toLowerCase()));
}

export function AddCookwareModal({
  visible,
  onClose,
  onSubmit,
  recipeCookware,
  draftSelection,
  summaryAndInstructions = "",
}: AddCookwareModalProps) {
  const theme = useThemePalette();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const hasOpenedRef = useRef(false);

  /** Full list like My Cookware page; already-on-recipe items are shown but disabled/checked */
  const filteredList = ALL_COOKWARE_SORTED.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );
  const availableList = ALL_COOKWARE_SORTED.filter((c) => !recipeCookware.includes(c));

  useEffect(() => {
    if (!visible) return;
    setSearchQuery("");

    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      const text = summaryAndInstructions.trim();
      if (text) {
        loadUserCookware().then((userCookware) => {
          const suggested = suggestCookwareFromText(
            text,
            availableList.filter((c) => userCookware.has(c))
          );
          setSelected(new Set(suggested));
        });
      } else {
        setSelected(new Set(draftSelection.filter((c) => availableList.includes(c))));
      }
      return;
    }

    setSelected(new Set(draftSelection.filter((c) => availableList.includes(c))));
  }, [visible, recipeCookware.join(","), draftSelection.join(","), summaryAndInstructions]);

  const toggle = (item: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const handleAdd = () => {
    onSubmit(Array.from(selected));
    onClose();
  };

  const handleBackdropClose = () => {
    onClose(Array.from(selected));
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable onPress={handleBackdropClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}>
        <Pressable onPress={() => {}} style={{ flex: 1, marginHorizontal: 16, marginVertical: 24 }}>
          <View
            style={{
              flex: 1,
              maxWidth: 400,
              alignSelf: "center",
              width: "100%",
              backgroundColor: theme["--color-background"],
              borderRadius: 12,
              overflow: "hidden",
            }}
            className="shadow-xl"
          >
            {/* Header - match add-ingredient */}
            <View
              className="w-full h-[62px] flex-row items-center justify-between px-6"
              style={{ backgroundColor: theme["--color-red-primary"] }}
            >
              <Text className="text-lg font-bold tracking-[0.5px]" style={{ color: theme["--color-background"] }}>
                Add Cookware
              </Text>
              <Pressable onPress={() => handleBackdropClose()}>
                <IconSymbol name="close" size={24} color="--color-background" />
              </Pressable>
            </View>

            {/* Search - match My Cookware page */}
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

            {/* Stats - like My Cookware */}
            <View className="px-4 pb-3">
              <Text className="text-[14px] text-[#666666]">
                {selected.size} selected · {ALL_COOKWARE_SORTED.length} cookware
              </Text>
            </View>

            {/* Full cookware list with checkmarks - fills remaining space */}
            <ScrollView
              className="px-4 flex-1"
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {filteredList.length === 0 ? (
                <View className="py-6 px-2">
                  <Text className="text-center text-[#666666]">No cookware match your search.</Text>
                </View>
              ) : (
                <View className="gap-2 pb-4">
                  {filteredList.map((item) => {
                    const alreadyOnRecipe = recipeCookware.includes(item);
                    const isSelected = alreadyOnRecipe || selected.has(item);
                    const canToggle = !alreadyOnRecipe;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => canToggle && toggle(item)}
                        className={`bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm ${!canToggle ? "opacity-70" : ""}`}
                      >
                        <Text className="text-[16px] font-medium text-black flex-1">{item}</Text>
                        <View
                          className="w-6 h-6 rounded-[6px] border-2 items-center justify-center"
                          style={
                            isSelected
                              ? {
                                  backgroundColor: theme["--color-red-primary"],
                                  borderColor: theme["--color-red-primary"],
                                }
                              : { borderColor: "#CCCCCC", backgroundColor: "#ffffff" }
                          }
                        >
                          {isSelected && (
                            <Text className="text-xs font-bold" style={{ color: "#ffffff" }}>
                              ✓
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View className="p-4 border-t border-muted-background">
              <Pressable
                onPress={handleAdd}
                disabled={selected.size === 0}
                className="rounded-xl h-14 items-center justify-center"
                style={{
                  backgroundColor: selected.size === 0 ? "#d1d5db" : theme["--color-red-primary"],
                }}
              >
                <Text
                  className="text-lg font-semibold"
                  style={{ color: selected.size === 0 ? "#6b7280" : "#ffffff" }}
                >
                  Add {selected.size} cookware
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
