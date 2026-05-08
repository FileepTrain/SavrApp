import {
  AccountSubpageBody,
  accountEmptyStateClassName,
} from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { CollectionRecipesGrid } from "@/components/collection/collection-recipes-grid";
import { useThemePalette } from "@/components/theme-provider";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useNetwork } from "@/contexts/network-context";
import { fetchRecipeForList } from "@/utils/fetch-recipe-for-list";
import {
  CACHE_KEYS,
  clearCache,
  collectionDetailKey,
  readCache,
  writeCache,
} from "@/utils/offline-cache";
import { enqueueMutation } from "@/utils/mutation-queue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SERVER_URL } from "@/utils/server-url";

type CollectionListRow = {
  id: string;
  name: string;
  recipeIds: string[];
  recipeCount: number;
  ownerUid?: string;
  ownerUsername?: string;
};

async function patchMineCollectionsListCache(
  collectionId: string,
  patch: Partial<Pick<CollectionListRow, "name" | "recipeIds" | "recipeCount">>,
) {
  const list = (await readCache<CollectionListRow[]>(CACHE_KEYS.COLLECTIONS_MINE)) ?? [];
  const next = list.map((row) =>
    row.id === collectionId
      ? {
          ...row,
          ...patch,
          recipeCount:
            patch.recipeCount ??
            (patch.recipeIds ? patch.recipeIds.length : row.recipeCount),
        }
      : row,
  );
  await writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
}

async function removeMineCollectionFromListCache(collectionId: string) {
  const list = (await readCache<CollectionListRow[]>(CACHE_KEYS.COLLECTIONS_MINE)) ?? [];
  await writeCache(
    CACHE_KEYS.COLLECTIONS_MINE,
    list.filter((r) => r.id !== collectionId),
  );
}

