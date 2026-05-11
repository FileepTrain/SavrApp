import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AccountSubpageBody,
  accountCardShellClassName,
  accountEmptyStateClassName,
  accountPrimaryCtaTextClassName,
} from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { router, useLocalSearchParams } from "expo-router";
import { AddPantryItemModal } from "@/components/add-pantry-item-modal";
import { ConfirmScannedItemModal } from "@/components/scanned-item-modal.tsx";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { Ingredient } from "@/types/ingredient";
import { SwipeablePantryItemCard } from "@/components/pantry-card";
import { useNetwork } from "@/contexts/network-context";
import { CACHE_KEYS, readCache, writeCache } from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";
import { SERVER_URL } from "@/utils/server-url";
import { getFirebaseAuth } from "@/firebase/firebase";

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

async function getFreshIdToken() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (user) {
    const freshToken = await user.getIdToken(true);
    await AsyncStorage.setItem("idToken", freshToken);
    return freshToken;
  }

  const storedToken = await AsyncStorage.getItem("idToken");

  if (!storedToken) {
    throw new Error("No logged-in user or saved token found.");
  }

  return storedToken;
}

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

  const { isOnline, registerReconnectCallback, unregisterReconnectCallback } =
    useNetwork();

  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const getParamString = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const fetchPantry = useCallback(async () => {
    try {
      setLoading(true);

      if (!isOnlineRef.current) {
        const cached = await readCache<PantryItem[]>(CACHE_KEYS.PANTRY);
        setPantryItems(cached ?? []);
        return cached ?? [];
      }

      const idToken = await getFreshIdToken();

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

      const items: PantryItem[] = Array.isArray(data.items) ? data.items : [];

      await writeCache(CACHE_KEYS.PANTRY, items);
      setPantryItems(items);

      return items;
    } catch (err) {
      console.error("Error fetching pantry:", err);

      const cached = await readCache<PantryItem[]>(CACHE_KEYS.PANTRY);

      if (cached) {
        setPantryItems(cached);
        return cached;
      }

      setPantryItems([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPantry();
  }, [fetchPantry]);

  useEffect(() => {
    registerReconnectCallback("pantry", fetchPantry);

    return () => unregisterReconnectCallback("pantry");
  }, [fetchPantry, registerReconnectCallback, unregisterReconnectCallback]);

  useEffect(() => {
    const scannedName = getParamString(params.scannedName);
    const scannedQuantityParam = getParamString(params.scannedQuantity);
    const scannedUnit = getParamString(params.scannedUnit) || "each";
    const scannedExpirationDate = getParamString(params.scannedExpirationDate);

    if (!scannedName || scannedName.trim() === "") return;

    const parsedQuantity = Number(scannedQuantityParam ?? 1);

    const nextScannedItem: ScannedPantryItem = {
      name: scannedName,
      quantity:
        Number.isFinite(parsedQuantity) && parsedQuantity > 0
          ? parsedQuantity
          : 1,
      unit: scannedUnit,
      expirationDate: scannedExpirationDate ?? null,
    };

    console.log("PANTRY RECEIVED SCANNED ITEM:", nextScannedItem);

    setScannedItem(nextScannedItem);
    setIsScanConfirmOpen(true);
  }, [
    params.scannedName,
    params.scannedQuantity,
    params.scannedUnit,
    params.scannedExpirationDate,
  ]);

  const handleSubmitNewItem = async (item: Ingredient) => {
    if (!isOnlineRef.current) {
      Alert.alert(
        "Offline",
        "Adding pantry items requires an internet connection."
      );
      return;
    }

    try {
      const idToken = await getFreshIdToken();

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
    if (!isOnlineRef.current) {
      Alert.alert(
        "Offline",
        "Editing pantry items requires an internet connection."
      );
      return;
    }

    try {
      if (!editingItem) return;

      const idToken = await getFreshIdToken();

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

      const updatedItems = pantryItems.map((p) =>
        p.id === editingItem.id
          ? {
              ...p,
              name: payload.name,
              quantity: payload.quantity,
              unit: payload.unit,
              expirationDate: payload.expirationDate,
            }
          : p
      );

      setPantryItems(updatedItems);
      await writeCache(CACHE_KEYS.PANTRY, updatedItems);

      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error("Error updating pantry item:", err);
      Alert.alert("Error", "Failed to update pantry item");
    }
  };

  const handleSubmitScannedItem = async (item: ScannedPantryItem) => {
    if (!isOnlineRef.current) {
      Alert.alert(
        "Offline",
        "Adding scanned pantry items requires an internet connection."
      );
      return;
    }

    try {
      const idToken = await getFreshIdToken();

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

      if (!isOnlineRef.current) {
        await enqueueMutation({
          type: "DELETE_PANTRY_ITEM",
          payload: { id },
        });

        const updated = pantryItems.filter((x) => x.id !== id);

        setPantryItems(updated);
        await writeCache(CACHE_KEYS.PANTRY, updated);

        return;
      }

      const idToken = await getFreshIdToken();

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
      } catch {
        // Response was not JSON.
      }

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to delete pantry item. Status: ${res.status}`
        );
      }

      const updated = pantryItems.filter((x) => x.id !== id);

      setPantryItems(updated);
      await writeCache(CACHE_KEYS.PANTRY, updated);
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
      <AccountWebColumn className="flex-1 min-h-0">
        <AccountSubpageBody>
          <View className="gap-4 flex-1">
            <View className={accountCardShellClassName}>
              <Button
                variant="primary"
                icon={{
                  name: "plus-circle-outline",
                  position: "left",
                  size: 20,
                  color: "--color-red-primary",
                }}
                className="h-[77px] rounded-none"
                textClassName={accountPrimaryCtaTextClassName}
                onPress={() => {
                  if (!isOnlineRef.current) {
                    Alert.alert(
                      "Offline",
                      "Adding pantry items requires an internet connection."
                    );
                    return;
                  }

                  setEditingItem(null);
                  setIsAddOpen(true);
                }}
              >
                Add Pantry Item
              </Button>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="red" />
            ) : (
              <FlatList
                style={{ flex: 1 }}
                data={pantryItems}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 120 }}
                ListEmptyComponent={
                  <Text className={`${accountEmptyStateClassName} mt-6`}>
                    No pantry items yet.
                  </Text>
                }
                renderItem={({ item }) => (
                  <SwipeablePantryItemCard
                    item={item}
                    deleting={deletingId === item.id}
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

                    if (!isOnlineRef.current) {
                      Alert.alert(
                        "Offline",
                        "Adding pantry items requires an internet connection."
                      );
                      return;
                    }

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
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}