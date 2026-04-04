import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { fetchRecipeForList } from "@/utils/fetch-recipe-for-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";
const H_PAD = 16;
const TILE_GAP = 12;
const tileWidth = (Dimensions.get("window").width - H_PAD * 2 - TILE_GAP) / 2;

type CollectionRow = {
  id: string;
  name: string;
  recipeIds: string[];
  recipeCount: number;
};

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCovers = useCallback(async (rows: CollectionRow[]) => {
    const next: Record<string, string | null> = {};
    await Promise.all(
      rows.map(async (c) => {
        const firstId = c.recipeIds[0];
        if (!firstId) {
          next[c.id] = null;
          return;
        }
        const r = await fetchRecipeForList(firstId);
        const img =
          r && typeof (r as { image?: string }).image === "string"
            ? (r as { image: string }).image
            : null;
        next[c.id] = img;
      }),
    );
    setCovers(next);
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setCollections([]);
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setCollections([]);
        return;
      }
      const data = await res.json();
      const rows: CollectionRow[] = Array.isArray(data.collections) ? data.collections : [];
      setCollections(rows);
      loadCovers(rows);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [loadCovers]);

  useFocusEffect(
    useCallback(() => {
      fetchCollections();
    }, [fetchCollections]),
  );

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert("Name required", "Give your collection a name.");
      return;
    }
    try {
      setCreating(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Could not create", err?.error || "Try again.");
        return;
      }
      setNewName("");
      setCreateOpen(false);
      await fetchCollections();
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (item: CollectionRow) => {
    Alert.alert(
      "Delete collection",
      `Remove “${item.name}”? Recipes stay in the app; only this board is deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const idToken = await AsyncStorage.getItem("idToken");
            if (!idToken) return;
            const res = await fetch(`${SERVER_URL}/api/auth/collections/${item.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) fetchCollections();
          },
        },
      ],
    );
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="px-4 pb-3 flex-row items-center justify-between">
        <Text className="text-muted-foreground text-sm flex-1 pr-2">
          Group recipes into boards. Saving here does not change favorites.
        </Text>
        <TouchableOpacity
          onPress={() => setCreateOpen(true)}
          className="bg-red-primary px-3 py-2 rounded-xl flex-row items-center gap-1"
        >
          <IconSymbol name="plus" size={20} color="#fff" />
          <Text className="text-white font-semibold text-sm">New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : collections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <IconSymbol name="folder-outline" size={48} color="--color-muted-foreground" />
          <Text className="text-center text-muted-foreground">
            No collections yet. Tap New to create a board, or save a recipe from its page.
          </Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={{ width: tileWidth }}
              onPress={() =>
                router.push({
                  pathname: "/account/collection/[collectionId]",
                  params: { collectionId: item.id },
                })
              }
              onLongPress={() => confirmDelete(item)}
            >
              <View className="rounded-2xl overflow-hidden bg-background shadow-sm border border-border">
                <View className="aspect-[4/5] bg-muted-background">
                  {covers[item.id] ? (
                    <Image
                      source={{ uri: covers[item.id]! }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <IconSymbol name="image-outline" size={36} color="--color-icon" />
                    </View>
                  )}
                </View>
                <View className="p-3 gap-1">
                  <Text className="text-foreground font-semibold" numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text className="text-muted-foreground text-sm">
                    {item.recipeCount} {item.recipeCount === 1 ? "recipe" : "recipes"}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" transparent>
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => !creating && setCreateOpen(false)}
        >
          <Pressable
            className="bg-background rounded-t-3xl p-5 gap-4"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-xl font-bold text-foreground">New collection</Text>
            <TextInput
              placeholder="Board name"
              placeholderTextColor="#888"
              value={newName}
              onChangeText={setNewName}
              className="border border-border rounded-xl px-4 py-3 text-foreground text-base"
              editable={!creating}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-muted-background items-center"
                onPress={() => !creating && setCreateOpen(false)}
              >
                <Text className="font-medium text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-red-primary items-center"
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-white">Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedSafeView>
  );
}
