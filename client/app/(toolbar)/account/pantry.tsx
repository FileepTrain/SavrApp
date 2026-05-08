import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { AddPantryItemModal } from "@/components/add-pantry-item-modal";import { ConfirmScannedItemModal } from "@/components/scanned-item-modal.tsx";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { Ingredient } from "@/types/ingredient";
import { SwipeablePantryItemCard } from "@/components/pantry-card";
import { Pressable } from "react-native";
import { SERVER_URL } from "@/constants/api";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
};

type ScannedPantryItem = {
  name: string;
  quantity: number;
  unit: string;
  expirationDate?: string | null;
};

export default function PantryPage() {
  const params = useLocalSearchParams();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScanConfirmOpen, setIsScanConfirmOpen] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [scannedItem, setScannedItem] = useState<ScannedPantryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const getParamString = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const fetchPantry = async () => {
    try {
      setLoading(true);

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setPantryItems([]);
        return;
      }

      const res = await fetch(`${SERVER_URL}/api/pantry`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch pantry");
      }

      setPantryItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Error fetching pantry:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPantry();
  }, []);

  useEffect(() => {
    const scannedName = getParamString(params.scannedName);
    const scannedQuantityParam = getParamString(params.scannedQuantity);
    const scannedUnit = getParamString(params.scannedUnit) || "each";

    if (!scannedName || scannedName.trim() === "") return;

    const parsedQuantity = Number(scannedQuantityParam ?? 1);

    const nextScannedItem = {
      name: scannedName,
      quantity:
        Number.isFinite(parsedQuantity) && parsedQuantity > 0
          ? parsedQuantity
          : 1,
      unit: scannedUnit,
    };

    console.log("PANTRY RECEIVED SCANNED ITEM:", nextScannedItem);

    setScannedItem(nextScannedItem);
    setIsScanConfirmOpen(true);
  }, [params.scannedName, params.scannedQuantity, params.scannedUnit]);

  const handleSubmitNewItem = async (item: Ingredient) => {
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const payload = {
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "each",
        expirationDate: item.expirationDate ?? null,
      };

      const res = await fetch(`${SERVER_URL}/api/pantry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add pantry item");
      }

      setIsAddOpen(false);
      await fetchPantry();
    } catch (err) {
      console.error("Error adding pantry item:", err);
      Alert.alert("Error", "Failed to add pantry item");
    }
  };

  const handleSubmitEditedItem = async (item: Ingredient) => {
    try {
      if (!editingItem) return;

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const payload = {
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "each",
        expirationDate: item.expirationDate ?? null,
      };

      const res = await fetch(`${SERVER_URL}/api/pantry/${editingItem.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        throw new Error(`Failed to parse update response. Status: ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update pantry item");
      }

      setPantryItems((prev) =>
        prev.map((p) =>
          p.id === editingItem.id
            ? {
                ...p,
                name: payload.name,
                quantity: payload.quantity,
                unit: payload.unit,
                expirationDate: payload.expirationDate,


              }
            : p
        )
      );

      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error("Error updating pantry item:", err);
      Alert.alert("Error", "Failed to update pantry item");
    }
  };

  const handleSubmitScannedItem = async (item: ScannedPantryItem) => {
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const payload = {
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "each",
        expirationDate: item.expirationDate ?? null,

      };

      const res = await fetch(`${SERVER_URL}/api/pantry`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add scanned pantry item");
      }

      setIsScanConfirmOpen(false);
      setScannedItem(null);

      await fetchPantry();

      router.replace("/(toolbar)/account/pantry");
    } catch (err) {
      console.error("Error adding scanned pantry item:", err);
      Alert.alert("Error", "Failed to add scanned pantry item");
    }
  };

  const deletePantryItem = async (id: string) => {
    try {
      setDeletingId(id);

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const res = await fetch(`${SERVER_URL}/api/pantry/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const raw = await res.text();
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {}

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to delete pantry item. Status: ${res.status}`
        );
      }

      setPantryItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Error deleting pantry item:", err);
      Alert.alert("Error", "Failed to delete pantry item");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (item: PantryItem) => {
    Alert.alert("Remove item?", `Remove "${item.name}" from your pantry?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deletePantryItem(item.id),
      },
    ]);
  };

  const startEdit = (item: PantryItem) => {
    setEditingItem(item);
    setIsAddOpen(true);
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="flex-1 gap-4">
        {loading ? (
          <ActivityIndicator size="large" color="red" />
        ) : (
          <FlatList
            data={pantryItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <Text className="text-center text-foreground opacity-60 mt-6">
                No pantry items yet.
              </Text>
            }
            renderItem={({ item }) => (
              <SwipeablePantryItemCard
                item={item}
                onEdit={startEdit}
                onDelete={confirmDelete}
              />
            )}
          />
        )}

        <AddPantryItemModal
          visible={isAddOpen}
          onClose={() => {
            setIsAddOpen(false);
            setEditingItem(null);
          }}
          onSubmit={editingItem ? handleSubmitEditedItem : handleSubmitNewItem}
          title={editingItem ? "Edit Pantry Item" : "Add Pantry Item"}
          nameLabel="Item Name"
          namePlaceholder="e.g., Milk"
          initialItem={
            editingItem
              ? {
                  id: null,
                  name: editingItem.name,
                  amount: editingItem.quantity,
                  unit: editingItem.unit,
                  image: null,
                }
              : null
          }
        />

        {scannedItem && (
          <ConfirmScannedItemModal
            key={`${scannedItem.name}-${scannedItem.quantity}-${scannedItem.unit}`}
            visible={isScanConfirmOpen}
            onClose={() => {
              setIsScanConfirmOpen(false);
              setScannedItem(null);
              router.replace("/(toolbar)/account/pantry");
            }}
            initialData={scannedItem}
            onSubmit={handleSubmitScannedItem}
          />
        )}

        {isActionMenuOpen && (
          <View className="absolute bottom-24 right-6 gap-3">
            <Button
              className="px-5 py-4 rounded-2xl"
              textClassName="font-bold text-red-primary"
              onPress={() => {
                setIsActionMenuOpen(false);
                setEditingItem(null);
                setIsAddOpen(true);
              }}
            >
              Add Pantry Item
            </Button>

            <Button
              className="px-5 py-4 rounded-2xl"
              textClassName="font-bold text-red-primary"
              onPress={() => {
                setIsActionMenuOpen(false);
                router.push("/barcode-scanner");
              }}
            >
              Scan Barcode
            </Button>

            <Button
              className="px-5 py-4 rounded-2xl"
              textClassName="font-bold text-red-primary"
              onPress={() => {
                setIsActionMenuOpen(false);
                router.push("/(toolbar)/account/scan-history");
              }}
            >
              View Scan History
            </Button>
          </View>
        )}

        <Pressable
          onPress={() => setIsActionMenuOpen((prev) => !prev)}
          className="absolute bottom-8 right-0 mr-4 w-16 h-16 rounded-full items-center justify-center bg-red-500"
        >
          <Text className="text-3xl font-bold text-white">+</Text>
        </Pressable>
      </View>
    </ThemedSafeView>
  );
}