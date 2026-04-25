import {
  ACCOUNT_SUBPAGE_BODY_H_INSET,
  AccountSubpageBody,
  accountEmptyStateClassName,
} from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { CollectionTile } from "@/components/collection/collection-tile";
import { useThemePalette } from "@/components/theme-provider";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useAccountWebColumnWidth } from "@/hooks/use-account-web-column-width";
import { useNetwork } from "@/contexts/network-context";
import { useCollectionCoverImages } from "@/hooks/use-collection-cover-images";
import { CACHE_KEYS, clearCache, collectionDetailKey, readCache, writeCache } from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { SERVER_URL } from "@/utils/server-url";

function newClientCollectionId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
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

function normalizeMineCollectionCache(rows: CollectionRow[]): CollectionRow[] {
  return rows.map((c) => {
    const recipeIds = Array.isArray(c.recipeIds) ? c.recipeIds : [];
    return {
      ...c,
      recipeIds,
      recipeCount:
        typeof c.recipeCount === "number" ? c.recipeCount : recipeIds.length,
    };
  });
}

type TabId = "mine" | "followed";

export default function CollectionsPage() {
  const theme = useThemePalette();
  const router = useRouter();
  const { isOnline, registerReconnectCallback, unregisterReconnectCallback } = useNetwork();
  const { width: winW } = useWindowDimensions();
  const accountColumnWidth = useAccountWebColumnWidth();
  const tileWidth = useMemo(() => {
    const inner =
      accountColumnWidth != null
        ? accountColumnWidth - ACCOUNT_SUBPAGE_BODY_H_INSET
        : Math.max(0, winW - SAFE_H_INSET * 2 - ACCOUNT_SUBPAGE_BODY_H_INSET);
    return Math.max(0, Math.floor((inner - GAP) / 2));
  }, [winW, accountColumnWidth]);

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
    if (!isOnline) {
      const cached = await readCache<CollectionRow[]>(CACHE_KEYS.COLLECTIONS_MINE);
      setCollections(Array.isArray(cached) ? normalizeMineCollectionCache(cached) : []);
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const cached = await readCache<CollectionRow[]>(CACHE_KEYS.COLLECTIONS_MINE);
        setCollections(Array.isArray(cached) ? normalizeMineCollectionCache(cached) : []);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data.collections) ? data.collections : [];
      setCollections(list);
      await writeCache(CACHE_KEYS.COLLECTIONS_MINE, list);
    } catch {
      const cached = await readCache<CollectionRow[]>(CACHE_KEYS.COLLECTIONS_MINE);
      setCollections(Array.isArray(cached) ? normalizeMineCollectionCache(cached) : []);
    }
  }, [isOnline]);

  const fetchFollowed = useCallback(async () => {
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) {
      setFollowed([]);
      return;
    }
    if (!isOnline) {
      const cached = await readCache<CollectionRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED);
      setFollowed(Array.isArray(cached) ? cached : []);
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/followed-collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const cached = await readCache<CollectionRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED);
        setFollowed(Array.isArray(cached) ? cached : []);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data.collections) ? data.collections : [];
      setFollowed(list);
      await writeCache(CACHE_KEYS.COLLECTIONS_FOLLOWED, list);
    } catch {
      const cached = await readCache<CollectionRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED);
      setFollowed(Array.isArray(cached) ? cached : []);
    }
  }, [isOnline]);

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

  useEffect(() => {
    registerReconnectCallback("collections", fetchAll);
    return () => unregisterReconnectCallback("collections");
  }, [fetchAll, registerReconnectCallback, unregisterReconnectCallback]);

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
      if (!isOnline) {
        const clientCollectionId = newClientCollectionId();
        await enqueueMutation({
          type: "CREATE_COLLECTION",
          payload: { clientCollectionId, name },
        });
        const row: CollectionRow = {
          id: clientCollectionId,
          name,
          recipeIds: [],
          recipeCount: 0,
        };
        setCollections((prev) => {
          const next = [row, ...prev];
          void writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
          return next;
        });
        await writeCache(collectionDetailKey("me", clientCollectionId), {
          name,
          recipeIds: [] as string[],
        });
        setNewName("");
        setCreateOpen(false);
        return;
      }
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
            if (!isOnline) {
              await enqueueMutation({ type: "DELETE_COLLECTION", payload: { collectionId: item.id } });
              setCollections((prev) => {
                const next = prev.filter((c) => c.id !== item.id);
                void writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
                return next;
              });
              await clearCache(collectionDetailKey("me", item.id));
              return;
            }
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
          if (!isOnline) {
            await enqueueMutation({
              type: "UNFOLLOW_COLLECTION",
              payload: { ownerUid: owner, collectionId: item.id },
            });
            setFollowed((prev) => {
              const next = prev.filter((c) => !(c.ownerUid === owner && c.id === item.id));
              void writeCache(CACHE_KEYS.COLLECTIONS_FOLLOWED, next);
              return next;
            });
            return;
          }
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
      <AccountWebColumn className="flex-1 min-h-0">
        <AccountSubpageBody>
        <View className="pb-3">
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
            style={{ flex: 1 }}
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
              <Text className={`${accountEmptyStateClassName} px-2 pb-4`}>
                No collections yet. Tap the tile below to create one, or save a recipe from its page.
              </Text>
            ) : null
          }
            renderItem={renderMineItem}
          />
        ) : (
          <FlatList
            style={{ flex: 1 }}
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
            <View className="flex-1 px-2 pt-8 items-center">
              <Text className={accountEmptyStateClassName}>
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
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
            onPress={() => !creating && setCreateOpen(false)}
          >
            <Pressable
              style={{
                backgroundColor: theme["--color-background"],
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 20,
                gap: 16,
              }}
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
                  className="flex-1 py-3 rounded-xl items-center"
                  style={{ backgroundColor: theme["--color-red-primary"] }}
                  onPress={handleCreate}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-semibold" style={{ color: "#ffffff" }}>
                      Create
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}
