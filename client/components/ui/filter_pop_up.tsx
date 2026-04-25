import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import Button from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { FilterCookwareModal } from "@/components/filter-cookware-modal";
import { FilterAllergiesModal } from "@/components/filter-allergies-modal";

// Filter modal state options
export type Filters = {
  budgetMin: number;
  budgetMax: number;
  allergies: string[];
  foodTypes: string[];
  /** Cookware to exclude: recipes that use any of these are filtered out */
  cookware: string[];
  /** When true, only show recipes whose cookware is in the user's "My cookware" list */
  useMyCookwareOnly: boolean;
};

// Filter actions
type Props = {
  visible: boolean;
  draft: Filters;
  onChangeDraft: (next: Filters) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset: () => void;
};

export default function FilterModal({
  visible,
  draft,
  onChangeDraft,
  onApply,
  onCancel,
  onReset,
}: Props) {
  const theme = useThemePalette();
  const [cookwareModalVisible, setCookwareModalVisible] = useState(false);
  const [cookwareDraft, setCookwareDraft] = useState<string[]>([]);
  const [allergiesModalVisible, setAllergiesModalVisible] = useState(false);
  const [allergiesDraft, setAllergiesDraft] = useState<string[]>([]);
  const budgetLabel = useMemo(
    () => `$${draft.budgetMin}-${draft.budgetMax}`,
    [draft.budgetMin, draft.budgetMax]
  );
  const sheetMaxHeight = Math.round(Dimensions.get("window").height * 0.85);
  const isWeb = Platform.OS === "web";

  const removeAllergy = (item: string) => {
    onChangeDraft({
      ...draft,
      allergies: (draft.allergies || []).filter((a) => a !== item),
    });
  };

  const removeCookware = (item: string) => {
    onChangeDraft({
      ...draft,
      cookware: (draft.cookware || []).filter((c) => c !== item),
    });
  };

  const removeMyCookwareOnly = () => {
    onChangeDraft({
      ...draft,
      useMyCookwareOnly: false,
    });
  };

  if (!isWeb) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent={true}>
        <Pressable onPress={onCancel} className="flex-1 bg-black/30 items-center justify-center px-6 py-8">
          <Pressable onPress={() => { }} className="w-full max-w-[420px] max-h-[85%] bg-background rounded-2xl overflow-hidden">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-muted-background">
              <Text className="text-xl font-bold text-foreground">Filter by</Text>
              <Pressable onPress={onCancel} hitSlop={12} className="p-2 rounded-full bg-muted-background">
                <IconSymbol name="close" size={18} color="--color-icon" />
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={true} style={{ maxHeight: "100%" }}>
              {/* Budget */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-base font-semibold text-foreground">Budget Range</Text>
                  <Text className="text-base text-foreground">{budgetLabel}</Text>
                </View>

                <Slider
                  minimumValue={0}
                  maximumValue={100}
                  step={1}
                  value={draft.budgetMax}
                  onValueChange={(v) =>
                    onChangeDraft({
                      ...draft,
                      budgetMax: Math.max(draft.budgetMin, v),
                    })
                  }
                  minimumTrackTintColor={theme["--color-foreground"]}
                  thumbTintColor={theme["--color-foreground"]}
                />

                <View className="flex-row justify-between mt-1">
                  <Text className="text-muted-foreground">$0</Text>
                  <Text className="text-muted-foreground">$100</Text>
                </View>
              </View>

              {/* Allergies */}
              <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-3">
                  <Text className="text-base font-semibold text-foreground">Allergies</Text>
                </View>
                {(draft.allergies && draft.allergies.length > 0) && (
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {draft.allergies.map((item) => (
                      <View
                        key={item}
                        className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                      >
                        <Text className="text-foreground font-medium">{item}</Text>
                        <TouchableOpacity
                          onPress={() => removeAllergy(item)}
                          className="p-1"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconSymbol name="close" size={18} color="#666" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <Button
                  variant="primary"
                  icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
                  className="bg-muted-background rounded-xl"
                  textClassName="text-lg font-medium text-icon"
                  onPress={() => setAllergiesModalVisible(true)}
                >
                  Add filter
                </Button>
              </View>

              <FilterAllergiesModal
                visible={allergiesModalVisible}
                onClose={(draftSelection) => {
                  setAllergiesModalVisible(false);
                  if (draftSelection) setAllergiesDraft(draftSelection);
                }}
                onApply={(selection) => {
                  onChangeDraft({
                    ...draft,
                    allergies: selection,
                  });
                  setAllergiesDraft([]);
                  setAllergiesModalVisible(false);
                }}
                draftSelection={allergiesDraft.length > 0 ? allergiesDraft : (draft.allergies ?? [])}
              />

              {/* Food Types */}
              <View className="mb-6">
                <View className="flex-row items-center gap-2 mb-3">
                  <Text className="text-base font-semibold text-foreground">Food Types</Text>
                </View>
                <Pressable className="rounded-xl border border-muted-background border-dashed py-3 px-4 flex-row items-center justify-center" onPress={() => { }}>
                  <Text className="text-base font-medium text-foreground">+ Add filter</Text>
                </Pressable>
              </View>

              {/* Cookware Types - chips first (My cookware + excluded cookware), then + Add filter button */}
              <View className="mb-2">
                <View className="flex-row items-center gap-2 mb-3">
                  <Text className="text-base font-semibold text-foreground">Cookware Types</Text>
                </View>
                {(draft.useMyCookwareOnly || (draft.cookware && draft.cookware.length > 0)) && (
                  <View className="flex-row flex-wrap gap-2 mb-3">
                    {draft.useMyCookwareOnly && (
                      <View
                        className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                      >
                        <Text className="text-icon font-medium">My cookware</Text>
                        <TouchableOpacity
                          onPress={removeMyCookwareOnly}
                          className="p-1"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconSymbol name="close" size={18} color="--color-icon" />
                        </TouchableOpacity>
                      </View>
                    )}
                    {(draft.cookware || []).map((item) => (
                      <View
                        key={item}
                        className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                      >
                        <Text className="text-foreground font-medium">{item}</Text>
                        <TouchableOpacity
                          onPress={() => removeCookware(item)}
                          className="p-1"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <IconSymbol name="close" size={18} color="--color-icon" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <Button
                  variant="primary"
                  icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
                  className="bg-muted-background rounded-xl"
                  textClassName="text-lg font-medium text-icon"
                  onPress={() => setCookwareModalVisible(true)}
                >
                  Add filter
                </Button>
              </View>

              <FilterCookwareModal
                visible={cookwareModalVisible}
                onClose={(draftSelection) => {
                  setCookwareModalVisible(false);
                  if (draftSelection) setCookwareDraft(draftSelection);
                }}
                onApply={(added, useMyCookwareOnly) => {
                  onChangeDraft({
                    ...draft,
                    useMyCookwareOnly: useMyCookwareOnly ?? draft.useMyCookwareOnly,
                    cookware: [...(draft.cookware || []), ...added],
                  });
                  setCookwareDraft([]);
                  setCookwareModalVisible(false);
                }}
                excludeCookware={draft.cookware ?? []}
                draftSelection={cookwareDraft}
                initialUseMyCookwareOnly={draft.useMyCookwareOnly ?? false}
              />

              {/* Buttons */}
              <View className="mt-6 gap-3 pb-2">
                <Button
                  variant="default"
                  className="h-14 rounded-xl"
                  textClassName="text-base font-semibold text-primary"
                  onPress={onApply}
                >
                  Apply Filters
                </Button>

                <Button
                  variant="muted"
                  className="h-14 rounded-xl"
                  textClassName="text-base font-semibold text-foreground"
                  onPress={onReset}
                >
                  Reset Filters
                </Button>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent={true}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            width: "100%",
            maxWidth: 420,
            maxHeight: sheetMaxHeight,
            backgroundColor: theme["--color-background"],
            borderRadius: 16,
            overflow: "hidden",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-muted-background">
            <Text className="text-xl font-bold text-foreground">Filter by</Text>
            <Pressable onPress={onCancel} hitSlop={12} className="p-2 rounded-full bg-muted-background">
              <IconSymbol name="close" size={18} color="--color-icon" />
            </Pressable>
          </View>

          <ScrollView
            className="px-5 py-4"
            showsVerticalScrollIndicator={true}
            style={{ flex: 1, minHeight: 0 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Budget */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-foreground">Budget Range</Text>
                <Text className="text-base text-foreground">{budgetLabel}</Text>
              </View>

              <Slider
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={draft.budgetMax}
                onValueChange={(v) =>
                  onChangeDraft({
                    ...draft,
                    budgetMax: Math.max(draft.budgetMin, v),
                  })
                }
                minimumTrackTintColor={theme["--color-foreground"]}
                thumbTintColor={theme["--color-foreground"]}
              />

              <View className="flex-row justify-between mt-1">
                <Text className="text-muted-foreground">$0</Text>
                <Text className="text-muted-foreground">$100</Text>
              </View>
            </View>

            {/* Allergies */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Allergies</Text>
              </View>
              {(draft.allergies && draft.allergies.length > 0) && (
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {draft.allergies.map((item) => (
                    <View
                      key={item}
                      className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                    >
                      <Text className="text-foreground font-medium">{item}</Text>
                      <TouchableOpacity
                        onPress={() => removeAllergy(item)}
                        className="p-1"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconSymbol name="close" size={18} color="#666" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <Button
                variant="primary"
                icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
                className="bg-muted-background rounded-xl"
                textClassName="text-lg font-medium text-icon"
                onPress={() => setAllergiesModalVisible(true)}
              >
                Add filter
              </Button>
            </View>

            <FilterAllergiesModal
              visible={allergiesModalVisible}
              onClose={(draftSelection) => {
                setAllergiesModalVisible(false);
                if (draftSelection) setAllergiesDraft(draftSelection);
              }}
              onApply={(selection) => {
                onChangeDraft({
                  ...draft,
                  allergies: selection,
                });
                setAllergiesDraft([]);
                setAllergiesModalVisible(false);
              }}
              draftSelection={allergiesDraft.length > 0 ? allergiesDraft : (draft.allergies ?? [])}
            />

            {/* Food Types */}
            <View className="mb-6">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Food Types</Text>
              </View>
              <Pressable className="rounded-xl border border-muted-background border-dashed py-3 px-4 flex-row items-center justify-center" onPress={() => { }}>
                <Text className="text-base font-medium text-foreground">+ Add filter</Text>
              </Pressable>
            </View>

            {/* Cookware Types - chips first (My cookware + excluded cookware), then + Add filter button */}
            <View className="mb-2">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-base font-semibold text-foreground">Cookware Types</Text>
              </View>
              {(draft.useMyCookwareOnly || (draft.cookware && draft.cookware.length > 0)) && (
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {draft.useMyCookwareOnly && (
                    <View
                      className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                    >
                      <Text className="text-icon font-medium">My cookware</Text>
                      <TouchableOpacity
                        onPress={removeMyCookwareOnly}
                        className="p-1"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconSymbol name="close" size={18} color="--color-icon" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {(draft.cookware || []).map((item) => (
                    <View
                      key={item}
                      className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                    >
                      <Text className="text-foreground font-medium">{item}</Text>
                      <TouchableOpacity
                        onPress={() => removeCookware(item)}
                        className="p-1"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <IconSymbol name="close" size={18} color="--color-icon" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <Button
                variant="primary"
                icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
                className="bg-muted-background rounded-xl"
                textClassName="text-lg font-medium text-icon"
                onPress={() => setCookwareModalVisible(true)}
              >
                Add filter
              </Button>
            </View>

            <FilterCookwareModal
              visible={cookwareModalVisible}
              onClose={(draftSelection) => {
                setCookwareModalVisible(false);
                if (draftSelection) setCookwareDraft(draftSelection);
              }}
              onApply={(added, useMyCookwareOnly) => {
                onChangeDraft({
                  ...draft,
                  useMyCookwareOnly: useMyCookwareOnly ?? draft.useMyCookwareOnly,
                  cookware: [...(draft.cookware || []), ...added],
                });
                setCookwareDraft([]);
                setCookwareModalVisible(false);
              }}
              excludeCookware={draft.cookware ?? []}
              draftSelection={cookwareDraft}
              initialUseMyCookwareOnly={draft.useMyCookwareOnly ?? false}
            />

            {/* Buttons */}
            <View className="mt-6 gap-3 pb-2">
              <Button
                variant="default"
                portalSafe
                className="h-14 rounded-xl"
                textClassName="text-base font-semibold"
                onPress={onApply}
              >
                Apply Filters
              </Button>

              <Button
                variant="muted"
                portalSafe
                className="h-14 rounded-xl"
                textClassName="text-base font-semibold"
                onPress={onReset}
              >
                Reset Filters
              </Button>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}