import { ActivityIndicator, FlatList, Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AddIngredientModal, ExtendedIngredient } from "@/components/add-ingredient-modal";
import * as Location from "expo-location";

import { SERVER_URL } from '@/utils/server-url';
import { verticalScrollIndicatorVisible } from "@/utils/scroll-indicators";

type GroceryItem = {
  id: string;
  name: string; // product name
  ingredient: string; // original ingredient
  amount: number;
  unit: string;
  estimatedCost?: number | null;
  term?: string | null;
  productPrice?: number | null;
  productSize?: string | null;
  effectiveUnitCost?: number | null;
  productUnit?: string | null;
}

export default function GroceryListPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [manualZipDraft, setManualZipDraft] = useState("");
  const [zipcode, setZipcode] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [storeName, setStoreName] = useState("Kroger");

  function closeLocationModal() {
    setIsLocationModalOpen(false);
    setManualZipDraft("");
  }

  function handleConfirmManualZip() {
    const zipcode = manualZipDraft.trim();
    console.log("Using manual zipcode:", zipcode);
    setZipcode(zipcode);
    setLatitude(null);
    setLongitude(null);
    fetchStoreName(zipcode, null, null);
    closeLocationModal();
  }

  async function handleUseDeviceLocationFromModal() {
    await getLocation();
    closeLocationModal();
  }

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
      console.log("Using device location");
      console.log("Latitude:", latitude);
      console.log("Longitude:", longitude);
      console.log("zipcode:", zipcode)
      setLatitude(latitude);
      setLongitude(longitude);
      fetchStoreName(zipcode, null, null);

      if (zipcode) {
        setZipcode(zipcode);
      }
    } catch (error) {
      console.log("Error getting location:", error);
    }
  }

  async function fetchStoreName(
    zip?: string | null,
    lat?: number | null,
    lng?: number | null
  ) {
    try {
      let query = "";

      if (zip) {
        query = `zip=${zip}`;
      } else if (lat && lng) {
        query = `lat=${lat}&lng=${lng}`;
      } else {
        setStoreName("Kroger");
        return;
      }

      const res = await fetch(
        `${SERVER_URL}/api/kroger/quick-location?${query}`
      );

      const data = await res.json();

      if (data?.name) {
        console.log("Resolved store:", data.name);
        setStoreName(data.name);
      } else {
        setStoreName("Kroger");
      }

    } catch (err) {
      console.log("Failed to fetch store name:", err);
      setStoreName("Kroger");
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
      const res = await fetch(`${SERVER_URL}/api/grocery-list`, {
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
      const res = await fetch(`${SERVER_URL}/api/grocery-list/items`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          zipcode,
          latitude,
          longitude,
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
        `${SERVER_URL}/api/grocery-list/items/${itemId}`,
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
    <ThemedSafeView className="flex-1 bg-app-background">
      <AccountWebColumn className="flex-1 min-h-0">
        <View className="px-4 pt-2">
          <Text className="text-foreground text-2xl font-semibold">Grocery List</Text>
        </View>
        <AccountSubpageBody className="gap-4 flex-1">
        {/* Location Button */}
        <View className="flex-row items-center">
          <Button
            variant="primary"
            className="rounded-xl"
            onPress={() => setIsLocationModalOpen(true)}
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
            <View className="flex-row items-center flex-1 mr-3">
              <IconSymbol name="cart-outline" size={22} color="--color-foreground" />
              <View className="flex-1 overflow-hidden ml-2">
                <Text numberOfLines={1} ellipsizeMode="tail" className="text-base font-bold text-foreground">
                  {storeName}
                </Text>
              </View>
            </View>

            <Text className="text-lg font-semibold text-foreground">
              Total: ${typeof totalCost === "number" ? totalCost.toFixed(2) : "0.00"}
            </Text>
          </View>

          {/* Items */}
          {loading ? (
            <ActivityIndicator size="large" color="red" />
          ) : (
            <FlatList<GroceryItem>
              data={items}
              showsVerticalScrollIndicator={verticalScrollIndicatorVisible}
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
                    <Text className="text-foreground opacity-70">
                      Ingredient: {item.ingredient}
                    </Text>
                    <Text className="text-foreground">
                      Price: {item.productPrice != null ? `$${item.productPrice.toFixed(2)}` : "--"}
                    </Text>
                    <Text className="text-foreground">
                      {item.productSize ?? `${item.amount} ${item.unit}`}
                      {typeof item.effectiveUnitCost === "number" &&
                      ` ($${item.effectiveUnitCost.toFixed(2)} per ${item.productUnit ?? item.unit})`}
                      {` [${item.amount} ${item.unit} needed]`}
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
        </AccountSubpageBody>
      </AccountWebColumn>

      {/* Ingredient Modal */}
      <AddIngredientModal
        visible={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSubmit={handleSubmitNewItem}
        title="Add Grocery Item"
        nameLabel="Item Name"
        namePlaceholder="Type and select an ingredient…"
      />

      <Modal
        visible={isLocationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeLocationModal}
      >
        <Pressable
          className="flex-1 justify-center bg-black/50 px-6"
          onPress={closeLocationModal}
        >
          <Pressable
            className="bg-background rounded-xl p-5 gap-4 shadow-lg"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-foreground">
              Set location
            </Text>
            <Text className="text-sm text-foreground opacity-70">
              Enter a ZIP code or use your device location.
            </Text>
            <Input
              label="ZIP code"
              placeholder="e.g. 43215"
              value={manualZipDraft}
              onChangeText={setManualZipDraft}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View className="gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onPress={handleConfirmManualZip}
              >
                Use ZIP code
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onPress={handleUseDeviceLocationFromModal}
              >
                Use device location
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onPress={closeLocationModal}
              >
                Cancel
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedSafeView>
  );
}