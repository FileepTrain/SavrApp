import { CollectionTile } from "@/components/collection/collection-tile";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useCollectionCoverImages } from "@/hooks/use-collection-cover-images";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";
const GAP = 16;
/** Must match `ThemedSafeView` horizontal padding (`px-6` → 24). */
const SAFE_H_INSET = 24;

type CollectionRow = {
  id: string;
  name: string;
  recipeIds: string[];
  recipeCount: number;
  ownerUid?: string;
  ownerUsername?: string;
};

type TabId = "mine" | "followed";

export default function CollectionsPage() {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const tileWidth = useMemo(
    () => Math.max(0, Math.floor((winW - SAFE_H_INSET * 2 - GAP) / 2)),
    [winW],
  );

  const [tab, setTab] = useState<TabId>("mine");
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [followed, setFollowed] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const mineCoverRows = useMemo(
    () => collections.map((c) => ({ coverId: c.id, recipeIds: c.recipeIds })),
    [collections],
  );
  const followedCoverRows = useMemo(
    () =>
      followed.map((c) => ({
        coverId: `${c.ownerUid ?? ""}_${c.id}`,
        recipeIds: c.recipeIds,
      })),
    [followed],
  );

  const mineCovers = useCollectionCoverImages(mineCoverRows);
  const followedCovers = useCollectionCoverImages(followedCoverRows);

  const fetchMine = useCallback(async () => {
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
    setCollections(Array.isArray(data.collections) ? data.collections : []);
  }, []);

  const fetchFollowed = useCallback(async () => {
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) {
      setFollowed([]);
      return;
    }
    const res = await fetch(`${SERVER_URL}/api/auth/followed-collections`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      setFollowed([]);
      return;
    }
    const data = await res.json();
    setFollowed(Array.isArray(data.collections) ? data.collections : []);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchMine(), fetchFollowed()]);
    } catch {
      setCollections([]);
      setFollowed([]);
    } finally {
      setLoading(false);
    }
  }, [fetchMine, fetchFollowed]);

  useFocusEffect(
    useCallback(() => {
      void fetchAll();
    }, [fetchAll]),
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
      await fetchMine();
    } finally {
      setCreating(false);
    }
  };

  const confirmDelete = (item: CollectionRow) => {
    Alert.alert(
      "Delete collection",
      `Remove “${item.name}”? Recipes stay in the app; only this collection is removed.`,
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
            if (res.ok) void fetchMine();
          },
        },
      ],
    );
  };

  const unfollow = (item: CollectionRow) => {
    const owner = item.ownerUid;
    if (!owner) return;
    Alert.alert("Unfollow", `Stop following “${item.name}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unfollow",
        style: "destructive",
        onPress: async () => {
          const idToken = await AsyncStorage.getItem("idToken");
          if (!idToken) return;
          const res = await fetch(
            `${SERVER_URL}/api/auth/followed-collections/${encodeURIComponent(owner)}/${encodeURIComponent(item.id)}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } },
          );
          if (res.ok) void fetchFollowed();
        },
      },
    ]);
  };

  type MineGridRow = CollectionRow | { id: "__add__"; isAdd: true };

  const mineGridData: MineGridRow[] = useMemo(() => {
    const add: MineGridRow = { id: "__add__", isAdd: true };
    return [...collections, add];
  }, [collections]);

  const openCollection = (c: CollectionRow) => {
    if (c.ownerUid) {
      router.push({
        pathname: "/account/collection/[collectionId]",
        params: { collectionId: c.id, ownerUid: c.ownerUid },
      });
      return;
    }
    router.push({
      pathname: "/account/collection/[collectionId]",
      params: { collectionId: c.id },
    });
  };

  const renderMineItem = ({ item }: { item: MineGridRow }) => {
    if ("isAdd" in item && item.isAdd) {
      return (
        <View style={{ width: tileWidth }}>
          <CollectionTile
            width={tileWidth}
            variant="add"
            covers={undefined}
            onPress={() => setCreateOpen(true)}
          />
        </View>
      );
    }
    const c = item as CollectionRow;
    return (
      <View style={{ width: tileWidth }}>
        <CollectionTile
          width={tileWidth}
          name={c.name}
          recipeCount={c.recipeCount}
          covers={mineCovers[c.id]}
          onPress={() => openCollection(c)}
          onLongPress={() => confirmDelete(c)}
        />
      </View>
    );
  };

  const renderFollowedItem = ({ item }: { item: CollectionRow }) => {
    const coverId = `${item.ownerUid ?? ""}_${item.id}`;
    return (
      <View style={{ width: tileWidth }}>
        <CollectionTile
          width={tileWidth}
          name={item.name}
          recipeCount={item.recipeCount}
          subtitle={item.ownerUsername ? `by ${item.ownerUsername}` : undefined}
          covers={followedCovers[coverId]}
          onPress={() => openCollection(item)}
          onLongPress={() => unfollow(item)}
        />
      </View>
    );
  };

  const tabButton = (id: TabId, label: string) => {
    const on = tab === id;
    return (
      <TouchableOpacity
        key={id}
        className={`flex-1 py-2 rounded-lg justify-center ${on ? "bg-red-primary" : "bg-background"}`}
        onPress={() => setTab(id)}
      >
        <Text
          className={`text-center text-xs font-medium ${on ? "text-white" : "text-foreground"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const emptyMine = !loading && tab === "mine" && collections.length === 0;
  const emptyFollowed = !loading && tab === "followed" && followed.length === 0;

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="px-4 pb-3">
        <View className="flex-row gap-1 bg-background rounded-xl h-11 p-1 shadow-sm">
          {tabButton("mine", "My collections")}
          {tabButton("followed", "Followed collections")}
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : tab === "mine" ? (
        <FlatList
          data={mineGridData}
          keyExtractor={(r) => r.id}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{
            paddingBottom: 24,
            rowGap: GAP,
            flexGrow: emptyMine ? 1 : 0,
          }}
          ListHeaderComponent={
            emptyMine ? (
              <Text className="text-center text-muted-foreground px-6 pb-4 text-sm">
                No collections yet. Tap the tile below to create one, or save a recipe from its page.
              </Text>
            ) : null
          }
          renderItem={renderMineItem}
        />
      ) : (
        <FlatList
          data={followed}
          keyExtractor={(r) => `${r.ownerUid ?? ""}_${r.id}`}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{
            paddingBottom: 24,
            rowGap: GAP,
            flexGrow: emptyFollowed ? 1 : 0,
          }}
          ListEmptyComponent={
            <View className="flex-1 px-8 pt-8 items-center">
              <Text className="text-center text-muted-foreground text-sm">
                No followed collections yet. Open someone’s profile, go to Collections, and tap
                Follow on a board you like.
              </Text>
            </View>
          }
          renderItem={renderFollowedItem}
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
              placeholder="Collection name"
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
