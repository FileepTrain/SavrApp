import { View, Text, Image, Pressable } from "react-native";
import { Link } from "expo-router";
import React from "react";
import RecipeRating from "./recipe/recipe-rating";


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
  onPress,
  onLongPress,
}: RecipeCardProps) => {
  const imgSource = imageUrl
    ? { uri: imageUrl }
    : require("@/assets/images/SAVR-logo.png");

  let cardContent;

  // Recipe card default layout
  if (variant === "default") {
    const widthStyle = tileWidth != null ? { width: tileWidth } : undefined;
    cardContent = (
      <View
        className={`bg-background rounded-2xl overflow-hidden flex-col h-56 drop-shadow-xl ${tileWidth == null ? "w-48" : ""}`}
        style={widthStyle}
      >
        <Image source={imgSource} className="w-full h-28" resizeMode="cover" />
        <View className="p-4 gap-2">
          <Text className="text-red-primary font-medium text-base" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {calories} calories
          </Text>
          <RecipeRating rating={rating} reviewsLength={reviewsLength} />
        </View>
      </View>
    );
  } else {
    // Horizontal variant
    cardContent = (
      <View className="bg-background flex-row items-center overflow-hidden h-24 w-full gap-5 rounded-xl drop-shadow-xl">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            className="h-full w-32 rounded-xl rounded-r-none"
            resizeMode="cover"
          />
        ) : (
          <Image
            source={require("@/assets/images/SAVR-logo.png")}
            className="h-full w-32 rounded-xl rounded-r-none"
            resizeMode="contain"
          />
        )}
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


