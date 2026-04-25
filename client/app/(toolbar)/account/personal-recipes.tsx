import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Text, View } from "react-native";

import {
  AccountSubpageBody,
  accountCardShellClassName,
  accountEmptyStateClassName,
  accountPrimaryCtaTextClassName,
} from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { SwipeableRecipeCard } from "@/components/swipeable-recipe-card";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { useNetwork } from "@/contexts/network-context";
import { usePersonalRecipes } from "@/contexts/personal-recipes-context";

export default function PersonalRecipesPage() {
  const { recipes: personalRecipes, loading, error, refetch } = usePersonalRecipes();
  const { isOnline } = useNetwork();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await refetch?.();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <AccountWebColumn className="flex-1 min-h-0">
        <AccountSubpageBody>
        <View className="gap-4 flex-1">
        <View className={accountCardShellClassName}>
          <Button
            variant="primary"
            icon={{
              name: "plus-circle-outline",
              position: "left",
              size: 20,
              color: "--color-red-primary",
            }}
            className="h-[77px] rounded-none"
            textClassName={accountPrimaryCtaTextClassName}
            onPress={() => {
              if (!isOnline) {
                Alert.alert("Offline", "Creating new recipes requires an internet connection.");
                return;
              }
              router.push("/account/create-recipe");
            }}
          >
            Create New Recipe
          </Button>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="red" />
        ) : error ? (
          <View className="flex-1 items-center justify-center px-2">
            <Text className={`${accountEmptyStateClassName} mb-3`}>Error: {String(error)}</Text>
            <Button variant="default" onPress={() => refetch?.()}>
              Reload
            </Button>
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={personalRecipes ?? []}
            keyExtractor={(item) => String(item.id)}
            refreshing={refreshing}
            onRefresh={onRefresh}
            contentContainerStyle={{
              paddingBottom: 24,
              flexGrow: (personalRecipes?.length ?? 0) === 0 ? 1 : 0,
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <Text className={accountEmptyStateClassName}>
                  No personal recipes yet. Tap “Create New Recipe”.
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View className="mb-3 w-full">
                <SwipeableRecipeCard
                  id={item.id}
                  title={item.title ?? "Untitled"}
                  calories={item.calories ?? 0}
                  rating={item.rating ?? 0}
                  reviewsLength={Array.isArray(item.reviews) ? item.reviews.length : 0}
                  image={item.image ?? null}
                />
              </View>
            )}
          />
        )}
        </View>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}
