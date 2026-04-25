import { View, Text, Image, Pressable } from "react-native";
import { Link } from "expo-router";
import React from "react";
import RecipeRating from "./recipe/recipe-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";


type CardVariant = "horizontal" | "default";


interface RecipeCardProps {
  id: string;
  title: string;
  calories?: number;
  rating?: number;
  reviewsLength?: number;
  variant?: CardVariant;
  imageUrl?: string | null;
  /** When set with variant "default", card width matches grid columns (e.g. trending). */
  tileWidth?: number;
  /** Taller card + larger image for wide web grids (use with `tileWidth`). */
  prominent?: boolean;
  onPress?: () => void; // if provided uses Pressable; else Link to details
  onLongPress?: () => void;
}

// Recipe Card default information
export const RecipeCard = ({
  id,
  title,
  calories = 0,
  rating = 0,
  reviewsLength = 0,
  variant = "default",
  imageUrl = null,
  tileWidth,
  prominent = false,
  onPress,
  onLongPress,
}: RecipeCardProps) => {
  const hasImage = typeof imageUrl === "string" && imageUrl.trim().length > 0;

  const noImagePlaceholder = (iconSize: number) => (
    <View className="h-full w-full items-center justify-center bg-muted-background">
      <IconSymbol name="image-outline" size={iconSize} color="--color-muted-foreground" />
    </View>
  );

  let cardContent;

  // Recipe card default layout
  if (variant === "default") {
    const widthStyle = tileWidth != null ? { width: tileWidth } : undefined;
    /**
     * Desktop grid: 4 across × 3 down → width:height = 4:3 (landscape tile).
     * Image fills most of the height so the meta strip stays short.
     */
    const desktopGridProminent = Boolean(prominent && tileWidth != null);
    let cardHeightPx: number | undefined;
    let imageHeight: number;
    /** Desktop grid footer height (must match image reserve below). */
    let desktopFooterMin: number | undefined;
    if (desktopGridProminent && tileWidth != null) {
      cardHeightPx = Math.round((tileWidth * 3) / 4);
      desktopFooterMin = 88;
      imageHeight = Math.max(64, cardHeightPx - desktopFooterMin);
    } else if (prominent) {
      cardHeightPx = undefined;
      desktopFooterMin = undefined;
      imageHeight = 160;
    } else {
      cardHeightPx = undefined;
      desktopFooterMin = undefined;
      imageHeight = 112;
    }

    cardContent = (
      <View
        className={`bg-background rounded-2xl overflow-hidden flex-col drop-shadow-xl ${tileWidth == null ? "w-48" : ""} ${!desktopGridProminent && prominent ? "h-72" : ""} ${!desktopGridProminent && !prominent ? "h-56" : ""}`}
        style={
          desktopGridProminent && tileWidth != null && cardHeightPx != null
            ? { width: tileWidth, height: cardHeightPx }
            : widthStyle
        }
      >
        {hasImage ? (
          <Image
            source={{ uri: imageUrl! }}
            className="w-full"
            style={{ height: imageHeight }}
            resizeMode="cover"
          />
        ) : (
          <View className="w-full" style={{ height: imageHeight }}>
            {noImagePlaceholder(desktopGridProminent || prominent ? 44 : 36)}
          </View>
        )}
        <View
          className={
            desktopGridProminent
              ? "gap-1 px-3 pt-2 pb-2.5 justify-start"
              : prominent
                ? "gap-1.5 px-3 pb-3 pt-2 flex-1 min-h-0 justify-start"
                : "p-4 gap-2"
          }
          style={
            desktopGridProminent ? { minHeight: desktopFooterMin } : undefined
          }
        >
          <Text
            className="text-red-primary font-medium text-base shrink-0"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          <View
            className={
              desktopGridProminent || prominent ? "gap-1 shrink-0" : "gap-2"
            }
          >
            <Text
              className="text-muted-foreground text-sm"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {calories} calories
            </Text>
            <RecipeRating rating={rating} reviewsLength={reviewsLength} />
          </View>
        </View>
      </View>
    );
  } else {
    // Horizontal variant
    cardContent = (
      <View className="bg-background flex-row items-center overflow-hidden h-24 w-full gap-5 rounded-xl drop-shadow-xl">
        <View className="h-24 w-32 shrink-0 overflow-hidden rounded-xl rounded-r-none bg-muted-background">
          {hasImage ? (
            <Image
              source={{ uri: imageUrl! }}
              className="h-full w-full"
              resizeMode="contain"
            />
          ) : (
            noImagePlaceholder(28)
          )}
        </View>
        <View className="flex-1 justify-center">
          <View>
            <Text className="text-red-primary font-medium" numberOfLines={1}>
              {title}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {calories} calories
            </Text>
          </View>
          <RecipeRating rating={rating} reviewsLength={reviewsLength} />
        </View>
      </View>
    );
  }

  const longPressProps =
    onLongPress != null
      ? { onLongPress, delayLongPress: 400 as const }
      : {};

  return onPress ? (
    <Pressable onPress={onPress} {...longPressProps}>
      {cardContent}
    </Pressable>
  ) : (
    <Link
      href={{ pathname: "/recipe/[recipeId]", params: { recipeId: id } }}
      asChild
    >
      <Pressable {...longPressProps}>{cardContent}</Pressable>
    </Link>
  );
};


