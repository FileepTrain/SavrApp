import { CollectionRecipesGrid } from "@/components/collection/collection-recipes-grid";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { fetchRecipeForList } from "@/utils/fetch-recipe-for-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

export default function ProfileCollectionPreviewPage() {
  const navigation = useNavigation();
  const { ownerUid, collectionId } = useLocalSearchParams<{
    ownerUid?: string;
    collectionId?: string;
  }>();
  const owner = Array.isArray(ownerUid) ? ownerUid[0] : ownerUid;
  const cid = Array.isArray(collectionId) ? collectionId[0] : collectionId;

  const [title, setTitle] = useState("");
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selfUid, setSelfUid] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!owner || !cid) return;
    try {
      setLoading(true);
      setError(null);
      const idToken = await AsyncStorage.getItem("idToken");
      const me = await AsyncStorage.getItem("uid");
      setSelfUid(me);
      if (!idToken) {
        setError("Sign in to view this collection.");
        setRecipes([]);
        return;
      }
      const res = await fetch(
        `${SERVER_URL}/api/auth/users/${encodeURIComponent(owner)}/collections/${encodeURIComponent(cid)}/public`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not load collection.");
        setRecipes([]);
        return;
      }
      const col = data.collection;
      setTitle(typeof col?.name === "string" ? col.name : "");
      const ids: string[] = Array.isArray(col?.recipeIds) ? col.recipeIds : [];
      setRecipeIds(ids);
      const loaded = await Promise.all(ids.map((rid) => fetchRecipeForList(rid)));
      setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));

      if (me && me !== owner) {
        const st = await fetch(
          `${SERVER_URL}/api/auth/followed-collections/status?ownerUid=${encodeURIComponent(owner)}&collectionId=${encodeURIComponent(cid)}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        const stData = await st.json().catch(() => ({}));
        if (st.ok) setFollowing(Boolean(stData.following));
      }
    } catch {
      setError("Something went wrong.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [owner, cid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (title) {
      navigation.setOptions({ title });
    }
  }, [title, navigation]);

  const toggleFollow = async () => {
    if (!owner || !cid || !selfUid || selfUid === owner) return;
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return;
    setFollowBusy(true);
    try {
      if (following) {
        const res = await fetch(
          `${SERVER_URL}/api/auth/followed-collections/${encodeURIComponent(owner)}/${encodeURIComponent(cid)}`,
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
          body: JSON.stringify({ ownerUid: owner, collectionId: cid }),
        });
        if (res.ok) setFollowing(true);
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const showFollow = Boolean(selfUid && owner && selfUid !== owner);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-muted-foreground">{error}</Text>
        </View>
      ) : recipes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-muted-foreground">
            {recipeIds.length === 0
              ? "This collection is empty."
              : "Could not load some recipes. They may have been removed."}
          </Text>
        </View>
      ) : (
        <View className="flex-1">
          {showFollow ? (
            <View className="px-4 pb-3">
              <Pressable
                onPress={() => void toggleFollow()}
                disabled={followBusy}
                className={`self-start px-4 py-2 rounded-full ${
                  following ? "bg-muted-background" : "bg-red-primary"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${following ? "text-foreground" : "text-white"}`}
                >
                  {following ? "Following" : "Follow collection"}
                </Text>
              </Pressable>
            </View>
          ) : null}
          <CollectionRecipesGrid recipes={recipes} />
        </View>
      )}
    </ThemedSafeView>
  );
}
