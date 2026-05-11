import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { router, Stack } from "expo-router";
import { SERVER_URL } from "@/utils/server-url";

type ScanHistoryItem = {
  id: string;
  barcode: string;
  itemName: string;
  category?: string;
  source?: string;
  scannedAt?: string;
};

export default function ScanHistoryPage() {
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const res = await fetch(`${SERVER_URL}/api/pantry/barcode-history`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch scan history");
      }

      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Fetch scan history error:", err);
      Alert.alert("Error", "Could not load scan history.");
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (clearing) return;

    console.log("CLEAR BUTTON PRESSED");

    Alert.alert(
      "Clear history?",
      "This will remove your barcode scan history.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              setClearing(true);

              const idToken = await AsyncStorage.getItem("idToken");
              if (!idToken) {
                Alert.alert("Error", "You must be logged in to clear history.");
                return;
              }

              const res = await fetch(
                `${SERVER_URL}/api/pantry/barcode-history`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${idToken}`,
                  },
                }
              );

              let data = null;

              try {
                data = await res.json();
              } catch {
                data = null;
              }

              if (!res.ok) {
                throw new Error(data?.error || "Failed to clear history");
              }

              setItems([]);
            } catch (err) {
              console.error("Clear scan history error:", err);
              Alert.alert("Error", "Could not clear scan history.");
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <ThemedSafeView className="flex-1 px-4">
        <View className="flex-row items-center justify-between mb-6">
          <Pressable
            onPress={() => router.replace("/account/pantry")}
            hitSlop={12}
            className="w-16"
          >
            <Text className="text-3xl text-foreground">‹</Text>
          </Pressable>

          <Text className="text-xl font-bold text-foreground">
            Scan History
          </Text>

          <Pressable
            onPress={clearHistory}
            disabled={clearing || items.length === 0}
            hitSlop={12}
            className="w-16 items-end"
          >
            <Text
              className={`font-semibold ${
                clearing || items.length === 0
                  ? "text-foreground opacity-40"
                  : "text-red-primary"
              }`}
            >
              {clearing ? "..." : "Clear"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="red" />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="text-center text-foreground opacity-60 mt-8">
                No scanned items yet.
              </Text>
            }
            renderItem={({ item }) => (
              <View className="bg-card rounded-2xl p-4 mb-3">
                <Text className="text-lg font-bold text-foreground">
                  {item.itemName || "Unknown item"}
                </Text>

                <Text className="text-foreground opacity-70 mt-1">
                  Barcode: {item.barcode}
                </Text>

                {!!item.category && (
                  <Text className="text-foreground opacity-70">
                    Category: {item.category}
                  </Text>
                )}

                {!!item.source && (
                  <Text className="text-foreground opacity-70">
                    Source: {item.source}
                  </Text>
                )}

                {!!item.scannedAt && (
                  <Text className="text-foreground opacity-50 mt-2">
                    Scanned: {item.scannedAt}
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </ThemedSafeView>
    </>
  );
}