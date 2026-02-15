// components/add-ingredient-modal.tsx
import { IconSymbol } from "@/components/ui/icon-symbol";
import Input from "@/components/ui/input";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

export type ExtendedIngredient = {
  id: number;
  name: string;
  original?: string | null;
  amount: number;
  unit: string;
  image?: string | null;
};

type AddIngredientModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (item: ExtendedIngredient) => void;
  title?: string;
  nameLabel?: string;
  namePlaceholder?: string;
};

type Suggestion = {
  id: number;
  name: string;
  image?: string;
};

async function safeReadJson(res: Response) {
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text), raw: text };
  } catch {
    return { ok: res.ok, status: res.status, data: null, raw: text };
  }
}

export function AddIngredientModal({
  visible,
  onClose,
  onSubmit,
  title = "Add Ingredient",
  nameLabel = "Ingredient Name",
  namePlaceholder = "Type and search…",
}: AddIngredientModalProps) {
  const [itemName, setItemName] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");

  const [results, setResults] = useState<Suggestion[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);

  const query = useMemo(() => itemName.trim(), [itemName]);
  const isLocked = selectedId !== null;

  const searchingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    setItemName("");
    setSelectedId(null);
    setSelectedImage(null);
    setAmount("");
    setUnit("");

    setResults([]);
    setLoadingSearch(false);
    setResultsOpen(false);

    setUnitOptions([]);
    setLoadingUnits(false);
    setUnitMenuOpen(false);

    searchingRef.current = false;
  }, [visible]);

  const runSearch = async () => {
    if (isLocked) {
      Alert.alert("Ingredient selected", "Edit the name field to search for a different ingredient.");
      return;
    }

    if (query.length < 2) {
      Alert.alert("Type more", "Please type at least 2 characters, then press search.");
      return;
    }

    if (searchingRef.current) return;
    searchingRef.current = true;

    setLoadingSearch(true);
    setResultsOpen(true);
    setResults([]);

    try {
      const url = `${SERVER_URL}/api/spoonacular/ingredients/autocomplete?q=${encodeURIComponent(
        query
      )}&number=10`;

      const res = await fetch(url);
      const parsed = await safeReadJson(res);

      if (!parsed.ok) {
        const msg =
          parsed?.data?.error ||
          parsed?.data?.message ||
          `Search failed (${parsed.status}).`;
        const extra = parsed.data
          ? ""
          : `\n\nServer said:\n${String(parsed.raw || "").slice(0, 300)}`;
        throw new Error(msg + extra);
      }

      // ✅ Accept BOTH shapes:
      // 1) { success: true, results: [...] }
      // 2) [...]  (just in case)
      const rawList = Array.isArray(parsed?.data?.results)
        ? parsed.data.results
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

      // ✅ Do NOT filter out results just because id is a string
      const list: Suggestion[] = rawList
        .map((x: any) => {
          const idNum = Number(x?.id);
          const nameStr = typeof x?.name === "string" ? x.name : String(x?.name ?? "");
          if (!Number.isFinite(idNum) || !nameStr.trim()) return null;
          return { id: idNum, name: nameStr.trim(), image: x?.image ? String(x.image) : undefined };
        })
        .filter(Boolean) as Suggestion[];

      setResults(list);
    } catch (e: any) {
      setResults([]);
      setResultsOpen(false);
      Alert.alert(
        "Search failed",
        e?.message ||
        "Could not search ingredients. Check SERVER_URL and that /api/spoonacular is reachable."
      );
    } finally {
      setLoadingSearch(false);
      searchingRef.current = false;
    }
  };

  const fetchUnitsForIngredient = async (ingredientId: number) => {
    setLoadingUnits(true);
    setUnitOptions([]);
    setUnit("");

    try {
      const res = await fetch(`${SERVER_URL}/api/spoonacular/ingredients/${ingredientId}`);
      const parsed = await safeReadJson(res);

      if (!parsed.ok) {
        const msg =
          parsed?.data?.error ||
          parsed?.data?.message ||
          `Units lookup failed (${parsed.status}).`;
        const extra = parsed.data
          ? ""
          : `\n\nServer said:\n${String(parsed.raw || "").slice(0, 300)}`;
        throw new Error(msg + extra);
      }

      const possibleUnits = parsed?.data?.ingredient?.possibleUnits;

      if (!Array.isArray(possibleUnits) || possibleUnits.length === 0) {
        Alert.alert("No units found", "No acceptable units were returned for this ingredient. Try another one.");
        setUnitOptions([]);
        setUnit("");
        return;
      }

      const normalized = Array.from(
        new Set(
          possibleUnits
            .map((u: any) => String(u).trim())
            .filter((u: string) => u.length > 0)
        )
      );

      setUnitOptions(normalized);
      setUnit(normalized[0] ?? "");
    } catch (e: any) {
      Alert.alert("Units lookup failed", e?.message || "Could not load units.");
      setUnitOptions([]);
      setUnit("");
    } finally {
      setLoadingUnits(false);
    }
  };

  const handlePickResult = async (sug: Suggestion) => {
    setSelectedId(sug.id);
    setItemName(sug.name);

    const img = sug.image ? `https://spoonacular.com/cdn/ingredients_250x250/${sug.image}` : null;
    setSelectedImage(img);

    setResultsOpen(false);
    setResults([]);

    await fetchUnitsForIngredient(sug.id);
  };

  const handleNameChange = (text: string) => {
    setItemName(text);

    if (selectedId !== null) {
      setSelectedId(null);
      setSelectedImage(null);
      setUnitOptions([]);
      setUnit("");
    }

    setResultsOpen(false);
    setResults([]);
  };

  const canEditAmountAndUnit = selectedId !== null && !loadingUnits && unitOptions.length > 0;

  const handleConfirm = () => {
    const name = itemName.trim();
    const amt = Number(amount);

    if (!selectedId) {
      Alert.alert("Select an ingredient", "Type a name, press search, then choose an ingredient from the list.");
      return;
    }
    if (loadingUnits) {
      Alert.alert("Loading units", "Please wait for units to finish loading.");
      return;
    }
    if (!unitOptions.length || !unit) {
      Alert.alert("Select a unit", "Please select a unit from the available units.");
      return;
    }
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      Alert.alert("Validation Error", "Amount must be greater than 0.");
      return;
    }

    onSubmit({
      id: selectedId,
      name,
      original: name,
      amount: amt,
      unit: unit.toLowerCase(),
      image: selectedImage,
    });

    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}>
        <Pressable onPress={() => { }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View
              className="w-[345px] bg-background rounded-xl overflow-hidden shadow-xl"
            >
              {/* Header */}
              <View className="w-full h-[62px] bg-red-primary flex-row items-center justify-between px-6">
                <Text className="text-background text-lg font-bold tracking-[0.5px]">{title}</Text>
                <Pressable onPress={onClose}>
                  <IconSymbol name="close" size={24} color="--color-background" />
                </Pressable>
              </View>

              {/* Body */}
              <View className="px-6 pt-6 pb-4 gap-4">
                {/* Name + Search */}
                <View style={{ zIndex: 9999 }} className="gap-2">
                  <Text className="text-muted-foreground font-medium">{nameLabel}</Text>

                  <View className="flex-row items-center gap-2">
                    <View className="flex-1">
                      <Input
                        placeholder={namePlaceholder}
                        value={itemName}
                        onChangeText={handleNameChange}
                        onSubmitEditing={runSearch}
                        returnKeyType="search"
                        className="w-full"
                        inputClassName="h-[52px]"
                      />
                    </View>

                    <Pressable
                      onPress={runSearch}
                      className="h-[52px] w-[52px] rounded-full bg-red-primary items-center justify-center shadow-xl"
                      style={{
                        elevation: 5,
                        opacity: isLocked ? 0.6 : 1,
                      }}
                    >
                      <IconSymbol name="magnify" size={24} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  {/* Results dropdown */}
                  {resultsOpen && (
                    <View
                      style={{
                        zIndex: 9999,
                      }}
                      className="relative bg-background rounded-xl border border-muted-background overflow-hidden shadow-xl"
                    >
                      {loadingSearch ? (
                        <View className="py-3 items-center justify-center">
                          <ActivityIndicator />
                        </View>
                      ) : results.length === 0 ? (
                        <View className="px-4 py-3">
                          <Text className="text-sm text-muted-foreground">No matches. Try another search.</Text>
                        </View>
                      ) : (
                        <FlatList
                          data={results}
                          keyExtractor={(item) => String(item.id)}
                          keyboardShouldPersistTaps="handled"
                          style={{ maxHeight: 260 }}
                          renderItem={({ item }) => (
                            <Pressable
                              onPress={() => handlePickResult(item)}
                              className="px-4 py-3 border-b border-muted-background"
                            >
                              <Text className="text-foreground">{item.name}</Text>
                            </Pressable>
                          )}
                        />
                      )}
                    </View>
                  )}

                  {!selectedId && (
                    <Text className="text-sm text-muted-foreground">Select an ingredient to continue.</Text>
                  )}

                  {isLocked && (
                    <View className="flex-row items-center gap-2">
                      {loadingUnits ? (
                        <>
                          <ActivityIndicator />
                          <Text className="text-sm text-muted-foreground">Loading acceptable units…</Text>
                        </>
                      ) : unitOptions.length > 0 ? (
                        <Text className="text-sm text-muted-foreground">Ingredient selected (edit name to change)</Text>
                      ) : (
                        <Text className="text-sm text-muted-foreground">Ingredient selected, but units not available.</Text>
                      )}
                    </View>
                  )}
                </View>
                {/* Amount + Unit */}
                <View className="flex-row gap-3">
                  <View className="flex-1 gap-2">
                    <Text className="text-muted-foreground font-medium">Amount</Text>
                    <Input
                      placeholder="1"
                      value={amount}
                      onChangeText={setAmount}
                      inputType="number-pad"
                      className="w-full"
                      inputClassName={`h-[52px] ${canEditAmountAndUnit ? "" : "opacity-50"}`}
                      editable={canEditAmountAndUnit}
                    />
                  </View>

                  <View className="flex-1 gap-2">
                    <Text className="text-sm text-muted-foreground font-medium">Unit</Text>

                    <Pressable
                      disabled={!canEditAmountAndUnit}
                      onPress={() => setUnitMenuOpen(true)}
                      style={{ opacity: canEditAmountAndUnit ? 1 : 0.5 }}
                    >
                      <View className="h-[52px] rounded-lg border border-muted-background bg-background flex-row items-center justify-between px-3">
                        <Text className={`text-muted-foreground ${canEditAmountAndUnit ? "" : "opacity-50"}`}>
                          {unit || "Select unit"}
                        </Text>
                        <IconSymbol name="menu-down" size={22} color="--color-icon" />
                      </View>
                    </Pressable>
                  </View>
                </View>

                {/* Buttons */}
                <View className="flex-row gap-3 pt-2">
                  <Pressable
                    onPress={onClose}
                    className="flex-1 h-[52px] border border-red-primary rounded-xl items-center justify-center"
                  >
                    <Text className="text-lg font-bold text-red-primary">Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleConfirm}
                    className="flex-1 h-[52px] bg-red-primary rounded-xl items-center justify-center shadow-xl"
                    style={{
                      elevation: 5,
                      opacity: selectedId && unitOptions.length > 0 && !loadingUnits ? 1 : 0.6,
                    }}
                  >
                    <Text className="text-lg text-background font-bold">Confirm</Text>
                  </Pressable>
                </View>
              </View>

              {/* Unit dropdown modal */}
              <Modal visible={unitMenuOpen} transparent animationType="fade">
                <Pressable
                  onPress={() => setUnitMenuOpen(false)}
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(0,0,0,0.35)",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 24,
                  }}
                >
                  <Pressable onPress={() => { }} style={{ width: "100%", maxWidth: 360 }}>
                    <View className="bg-background rounded-[16px] overflow-hidden">
                      <View className="px-4 py-3 border-b border-muted-background flex-row items-center justify-between">
                        <Text className="text-foreground font-bold">Select Unit</Text>
                        <Pressable onPress={() => setUnitMenuOpen(false)}>
                          <IconSymbol name="close" size={22} color="--color-icon" />
                        </Pressable>
                      </View>

                      <FlatList
                        data={unitOptions}
                        keyExtractor={(u) => u}
                        style={{ maxHeight: 320 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <Pressable
                            onPress={() => {
                              setUnit(item);
                              setUnitMenuOpen(false);
                            }}
                            className="px-4 py-3 border-b border-muted-background"
                          >
                            <Text className="text-foreground">{item}</Text>
                          </Pressable>
                        )}
                      />
                    </View>
                  </Pressable>
                </Pressable>
              </Modal>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
