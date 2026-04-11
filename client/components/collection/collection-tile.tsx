import { IconSymbol } from "@/components/ui/icon-symbol";
import type { CollectionCoverTriple } from "@/hooks/use-collection-cover-images";
import React from "react";
import { Image, Pressable, Text, TouchableOpacity, View } from "react-native";

/** Width:height = 3:2 (landscape cover, not tall portrait). */
const COLLECTION_COVER_ASPECT = 3 / 2;

type CollectionTileProps = {
  width: number;
  name?: string;
  recipeCount?: number;
  subtitle?: string;
  covers: CollectionCoverTriple | undefined;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: "collection" | "add";
  /** ⋮ on the cover (e.g. profile collections → follow menu). */
  showMenuButton?: boolean;
  onMenuPress?: () => void;
};

function Mosaic({ covers, width }: { covers: CollectionCoverTriple | undefined; width: number }) {
  const main = covers?.main ?? null;
  const top = covers?.smallTop ?? null;
  const bottom = covers?.smallBottom ?? null;

  return (
    <View
      className="rounded-2xl overflow-hidden bg-muted-background flex-row shadow-sm"
      style={{ width, aspectRatio: COLLECTION_COVER_ASPECT }}
    >
      <View className="flex-[3] bg-muted-background">
        {main ? (
          <Image source={{ uri: main }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <IconSymbol name="image-outline" size={32} color="--color-icon" />
          </View>
        )}
      </View>
      <View className="flex-1 pl-0.5 gap-0.5 justify-stretch">
        <View className="flex-1 rounded-tr-xl overflow-hidden bg-muted-background">
          {top ? (
            <Image source={{ uri: top }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="flex-1 bg-muted-background/80" />
          )}
        </View>
        <View className="flex-1 rounded-br-xl overflow-hidden bg-muted-background">
          {bottom ? (
            <Image source={{ uri: bottom }} className="w-full h-full" resizeMode="cover" />
          ) : (
            <View className="flex-1 bg-muted-background/80" />
          )}
        </View>
      </View>
    </View>
  );
}

export function CollectionTile({
  width,
  name,
  recipeCount,
  subtitle,
  covers,
  onPress,
  onLongPress,
  variant = "collection",
  showMenuButton,
  onMenuPress,
}: CollectionTileProps) {
  if (variant === "add") {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="New collection">
        <View
          className="rounded-2xl overflow-hidden bg-muted-background items-center justify-center shadow-sm"
          style={{ width, aspectRatio: COLLECTION_COVER_ASPECT }}
        >
          <IconSymbol name="plus" size={40} color="--color-muted-foreground" />
        </View>
        <View className="pt-2 gap-0.5">
          <Text className="text-muted-foreground text-sm font-medium text-center">New</Text>
        </View>
      </Pressable>
    );
  }

  const countLabel =
    typeof recipeCount === "number"
      ? `${recipeCount} ${recipeCount === 1 ? "recipe" : "recipes"}`
      : "";

  return (
    <View style={{ width }}>
      <View className="relative">
        <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={400}>
          <Mosaic covers={covers} width={width} />
        </Pressable>
        {showMenuButton && onMenuPress ? (
          <TouchableOpacity
            onPress={() => onMenuPress()}
            className="absolute top-2 right-2 rounded-full bg-background/95 p-1.5 shadow-sm"
            style={{ zIndex: 2 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Collection options"
          >
            <IconSymbol name="dots-vertical" size={22} color="--color-foreground" />
          </TouchableOpacity>
        ) : null}
      </View>
      <View className="pt-2 gap-1">
        <Text className="text-foreground font-semibold" numberOfLines={2}>
          {name ?? "Untitled"}
        </Text>
        {subtitle ? (
          <Text className="text-muted-foreground text-xs" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : countLabel ? (
          <Text className="text-muted-foreground text-sm">{countLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}
