import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Pressable, FlatList } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AddIngredientModal, ExtendedIngredient } from "@/components/add-ingredient-modal";
import * as Location from "expo-location";

const SERVER_URL = "http://10.0.2.2:3000"

type GroceryItem = {
  id: string;
  name: string;
  amount: number;
  unit: string;
  estimatedCost?: number | null;
}

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /*
   * Location
   */
  async function isLocationEnabled() {
    const value = await AsyncStorage.getItem("LOCATION_ENABLED");
    return value === "true";
  }

  /*If your emulator still does not output zip try opening google maps app.
  For some reason that seems to solve whatever bug causing denied location access :/
  */
  async function getLocation() {
    const allowed = await isLocationEnabled();
    if (!allowed) {
      console.log("Location disabled by user");
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log("Permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync();
      const { latitude, longitude } = location.coords;
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const zipcode = address?.postalCode ?? ''; //if no zip returns empty string
      console.log("Latitude:", latitude);
      console.log("Longitude:", longitude);
      console.log("zipcode:", zipcode)
    } catch (error) {
      console.log("Error getting location:", error);
    }
  }

  /*
   * Fetch Grocery List
   */
  async function fetchGroceryList() {
    try {
      setLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch("http://10.0.2.2:3000/api/grocery-list", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch grocery list");
      const listItems = Array.isArray(data.groceryList?.items) ? data.groceryList.items : [];
      setItems(listItems);
      setTotalCost(data.groceryList?.totalCost ?? null);
    } catch (err) {
      console.log("Error fetching grocery list:", err)
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const token = await AsyncStorage.getItem("idToken");
      if (token) {
        fetchGroceryList();
      }
    }
    init();
  }, []);

  /**
   * Add Item
   */
  async function handleSubmitNewItem(item: ExtendedIngredient) {
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch("http://10.0.2.2:3000/api/grocery-list/items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: item.name,
          amount: item.amount,
          unit: item.unit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add item");
      setIsAddOpen(false);
      await fetchGroceryList();
    } catch (err) {
      console.error("Error adding grocery item:", err);
    }
  }

  /**
   * Remove Item
   */
  async function removeItem(itemId: string) {
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch(
        `http://10.0.2.2:3000/api/grocery-list/items/${itemId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );
      if (!res.ok) throw new Error("Failed to remove item");
      await fetchGroceryList();
    } catch (err) {
      console.error("Error removing grocery item:", err);
    }
  }

  /**
   * UI
   */
  return (
    <ThemedSafeView>
      <View className="gap-4 flex-1 px-4">
        <Text className="text-foreground text-2xl font-semibold">Grocery List</Text>

        {/* Location Button */}
        <View className="flex-row items-center">
          <Button
            variant="primary"
            className="rounded-xl"
            onPress={getLocation}
          >
            LOCATION
          </Button>
        </View>

        {/* Add Item Button */}
        <Button
          variant="outline"
          icon={{
            name: "plus-circle-outline",
            position: "left",
            size: 20,
            color: "--color-red-primary",
          }}
          className="h-14 rounded-xl shadow-lg"
          textClassName="text-lg font-bold text-red-primary"
          onPress={() => setIsAddOpen(true)}
        >
          Add Grocery Item
        </Button>

        {/* Grocery List Container */}
        <View className="bg-background rounded-xl shadow-lg p-4 flex-1">
          {/* Store Header */}
          <View className="bg-muted-background rounded-xl p-3 mb-3 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <IconSymbol name="cart-outline" size={22} color="--color-foreground" />
              <Text className="text-lg font-bold text-foreground">
                Kroger
              </Text>
            </View>

            <Text className="text-lg font-semibold text-foreground">
              Total: ${totalCost ?? "0.00"}
            </Text>
          </View>

          {/* Items */}
          {loading ? (
            <ActivityIndicator size="large" color="red" />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center mt-8">
                  <Text className="opacity-60 text-foreground">
                    Your grocery list is empty.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View className="bg-background rounded-xl shadow-lg p-4 mb-3 flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-lg font-bold text-red-primary">
                      {item.name}
                    </Text>

                    <Text className="text-foreground">
                      {item.amount} {item.unit} {typeof item.estimatedCost === "number" && ` ($${item.estimatedCost.toFixed(2)})`}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => removeItem(item.id)}
                    className="h-10 w-10 rounded-full bg-red-primary items-center justify-center shadow-lg"
                  >
                    <Text className="text-white text-2xl leading-none">
                      -
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </View>

      {/* Ingredient Modal */}
      <AddIngredientModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleSubmitNewItem}
        title="Add Grocery Item"
        nameLabel="Item Name"
        namePlaceholder="Type and select an ingredient…"
      />
    </ThemedSafeView>
  );
}
