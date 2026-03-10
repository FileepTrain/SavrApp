import { IconSymbol } from "@/components/ui/icon-symbol";
import { allergies, loadAllergies } from "@/utils/diet-preferences";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type FilterAllergiesModalProps = {
  visible: boolean;
  /** Called when modal closes; optional draft selection allows restoring later */
  onClose: (draftSelection?: string[]) => void;
  /** Call with the full selection to apply (includes disabled profile allergies) */
  onApply: (selectedAllergies: string[]) => void;
  /** Last selection when user closed without applying (restored when reopening) */
  draftSelection: string[];
};

export function FilterAllergiesModal({
  visible,
  onClose,
  onApply,
  draftSelection,
}: FilterAllergiesModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [profileAllergies, setProfileAllergies] = useState<Set<string>>(new Set());
  const [loadingProfile, setLoadingProfile] = useState(false);

  const sortedAllergies = useMemo(() => [...allergies].sort((a, b) => a.localeCompare(b)), []);
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sortedAllergies;
    return sortedAllergies.filter((a) => a.toLowerCase().includes(q));
  }, [sortedAllergies, searchQuery]);

  useEffect(() => {
    if (!visible) return;

    setSearchQuery("");
    setSelected(new Set(draftSelection.filter((a) => allergies.includes(a))));

    let cancelled = false;
    setLoadingProfile(true);
    loadAllergies()
      .then((set) => {
        if (cancelled) return;
        setProfileAllergies(set);
        setSelected((prev) => {
          const next = new Set(prev);
          for (const a of Array.from(set)) next.add(a);
          return next;
        });
      })
      .catch(() => {
        // If user isn't logged in or request fails, just treat as no profile allergies
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, draftSelection.join(",")]);

  const toggle = (item: string) => {
    if (profileAllergies.has(item)) return; // disabled
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const handleApply = () => {
    const finalSelection = Array.from(selected);
    onApply(finalSelection);
    onClose();
  };

  const handleBackdropClose = () => {
    onClose(Array.from(selected));
  };

  const disabledCount = profileAllergies.size;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={handleBackdropClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
      >
        <Pressable onPress={() => {}} style={{ flex: 1, marginHorizontal: 16, marginVertical: 24 }}>
          <View
            style={{ flex: 1, maxWidth: 400, alignSelf: "center", width: "100%" }}
            className="bg-background rounded-xl overflow-hidden shadow-xl"
          >
            {/* Header */}
            <View className="w-full h-[62px] bg-red-primary flex-row items-center justify-between px-6">
              <Text className="text-background text-lg font-bold tracking-[0.5px]">Filter by allergies</Text>
              <Pressable onPress={handleBackdropClose}>
                <IconSymbol name="close" size={24} color="--color-background" />
              </Pressable>
            </View>

            <View className="px-4 pb-3 flex-row items-center justify-between">
              <Text className="text-[14px] text-[#666666]">
                {selected.size} selected · {sortedAllergies.length} allergies
              </Text>
              {loadingProfile ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" />
                  <Text className="text-[12px] text-[#666666]">Loading profile…</Text>
                </View>
              ) : disabledCount > 0 ? (
                <Text className="text-[12px] text-[#666666]">{disabledCount} from profile (locked)</Text>
              ) : null}
            </View>

            {/* List */}
            <ScrollView
              className="px-4 flex-1"
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {filteredList.length === 0 ? (
                <View className="py-6 px-2">
                  <Text className="text-center text-[#666666]">No allergies match your search.</Text>
                </View>
              ) : (
                <View className="gap-2 pb-4">
                  {filteredList.map((item) => {
                    const isSelected = selected.has(item);
                    const isDisabled = profileAllergies.has(item);
                    return (
                      <Pressable
                        key={item}
                        onPress={() => toggle(item)}
                        disabled={isDisabled}
                        className={`bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm ${
                          isDisabled ? "opacity-50" : ""
                        }`}
                      >
                        <Text className={`text-[16px] font-medium flex-1 ${isDisabled ? "text-[#666666]" : "text-black"}`}>
                          {item}
                        </Text>
                        <View
                          className={`w-8 h-8 rounded-full items-center justify-center ${
                            isSelected ? "bg-red-primary" : "border-2 border-[#CCCCCC] bg-white"
                          }`}
                        >
                          {isSelected && <Text className="text-white text-base font-bold">✓</Text>}
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
                onPress={handleApply}
                className="rounded-xl h-14 items-center justify-center bg-red-primary"
              >
                <Text className="text-lg font-semibold text-white">Apply</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}