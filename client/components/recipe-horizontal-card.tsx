import { View, Text, Image } from "react-native";
import { Link } from "expo-router";
import React from "react";
import RecipeRating from "./recipe-rating";

type CardVariant = "horizontal" | "default";

interface RecipeHorizontalCardProps {
  id: string;
  title: string;
  calories?: number;
  rating?: number;
  reviewsLength?: number;
  variant?: CardVariant;
}

const RecipeHorizontalCard = ({
  // Replace props with recipe object in the future
  id,
  title,
  calories = 0,
  rating = 0,
  reviewsLength = 0,
  variant = "default",
}: RecipeHorizontalCardProps) => {
  if (variant === "default") {
    return (
      <Link href={{ pathname: "/recipe/[recipeId]", params: { recipeId: id } }}>
        <View className="bg-white rounded-2xl overflow-hidden flex-col w-48 h-56 drop-shadow-xl">
          <Image
            source={require("@/assets/images/SAVR-logo.png")}
            className="w-full h-28"
            resizeMode="contain"
          />
          <View className="p-4 gap-2">
            <Text
              className="text-red-primary font-medium text-base"
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text className="text-muted-foreground text-sm">
              {calories} calories
            </Text>
            <RecipeRating rating={rating} reviewsLength={reviewsLength} />
          </View>
        </View>
      </Link>
    );
  }

  // Horizontal variant
  return (
    <View className="bg-white flex-row items-center overflow-hidden h-24 w-full gap-5 rounded-xl drop-shadow-xl">
      <Image
        source={require("@/assets/images/SAVR-logo.png")}
        className="h-full w-32 rounded-xl"
        resizeMode="contain"
      />
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
};

export default RecipeHorizontalCard;
