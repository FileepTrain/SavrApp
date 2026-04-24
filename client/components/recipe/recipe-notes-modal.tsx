import { AddIngredientModal, ExtendedIngredient } from "@/components/add-ingredient-modal";
import { IngredientsList } from "@/components/recipe/ingredients-list";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Ingredient } from "@/types/ingredient";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

type SubstitutePart = { name: string; amount: number; unit: string };

type Substitution = {
  originalIngredient: { name: string; amount: number; unit: string; spoonacularId?: number };
  substituteIngredients: SubstitutePart[];
  rawText: string;
};

type SubstituteOption = {
  rawText: string;
  scalingApplied: boolean;
  parts: SubstitutePart[];
};

interface RecipeNotesModalProps {
  visible: boolean;
  onRequestClose: () => void;
  noteText: string;
  onNoteTextChange: (text: string) => void;
  substitutions: Substitution[];
  onSubstitutionsChange: (subs: Substitution[]) => void;
  ingredients: Ingredient[];
}

export function RecipeNotesModal({
  visible,
  onRequestClose,
  noteText,
  onNoteTextChange,
  substitutions,
  onSubstitutionsChange,
  ingredients,
}: RecipeNotesModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [substituteOptions, setSubstituteOptions] = useState<SubstituteOption[]>([]);
  const [substitutesLoading, setSubstitutesLoading] = useState(false);
  const [substitutesError, setSubstitutesError] = useState<string | null>(null);
  const [customSubModalOpen, setCustomSubModalOpen] = useState(false);

  const goToPage = (page: number) => {
    pagerRef.current?.setPage(page);
  };

  const handleBackdropPress = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    } else {
      onRequestClose();
    }
  };

  const fetchSubstitutes = async (ingredient: Ingredient) => {
    setSubstitutesLoading(true);
    setSubstitutesError(null);
    setSubstituteOptions([]);
    try {
      const params = new URLSearchParams({
        ingredientName: ingredient.name,
        amount: String(ingredient.amount),
        unit: ingredient.unit,
      });
      if (ingredient.spoonacularId) {
        params.set("ingredientId", String(ingredient.spoonacularId));
      }
      const res = await fetch(
        `${SERVER_URL}/api/spoonacular/ingredient-substitutes?${params.toString()}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setSubstitutesError(data?.error ?? "Failed to fetch substitutes.");
        return;
      }
      const options: SubstituteOption[] = Array.isArray(data.options) ? data.options : [];
      if (options.length === 0) {
        setSubstitutesError("No recommended substitutes found for this ingredient.");
      } else {
        setSubstituteOptions(options);
      }
    } catch {
      setSubstitutesError("Could not connect to the server.");
    } finally {
      setSubstitutesLoading(false);
    }
  };

  const handleSelectSubstitute = (option: SubstituteOption) => {
    if (!selectedIngredient) return;
    const newSub: Substitution = {
      originalIngredient: {
        name: selectedIngredient.name,
        amount: selectedIngredient.amount,
        unit: selectedIngredient.unit,
        spoonacularId: selectedIngredient.spoonacularId,
      },
      substituteIngredients: option.parts,
      rawText: option.rawText,
    };
    const existingIndex = substitutions.findIndex(
      (s) => s.originalIngredient.name === selectedIngredient.name,
    );
    if (existingIndex !== -1) {
      const updated = [...substitutions];
      updated[existingIndex] = newSub;
      onSubstitutionsChange(updated);
    } else {
      onSubstitutionsChange([...substitutions, newSub]);
    }
    goToPage(0);
  };

  const handleCustomSubstitute = (item: ExtendedIngredient) => {
    if (!selectedIngredient) return;
    const newSub: Substitution = {
      originalIngredient: {
        name: selectedIngredient.name,
        amount: selectedIngredient.amount,
        unit: selectedIngredient.unit,
        spoonacularId: selectedIngredient.spoonacularId,
      },
      substituteIngredients: [{ name: item.name, amount: item.amount, unit: item.unit }],
      rawText: `${item.amount} ${item.unit} ${item.name}`,
    };
    const existingIndex = substitutions.findIndex(
      (s) => s.originalIngredient.name === selectedIngredient.name,
    );
    if (existingIndex !== -1) {
      const updated = [...substitutions];
      updated[existingIndex] = newSub;
      onSubstitutionsChange(updated);
    } else {
      onSubstitutionsChange([...substitutions, newSub]);
    }
    goToPage(0);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (currentPage > 0) {
          goToPage(currentPage - 1);
        } else {
          onRequestClose();
        }
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={handleBackdropPress}
        >
          <Pressable
            className="bg-background rounded-t-3xl overflow-hidden"
            style={{ height: windowHeight * 0.78 }}
            onPress={(e) => e.stopPropagation()}
          >
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              initialPage={0}
              scrollEnabled={false}
              onPageSelected={(e) => {
                const page = e.nativeEvent.position;
                setCurrentPage(page);
                if (page === 2 && selectedIngredient) {
                  void fetchSubstitutes(selectedIngredient);
                }
              }}
            >
              {/* Page 0: Main notes */}
              <View key="0" className="flex-1">
                <ScrollView
                  className="p-5"
                  contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text className="text-lg font-bold text-foreground">Manage notes</Text>

                  {/* Section 1: Ingredient Substitutions */}
                  <View className="gap-3">
                    <Text className="text-base font-semibold text-foreground">
                      Ingredient substitutions
                    </Text>
                    {substitutions.length > 0 ? (
                      <View className="gap-1">
                        {substitutions.map((sub, index) => {
                          const substituteLabel = sub.substituteIngredients
                            .map((p) => `${p.amount} ${p.unit} ${p.name}`)
                            .join(" + ");
                          return (
                            <View
                              key={index}
                              className="flex-row items-center justify-between py-2.5 px-3 bg-muted-background rounded-xl"
                            >
                              <View className="flex-1 gap-0.5 mr-3">
                                <Text className="text-foreground font-semibold text-sm">
                                  {sub.originalIngredient.name}
                                </Text>
                                <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                                  {substituteLabel}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() =>
                                  onSubstitutionsChange(substitutions.filter((_, i) => i !== index))
                                }
                                className="p-1"
                              >
                                <IconSymbol
                                  name="trash-can-outline"
                                  size={18}
                                  color="--color-red-primary"
                                />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text className="text-muted-foreground text-sm">No substitutions yet.</Text>
                    )}
                    <TouchableOpacity
                      className="py-3.5 rounded-xl border border-red-primary items-center"
                      onPress={() => goToPage(1)}
                    >
                      <Text className="text-red-primary font-semibold">Add substitution</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Section 2: Notes */}
                  <View className="gap-3">
                    <Text className="text-base font-semibold text-foreground">Notes</Text>
                    <TextInput
                      value={noteText}
                      onChangeText={onNoteTextChange}
                      placeholder="Write anything about this recipe…"
                      placeholderTextColor="#888"
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      className="border border-border rounded-xl px-3 py-2.5 text-foreground"
                      style={{ minHeight: 120 }}
                    />
                  </View>
                </ScrollView>
              </View>

              {/* Page 1: Ingredient selection */}
              <View key="1" className="flex-1 p-5 gap-4">
                <Text className="text-lg font-bold text-foreground">
                  Tap an ingredient to substitute
                </Text>
                {ingredients.length > 0 ? (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <IngredientsList
                      list={ingredients}
                      onSelectIngredient={(ing) => {
                        setSelectedIngredient(ing);
                        goToPage(2);
                      }}
                    />
                  </ScrollView>
                ) : (
                  <Text className="text-muted-foreground text-sm">No ingredients available.</Text>
                )}
              </View>

              {/* Page 2: Substitution options */}
              <View key="2" className="flex-1 p-5 gap-4">
                <Text className="text-lg font-bold text-foreground">
                  Substitutions for {selectedIngredient?.name}
                </Text>

                {substitutesLoading ? (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="red" />
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
                  >
                    {substitutesError ? (
                      <View className="items-center gap-3 px-4 py-6">
                        <IconSymbol name="alert-circle-outline" size={36} color="--color-muted-foreground" />
                        <Text className="text-muted-foreground text-center">{substitutesError}</Text>
                      </View>
                    ) : (
                      <View className="gap-2">
                        <Text className="text-base font-semibold text-muted-foreground">
                          Recommended
                        </Text>
                        {substituteOptions.map((option, index) => {
                          const label = option.parts
                            .map((p) => `${p.amount} ${p.unit} ${p.name}`)
                            .join(" + ");
                          return (
                            <TouchableOpacity
                              key={index}
                              className="flex-row items-center justify-between py-3 px-4 bg-muted-background rounded-xl"
                              onPress={() => handleSelectSubstitute(option)}
                              activeOpacity={0.7}
                            >
                              <Text className="flex-1 text-foreground font-medium" numberOfLines={3}>
                                {label}
                              </Text>
                              <IconSymbol
                                name="chevron-right"
                                size={18}
                                color="--color-muted-foreground"
                              />
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <TouchableOpacity
                      className="py-3.5 rounded-xl border border-red-primary items-center"
                      onPress={() => setCustomSubModalOpen(true)}
                    >
                      <Text className="text-red-primary font-semibold">Add your own</Text>
                    </TouchableOpacity>
                  </ScrollView>
                )}
              </View>
            </PagerView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      <AddIngredientModal
        visible={customSubModalOpen}
        onClose={() => setCustomSubModalOpen(false)}
        onSubmit={handleCustomSubstitute}
        title="Custom Substitution"
        nameLabel="Substitute ingredient"
        namePlaceholder="Type and search…"
      />
    </Modal>
  );
}
