import { ThemedSafeView } from "@/components/themed-safe-view";
import { RecipeCard } from "@/components/recipe-card";
import { fetchRecipeForList } from "@/utils/fetch-recipe-for-list";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
} from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

export default function CollectionDetailPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const id = Array.isArray(collectionId) ? collectionId[0] : collectionId;

  const [title, setTitle] = useState("");
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setRecipeIds([]);
        setRecipes([]);
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/auth/collections/${id}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setRecipeIds([]);
        setRecipes([]);
        return;
      }
      const data = await res.json();
      const col = data.collection;
      setTitle(typeof col?.name === "string" ? col.name : "");
      const ids: string[] = Array.isArray(col?.recipeIds) ? col.recipeIds : [];
      setRecipeIds(ids);

      const loaded = await Promise.all(ids.map((rid) => fetchRecipeForList(rid)));
      setRecipes(loaded.filter((r): r is Record<string, unknown> => r != null));
    } catch {
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (title) {
      navigation.setOptions({ title });
    }
  }, [title, navigation]);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : recipes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-muted-foreground">
            {recipeIds.length === 0
              ? "This collection is empty. Save recipes from a recipe page."
              : "Could not load some recipes. They may have been removed."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item, index) =>
            String((item as { id?: string }).id ?? `recipe-${index}`)
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const r = item as {
              id: string | number;
              title?: string;
              calories?: number;
              rating?: number;
              reviewCount?: number;
              reviews?: unknown[];
              image?: string | null;
            };
            const rid = String(r.id);
            const reviewsLength = Array.isArray(r.reviews)
              ? r.reviews.length
              : typeof r.reviewCount === "number"
                ? r.reviewCount
                : 0;
            return (
              <View className="mb-3">
                <RecipeCard
                  id={rid}
                  variant="horizontal"
                  title={r.title ?? "Recipe"}
                  calories={r.calories}
                  rating={r.rating}
                  reviewsLength={reviewsLength}
                  imageUrl={r.image ?? undefined}
                  onPress={() =>
                    router.push({
                      pathname: "/recipe/[recipeId]",
                      params: { recipeId: rid },
                    })
                  }
                />
              </View>
            );
          }}
        />
      )}
    </ThemedSafeView>
  );
}
