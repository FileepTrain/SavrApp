import React, { useEffect, useState } from "react";
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
      if (!res.ok) throw new Error(data.error || "Failed to fetch pantry");

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

  const handleSubmitNewItem = async (item: Ingredient) => {
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
          onPress={() => {
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