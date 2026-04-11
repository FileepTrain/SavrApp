import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AddIngredientModal } from "@/components/add-ingredient-modal";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { Ingredient } from "@/types/ingredient";
import { SwipeablePantryItemCard } from "@/components/pantry-card";
import { useNetwork } from "@/contexts/network-context";
import { CACHE_KEYS, readCache, writeCache } from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";

const SERVER_URL = "http://10.0.2.2:3000";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export default function PantryPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { isOnline, registerReconnectCallback, unregisterReconnectCallback } = useNetwork();

  // Ref keeps isOnline current inside stable useCallback closures, avoiding stale
  // closure captures when the reconnect callback fires before React re-renders.
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // Stable fetchPantry: reads isOnline from ref at call time.
  // Serves cache immediately when offline to avoid a pending network timeout.
  const fetchPantry = useCallback(async () => {
    try {
      setLoading(true);

      if (!isOnlineRef.current) {
        // No network: serve whatever is in the local cache.
        const cached = await readCache<PantryItem[]>(CACHE_KEYS.PANTRY);
        setPantryItems(cached ?? []);
        return;
      }

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
      if (!res.ok) throw new Error(data.error || "Failed to fetch pantry");

      const items: PantryItem[] = Array.isArray(data.items) ? data.items : [];

      // Cache the latest list so it is available on subsequent offline visits.
      await writeCache(CACHE_KEYS.PANTRY, items);
      setPantryItems(items);
    } catch (err) {
      console.error("Error fetching pantry:", err);
      // On failure, fall back to cache rather than showing nothing.
      const cached = await readCache<PantryItem[]>(CACHE_KEYS.PANTRY);
      if (cached) setPantryItems(cached);
    } finally {
      setLoading(false);
    }
  }, []); // Stable -- reads isOnline via ref, not closure

  // Load pantry once on mount. The reconnect callback below handles subsequent refreshes.
  useEffect(() => {
    fetchPantry();
  }, [fetchPantry]);

  // Re-fetch after connectivity is restored and the mutation queue has been synced.
  useEffect(() => {
    registerReconnectCallback("pantry", fetchPantry);
    return () => unregisterReconnectCallback("pantry");
  }, [fetchPantry, registerReconnectCallback, unregisterReconnectCallback]);

  const handleSubmitNewItem = async (item: Ingredient) => {
    // Adding a new pantry item requires the server; block when offline.
    if (!isOnlineRef.current) {
      Alert.alert("Offline", "Adding pantry items requires an internet connection.");
      return;
    }
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const payload = {
        name: item.name,
        quantity: item.amount ?? 1,
        unit: item.unit ?? "each",
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
      if (!res.ok) throw new Error(data.error || "Failed to add pantry item");

      setIsAddOpen(false);
      await fetchPantry();
    } catch (err) {
      console.error("Error adding pantry item:", err);
    }
  };

  /* Handles the submission of an edited pantry item */
  const handleSubmitEditedItem = async (item: Ingredient) => {
    // Editing requires the ingredient API for validation; block when offline.
    if (!isOnlineRef.current) {
      Alert.alert("Offline", "Editing pantry items requires an internet connection.");
      return;
    }
    try {
      if (!editingItem) return;
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const payload = {
        name: item.name,
        quantity: item.amount ?? 1,
        unit: item.unit ?? "each",
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
        throw new Error(`Failed to parse update response (status ${res.status})`);
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
              } : p
        )
      );
      setIsAddOpen(false);
      setEditingItem(null);
    } catch (err) {
      console.error("Error updating pantry item:", err);
    }
  };

  const deletePantryItem = async (id: string) => {
    try {
      setDeletingId(id);

      if (!isOnlineRef.current) {
        // Queue the delete and apply it to the local state immediately.
        await enqueueMutation({ type: "DELETE_PANTRY_ITEM", payload: { id } });
        const updated = pantryItems.filter((x) => x.id !== id);
        setPantryItems(updated);
        await writeCache(CACHE_KEYS.PANTRY, updated);
        return;
      }

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
      } catch {
        // not JSON
      }

      if (!res.ok) {
        const msg =
          data?.error || `Failed to delete pantry item (status ${res.status})`;
        throw new Error(msg);
      }

      setPantryItems((prev) => prev.filter((x) => x.id !== id));
    } catch (err) {
      console.error("Error deleting pantry item:", err);
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
      <View className="gap-4">
        <Button
          variant="primary"
          icon={{
            name: "plus-circle-outline",
            position: "left",
            size: 20,
            color: "--color-red-primary",
          }}
          className="h-24"
          textClassName="text-xl font-bold text-red-primary"
          // Block opening the create modal when offline and explain why.
          onPress={() => {
            if (!isOnlineRef.current) {
              Alert.alert("Offline", "Adding pantry items requires an internet connection.");
              return;
            }
            setEditingItem(null);
            setIsAddOpen(true);
          }}
        >
          Add Pantry Item
        </Button>

        {loading ? (
          <ActivityIndicator size="large" color="red" />
        ) : (
          <FlatList
            data={pantryItems}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text className="text-center text-foreground opacity-60 mt-6">
                No pantry items yet.
              </Text>
            }
        /* Creates swipeable pantry item cards */
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

        <AddIngredientModal
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
      </View>
    </ThemedSafeView>
  );
}
