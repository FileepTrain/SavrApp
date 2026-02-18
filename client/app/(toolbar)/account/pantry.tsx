import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AddIngredientModal } from "@/components/add-ingredient-modal";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { Ingredient } from "@/types/ingredient";

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
        quantity: item.quantity ?? 1,
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

  // Safe delete that doesn't assume JSON response
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
        // not JSON (could be HTML or empty)
      }

      if (!res.ok) {
        const msg =
          data?.error || `Failed to delete pantry item (status ${res.status})`;
        throw new Error(msg);
      }

      // Update UI immediately
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

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="gap-4">
        {/* Add Pantry Item */}
        <Button
          variant="primary"
          icon={{
            name: "plus-circle-outline",
            position: "left",
            size: 20,
            color: "--color-red-primary",
          }}
          className="h-24 rounded-xl shadow-lg"
          textClassName="text-xl font-bold text-red-primary"
          onPress={() => setIsAddOpen(true)}
        >
          Add Pantry Item
        </Button>

        {/* Pantry List */}
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
            renderItem={({ item }) => (
              <View className="bg-background rounded-xl shadow-lg p-4 mb-3 flex-row items-center justify-between">
                {/* left */}
                <View className="flex-1 pr-4">
                  <Text className="text-lg font-bold text-red-primary">
                    {item.name}
                  </Text>
                  <Text className="text-foreground">
                    {item.quantity} {item.unit}
                  </Text>
                </View>

                {/* right - minus button */}
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  disabled={deletingId === item.id}
                  activeOpacity={0.85}
                  className="h-12 w-12 rounded-full bg-red-primary items-center justify-center shadow-lg"
                >
                  <Text className="text-white text-3xl leading-none">−</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}

        {/* Add Item Modal */}
        <AddIngredientModal
          visible={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onSubmit={handleSubmitNewItem}
          title="Add Pantry Item"
          nameLabel="Item Name"
          namePlaceholder="e.g., Milk"
        />
      </View>
    </ThemedSafeView>
  );
}