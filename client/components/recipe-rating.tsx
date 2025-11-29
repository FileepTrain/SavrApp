import { View, Text } from "react-native";
import React from "react";
import { IconSymbol, type MaterialIconName } from "@/components/ui/icon-symbol";

interface RecipeRatingProps {
  rating: number;
  reviewsLength: number;
}

const RecipeRating = ({ rating, reviewsLength }: RecipeRatingProps) => {
  return (
    <View className="flex-row items-center gap-2">
      <IconSymbol name="star" size={12} color="#fbcd4f" />
      <Text className="text-muted-foreground text-sm font-medium">
        {rating} ({reviewsLength})
      </Text>
    </View>
  );
};

export default RecipeRating;
