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
onPress: () => void; //if a custom onPress is provided will use that | else default sends to recipe details
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
  onPress,
}: RecipeCardProps) => {
  const imgSource = imageUrl
    ? { uri: imageUrl }
    : require("@/assets/images/SAVR-logo.png");

  let cardContent;

  // Recipe card default layout
  if (variant === "default") {
    cardContent = (
      <View className="bg-white rounded-2xl overflow-hidden flex-col w-48 h-56 drop-shadow-xl">
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
  } else if (variant === "horizontal") {
    // Horizontal variant
    cardContent = (
      <View className="bg-white flex-row items-center overflow-hidden h-24 w-full gap-5 rounded-xl drop-shadow-xl">
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
  } //other variants go here

  if (onPress) {
    return <Pressable onPress={onPress}>{cardContent}</Pressable>;
  }

  return (
    <Link href={{ pathname: "/recipe/[recipeId]", params: { recipeId: id } }}>
      {cardContent}
    </Link>
  );
};


