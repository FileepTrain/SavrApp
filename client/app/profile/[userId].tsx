import { ThemedSafeView } from "@/components/themed-safe-view";
import { RecipeCard } from "@/components/recipe-card";
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

type RecipeRow = {
  id: string;
  title?: string;
  image?: string | null;
  calories?: number;
  reviewCount?: number;
  totalStars?: number;
  reviews?: unknown[];
};

export default function CreatorProfilePage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const uid = Array.isArray(userId) ? userId[0] : userId;

  const [username, setUsername] = useState<string>("");
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setLoading(true);
      setError(null);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setError("Sign in to view profiles.");
        setRecipes([]);
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/recipes/by-user/${encodeURIComponent(uid)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not load profile.");
        setRecipes([]);
        setUsername("");
        return;
      }
      setUsername(typeof data.username === "string" ? data.username : "User");
      const list: RecipeRow[] = Array.isArray(data.recipes) ? data.recipes : [];
      setRecipes(list);
    } catch {
      setError("Something went wrong.");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (username) {
      navigation.setOptions({ title: username });
    }
  }, [username, navigation]);

  const initial = (username || "?").trim().slice(0, 1).toUpperCase() || "?";

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="px-4 pb-4 flex-row items-center gap-4">
        <View className="w-16 h-16 rounded-full bg-red-primary/15 items-center justify-center">
          <Text className="text-2xl font-bold text-red-primary">{initial}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs">Creator</Text>
          <Text className="text-foreground text-xl font-bold" numberOfLines={2}>
            {loading && !username ? "…" : username || "User"}
          </Text>
          {!loading && (
            <Text className="text-muted-foreground text-sm mt-0.5">
              {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
            </Text>
          )}
        </View>
      </View>

      {error ? (
        <Text className="text-center text-muted-foreground px-6">{error}</Text>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={
            !error ? (
              <Text className="text-center text-muted-foreground py-8">
                No personal recipes yet.
              </Text>
            ) : null
          }
          renderItem={({ item }) => {
            const reviewCount =
              typeof item.reviewCount === "number"
                ? item.reviewCount
                : Array.isArray(item.reviews)
                  ? item.reviews.length
                  : 0;
            const totalStars: number =
              typeof item.totalStars === "number"
                ? item.totalStars
                : Array.isArray(item.reviews)
                  ? (item.reviews as { rating?: number }[]).reduce<number>(
                      (s, rev) => s + (rev?.rating ?? 0),
                      0,
                    )
                  : 0;
            const rating: number =
              reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;
            return (
              <View className="mb-3">
                <RecipeCard
                  id={item.id}
                  variant="horizontal"
                  title={item.title ?? "Recipe"}
                  calories={item.calories}
                  rating={rating}
                  reviewsLength={reviewCount}
                  imageUrl={item.image ?? undefined}
                  onPress={() =>
                    router.push({
                      pathname: "/recipe/[recipeId]",
                      params: { recipeId: item.id },
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