function BottomSheetChrome({
  visible,
  onClose,
  title,
  children,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  busy?: boolean;
}) {
  const theme = useThemePalette();
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        onPress={() => !busy && onClose()}
      >
        <Pressable
          style={{
            backgroundColor: theme["--color-background"],
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 4,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-bold text-foreground mb-3">{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function CollectionDetailPage() {
  const theme = useThemePalette();
  const { isOnline } = useNetwork();
  const navigation = useNavigation();
  const router = useRouter();
  const { collectionId, ownerUid: ownerUidParam } = useLocalSearchParams<{
    collectionId: string;
    ownerUid?: string;
  }>();
  const id = Array.isArray(collectionId) ? collectionId[0] : collectionId;
  const ownerUidRaw = Array.isArray(ownerUidParam) ? ownerUidParam[0] : ownerUidParam;

  const [title, setTitle] = useState("");
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [selfUid, setSelfUid] = useState<string | null>(null);
  const [isOthersCollection, setIsOthersCollection] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [boardMenuOpen, setBoardMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);

  const [recipeMenuRecipeId, setRecipeMenuRecipeId] = useState<string | null>(null);

  const ownerUid =
    typeof ownerUidRaw === "string" && ownerUidRaw.trim() ? ownerUidRaw.trim() : null;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      const self = await AsyncStorage.getItem("uid");
      setSelfUid(self);
      if (!idToken) {
        setRecipeIds([]);
        setRecipes([]);
        setIsOthersCollection(false);
        return;
      }

      const usePublic = Boolean(ownerUid && self && ownerUid !== self);
      setIsOthersCollection(usePublic);
      const detailScope = usePublic ? ownerUid! : "me";
      const detailKey = collectionDetailKey(detailScope, id);

      const url = usePublic
        ? `${SERVER_URL}/api/auth/users/${encodeURIComponent(ownerUid!)}/collections/${encodeURIComponent(id)}/public`
        : `${SERVER_URL}/api/auth/collections/${id}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const cached = await readCache<{ name: string; recipeIds: string[] }>(detailKey);
        if (cached) {
          setTitle(cached.name);
          const ids = Array.isArray(cached.recipeIds) ? cached.recipeIds : [];
          setRecipeIds(ids);
          const loaded = await Promise.all(ids.map((rid) => fetchRecipeForList(rid)));
          setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));
        } else {
          setRecipeIds([]);
          setRecipes([]);
        }
        if (usePublic && ownerUid && self && self !== ownerUid) {
          if (isOnline) {
            const st = await fetch(
              `${SERVER_URL}/api/auth/followed-collections/status?ownerUid=${encodeURIComponent(ownerUid)}&collectionId=${encodeURIComponent(id)}`,
              { headers: { Authorization: `Bearer ${idToken}` } },
            );
            const stData = await st.json().catch(() => ({}));
            if (st.ok) setFollowing(Boolean(stData.following));
          } else {
            const list =
              (await readCache<CollectionListRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED)) ?? [];
            setFollowing(list.some((c) => c.ownerUid === ownerUid && c.id === id));
          }
        } else {
          setFollowing(false);
        }
        return;
      }
      const col = data.collection;
      setTitle(typeof col?.name === "string" ? col.name : "");
      const ids: string[] = Array.isArray(col?.recipeIds) ? col.recipeIds : [];
      setRecipeIds(ids);

      await writeCache(detailKey, {
        name: typeof col?.name === "string" ? col.name : "",
        recipeIds: ids,
      });

      const loaded = await Promise.all(ids.map((rid) => fetchRecipeForList(rid)));
      setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));

      if (usePublic && ownerUid && self && self !== ownerUid) {
        if (isOnline) {
          const st = await fetch(
            `${SERVER_URL}/api/auth/followed-collections/status?ownerUid=${encodeURIComponent(ownerUid)}&collectionId=${encodeURIComponent(id)}`,
            { headers: { Authorization: `Bearer ${idToken}` } },
          );
          const stData = await st.json().catch(() => ({}));
          if (st.ok) setFollowing(Boolean(stData.following));
        } else {
          const list =
            (await readCache<CollectionListRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED)) ?? [];
          setFollowing(list.some((c) => c.ownerUid === ownerUid && c.id === id));
        }
      } else {
        setFollowing(false);
      }
    } catch {
      if (id) {
        const self = await AsyncStorage.getItem("uid");
        const usePublic = Boolean(ownerUid && self && ownerUid !== self);
        const detailScope = usePublic ? ownerUid! : "me";
        const cached = await readCache<{ name: string; recipeIds: string[] }>(
          collectionDetailKey(detailScope, id),
        );
        if (cached) {
          setTitle(cached.name);
          const ids = Array.isArray(cached.recipeIds) ? cached.recipeIds : [];
          setRecipeIds(ids);
          const loaded = await Promise.all(ids.map((rid) => fetchRecipeForList(rid)));
          setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));
        } else {
          setRecipes([]);
        }
      } else {
        setRecipes([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id, ownerUid, isOnline]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: title || "Collection" });
  }, [title, navigation]);

  const isOwnCollection = Boolean(selfUid && !isOthersCollection);

  const toggleFollow = useCallback(async () => {
    if (!ownerUid || !id || !selfUid || selfUid === ownerUid) return;
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return;
    setFollowBusy(true);
    try {
      if (!isOnline) {
        if (following) {
          await enqueueMutation({
            type: "UNFOLLOW_COLLECTION",
            payload: { ownerUid, collectionId: id },
          });
          setFollowing(false);
          const list =
            (await readCache<CollectionListRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED)) ?? [];
          await writeCache(
            CACHE_KEYS.COLLECTIONS_FOLLOWED,
            list.filter((c) => !(c.ownerUid === ownerUid && c.id === id)),
          );
        } else {
          await enqueueMutation({
            type: "FOLLOW_COLLECTION",
            payload: { ownerUid, collectionId: id },
          });
          setFollowing(true);
          const list =
            (await readCache<CollectionListRow[]>(CACHE_KEYS.COLLECTIONS_FOLLOWED)) ?? [];
          const exists = list.some((c) => c.ownerUid === ownerUid && c.id === id);
          if (!exists) {
            const row: CollectionListRow = {
              id,
              name: title || "Collection",
              recipeIds: [...recipeIds],
              recipeCount: recipeIds.length,
              ownerUid,
            };
            await writeCache(CACHE_KEYS.COLLECTIONS_FOLLOWED, [...list, row]);
          }
        }
        return;
      }
      if (following) {
        const res = await fetch(
          `${SERVER_URL}/api/auth/followed-collections/${encodeURIComponent(ownerUid)}/${encodeURIComponent(id)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } },
        );
        if (res.ok) setFollowing(false);
      } else {
        const res = await fetch(`${SERVER_URL}/api/auth/followed-collections`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ownerUid, collectionId: id }),
        });
        if (res.ok) setFollowing(true);
      }
    } finally {
      setFollowBusy(false);
    }
  }, [ownerUid, id, selfUid, following, isOnline, title, recipeIds]);

  useLayoutEffect(() => {
    if (loading) return;
    navigation.setOptions({
      headerRight: () => {
        if (isOwnCollection) {
          return (
            <TouchableOpacity
              onPress={() => setBoardMenuOpen(true)}
              className="py-2 pl-2"
              accessibilityLabel="Collection options"
            >
              <IconSymbol name="pencil-outline" size={24} color="--color-red-primary" />
            </TouchableOpacity>
          );
        }
        if (isOthersCollection && ownerUid && selfUid && selfUid !== ownerUid) {
          return (
            <TouchableOpacity
              onPress={() => void toggleFollow()}
              disabled={followBusy}
              className="py-2 pl-2 pr-1"
              accessibilityLabel={following ? "Unfollow collection" : "Follow collection"}
            >
              {followBusy ? (
                <ActivityIndicator size="small" color="red" />
              ) : (
                <Text className="text-red-primary font-semibold text-base">
                  {following ? "Following" : "Follow"}
                </Text>
              )}
            </TouchableOpacity>
          );
        }
        return null;
      },
    });
  }, [
    navigation,
    loading,
    isOwnCollection,
    isOthersCollection,
    ownerUid,
    selfUid,
    following,
    followBusy,
    toggleFollow,
  ]);

  const patchCollection = async (body: Record<string, unknown>) => {
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken || !id) return false;
    const res = await fetch(`${SERVER_URL}/api/auth/collections/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return res.ok;
  };

  const saveRename = async () => {
    const name = draftName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter a collection name.");
      return;
    }
    try {
      setSaving(true);
      if (!isOnline && isOwnCollection && id) {
        await enqueueMutation({ type: "PATCH_COLLECTION", payload: { collectionId: id, name } });
        setTitle(name);
        await patchMineCollectionsListCache(id, { name });
        await writeCache(collectionDetailKey("me", id), { name, recipeIds: [...recipeIds] });
        setRenameOpen(false);
        return;
      }
      const ok = await patchCollection({ name });
      if (!ok) {
        Alert.alert("Could not save", "Try again.");
        return;
      }
      setTitle(name);
      setRenameOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const setCoverRecipe = async (recipeId: string) => {
    const next = [recipeId, ...recipeIds.filter((r) => r !== recipeId)];
    try {
      setSaving(true);
      if (!isOnline && isOwnCollection && id) {
        await enqueueMutation({
          type: "PATCH_COLLECTION",
          payload: { collectionId: id, recipeIds: next },
        });
        setRecipeIds(next);
        await writeCache(collectionDetailKey("me", id), { name: title, recipeIds: next });
        await patchMineCollectionsListCache(id, { recipeIds: next, recipeCount: next.length });
        const loaded = await Promise.all(next.map((rid) => fetchRecipeForList(rid)));
        setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));
        return;
      }
      const ok = await patchCollection({ recipeIds: next });
      if (!ok) {
        Alert.alert("Could not update cover", "Try again.");
        return;
      }
      setRecipeIds(next);
      const loaded = await Promise.all(next.map((rid) => fetchRecipeForList(rid)));
      setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));
    } finally {
      setSaving(false);
    }
  };

  const removeRecipeFromCollection = (recipeId: string) => {
    setRecipeMenuRecipeId(null);
    Alert.alert(
      "Remove from collection",
      "This recipe will stay in the app; it is only removed from this collection.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const idToken = await AsyncStorage.getItem("idToken");
            if (!idToken || !id) return;
            if (!isOnline && isOwnCollection) {
              await enqueueMutation({
                type: "REMOVE_COLLECTION_RECIPE",
                payload: { collectionId: id, recipeId },
              });
              const next = recipeIds.filter((r) => r !== recipeId);
              setRecipeIds(next);
              setRecipes((prev) => prev.filter((r) => String((r as { id?: string }).id) !== recipeId));
              await writeCache(collectionDetailKey("me", id), { name: title, recipeIds: next });
              await patchMineCollectionsListCache(id, { recipeIds: next, recipeCount: next.length });
              return;
            }
            const res = await fetch(
              `${SERVER_URL}/api/auth/collections/${id}/recipes/${encodeURIComponent(recipeId)}`,
              { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } },
            );
            if (res.ok) void load();
          },
        },
      ],
    );
  };

  const confirmDeleteBoard = () => {
    setBoardMenuOpen(false);
    Alert.alert(
      "Delete collection",
      "Recipes stay in the app; only this collection is removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const idToken = await AsyncStorage.getItem("idToken");
            if (!idToken || !id) return;
            if (!isOnline) {
              await enqueueMutation({ type: "DELETE_COLLECTION", payload: { collectionId: id } });
              await removeMineCollectionFromListCache(id);
              await clearCache(collectionDetailKey("me", id));
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                router.replace("/account/collections");
              }
              return;
            }
            const res = await fetch(`${SERVER_URL}/api/auth/collections/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                router.replace("/account/collections");
              }
            } else {
              Alert.alert("Could not delete", "Try again.");
            }
          },
        },
      ],
    );
  };

  const recipeMenuIsCover =
    recipeMenuRecipeId != null && recipeIds[0] === recipeMenuRecipeId;

  const emptyMessage =
    recipeIds.length === 0
      ? isOwnCollection
        ? "This collection is empty. Save recipes from a recipe page."
        : "This collection is empty."
      : "Could not load some recipes. They may have been removed.";

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <AccountWebColumn className="flex-1 min-h-0">
        <AccountSubpageBody>
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="red" />
          </View>
        ) : recipes.length === 0 ? (
          <View className="flex-1 items-center justify-center px-2">
            <Text className={accountEmptyStateClassName}>{emptyMessage}</Text>
            {isOwnCollection ? (
              <Text className={`${accountEmptyStateClassName} mt-3`}>
                Use the pencil above to rename or delete this collection. After you add recipes, use ⋮
                on a tile for cover image or remove.
              </Text>
            ) : null}
          </View>
        ) : (
          <CollectionRecipesGrid
            recipes={recipes}
            showRecipeMenuButton={isOwnCollection}
            onRecipeMenuPress={(rid) => setRecipeMenuRecipeId(rid)}
          />
        )}
        </AccountSubpageBody>
      </AccountWebColumn>

      <BottomSheetChrome
        visible={boardMenuOpen}
        onClose={() => setBoardMenuOpen(false)}
        title="Collection"
        busy={saving}
      >
        <TouchableOpacity
          className="py-4 border-b border-muted-background"
          onPress={() => {
            setBoardMenuOpen(false);
            setDraftName(title);
            setRenameOpen(true);
          }}
          disabled={saving}
        >
          <Text className="text-foreground text-base font-medium">Change name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="py-4"
          onPress={confirmDeleteBoard}
          disabled={saving}
        >
          <Text className="text-red-primary text-base font-semibold">Delete collection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="py-3 mt-2 rounded-xl bg-muted-background items-center"
          onPress={() => setBoardMenuOpen(false)}
        >
          <Text className="font-medium text-foreground">Cancel</Text>
        </TouchableOpacity>
      </BottomSheetChrome>

      <BottomSheetChrome
        visible={recipeMenuRecipeId != null}
        onClose={() => setRecipeMenuRecipeId(null)}
        title="Recipe"
        busy={saving}
      >
        {!recipeMenuIsCover ? (
          <TouchableOpacity
            className="py-4 border-b border-muted-background"
            onPress={async () => {
              const rid = recipeMenuRecipeId;
              if (!rid) return;
              setRecipeMenuRecipeId(null);
              await setCoverRecipe(rid);
            }}
            disabled={saving}
          >
            <Text className="text-foreground text-base font-medium">Make cover image</Text>
          </TouchableOpacity>
        ) : (
          <View className="py-3 border-b border-muted-background">
            <Text className="text-muted-foreground text-sm">This recipe is already the cover.</Text>
          </View>
        )}
        <TouchableOpacity
          className="py-4"
          onPress={() => {
            const rid = recipeMenuRecipeId;
            if (rid) removeRecipeFromCollection(rid);
          }}
          disabled={saving}
        >
          <Text className="text-red-primary text-base font-semibold">Remove from collection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="py-3 mt-2 rounded-xl bg-muted-background items-center"
          onPress={() => setRecipeMenuRecipeId(null)}
        >
          <Text className="font-medium text-foreground">Cancel</Text>
        </TouchableOpacity>
      </BottomSheetChrome>

      <Modal visible={renameOpen} animationType="slide" transparent>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          onPress={() => !saving && setRenameOpen(false)}
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
            <Text className="text-xl font-bold text-foreground">Rename collection</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Collection name"
              placeholderTextColor="#888"
              className="border border-muted-background rounded-xl px-4 py-3 text-foreground text-base"
              editable={!saving}
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl bg-muted-background items-center"
                onPress={() => !saving && setRenameOpen(false)}
              >
                <Text className="font-medium text-foreground">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3 rounded-xl items-center"
                style={{ backgroundColor: theme["--color-red-primary"] }}
                onPress={() => void saveRename()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold" style={{ color: "#ffffff" }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedSafeView>
  );
}
