import { RecipeCard } from "@/components/recipe-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, TouchableOpacity, useWindowDimensions, View } from "react-native";

type RecipeRow = {
  id: string | number;
  title?: string;
  calories?: number;
  rating?: number;
  reviewCount?: number;
  reviews?: unknown[];
  image?: string | null;
};

const GAP = 16;
/** Matches ThemedSafeView `px-6` when list is full-width inside it. */
const FALLBACK_INSET = 24;

type CollectionRecipesGridProps = {
  recipes: Record<string, unknown>[];
  /** Show ⋮ on each tile; calls back when tapped (open recipe actions sheet). */
  showRecipeMenuButton?: boolean;
  onRecipeMenuPress?: (recipeId: string) => void;
};

export function CollectionRecipesGrid({
  recipes,
  showRecipeMenuButton,
  onRecipeMenuPress,
}: CollectionRecipesGridProps) {
  const router = useRouter();
  const { width: winW } = useWindowDimensions();
  const [listW, setListW] = useState(0);

  const tileWidth = useMemo(() => {
    const inner =
      listW > 0 ? listW : Math.max(0, winW - FALLBACK_INSET * 2);
    return Math.max(0, Math.floor((inner - GAP) / 2));
  }, [listW, winW]);

  return (
    <View className="flex-1" onLayout={(e) => setListW(e.nativeEvent.layout.width)}>
      <FlatList
        data={recipes}
        style={{ flex: 1 }}
        keyExtractor={(item, index) =>
          String((item as { id?: string }).id ?? `recipe-${index}`)
        }
        numColumns={2}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{
          paddingBottom: 24,
          rowGap: GAP,
        }}
        renderItem={({ item }) => {
          const r = item as RecipeRow;
          const rid = String(r.id);
          const reviewsLength = Array.isArray(r.reviews)
            ? r.reviews.length
            : typeof r.reviewCount === "number"
              ? r.reviewCount
              : 0;
          return (
            <View style={{ width: tileWidth }} className="relative">
              <RecipeCard
                id={rid}
                variant="default"
                tileWidth={tileWidth}
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
              {showRecipeMenuButton && onRecipeMenuPress ? (
                <TouchableOpacity
                  onPress={() => onRecipeMenuPress(rid)}
                  className="absolute top-2 right-2 rounded-full bg-background/95 p-1.5 shadow-sm"
                  style={{ zIndex: 2 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Recipe options"
                >
                  <IconSymbol name="dots-vertical" size={22} color="--color-foreground" />
                </TouchableOpacity>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
