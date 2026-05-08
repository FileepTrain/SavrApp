import {
  AccountSubpageBody,
  accountEmptyStateClassName,
} from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { RecipeCard } from "@/components/recipe-card";
import {
  clearRecipeViewHistory,
  loadRecipeViewHistory,
  type RecipeViewHistoryEntry,
} from "@/utils/recipe-view-history";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function RecipeHistoryPage() {
  const [items, setItems] = useState<RecipeViewHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await loadRecipeViewHistory();
    setItems(list);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const handleClear = useCallback(() => {
    void (async () => {
      await clearRecipeViewHistory();
      setItems([]);
    })();
  }, []);

  return (
    <ThemedSafeView className="flex-1 bg-app-background pt-safe-or-20">
      <AccountWebColumn className="flex-1 min-h-0">
        <AccountSubpageBody>
        <View className="flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className={accountEmptyStateClassName}>Loading…</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 px-2 justify-center">
            <Text className={accountEmptyStateClassName}>
              Recipes you viewed will appear here.
            </Text>
          </View>
        ) : (
          // Create a list of recipe cards for each item in the history
          <ScrollView className="flex-1 pt-2" showsVerticalScrollIndicator={false}>
            <View className="gap-3 pb-4">
              {items.map((item) => (
                <RecipeCard
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  calories={item.calories}
                  rating={item.rating}
                  reviewsLength={item.reviewsLength}
                  variant="horizontal"
                  imageUrl={item.imageUrl}
                />
              ))}
            </View>
          </ScrollView>
        )}

        {/* Quick action: Clear history button */}
        <View className="pt-3 pb-2 border-t border-muted-background">
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleClear}
              disabled={loading || items.length === 0}
              className={`flex-1 bg-background rounded-xl h-12 items-center justify-center shadow-sm ${loading || items.length === 0 ? "opacity-40" : ""
                }`}
            >
              <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Clear history</Text>
            </Pressable>
          </View>
        </View>
        </View>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}
