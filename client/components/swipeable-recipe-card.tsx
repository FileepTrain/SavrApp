import React, { useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RecipeCard } from "./recipe-card";
import { usePersonalRecipes } from "@/contexts/personal-recipes-context";

interface SwipeableRecipeCardProps {
  id: string;
  title: string;
  calories?: number;
  rating?: number;
  reviewsLength?: number;
  image?: string | null;
}

export function SwipeableRecipeCard({
  id,
  title,
  calories = 0,
  rating = 0,
  reviewsLength = 0,
  image,
}: SwipeableRecipeCardProps) {
  const { deleteRecipe } = usePersonalRecipes();
  const [loading, setLoading] = useState(false);

  const handleDeleteRecipe = async () => {
    try {
      setLoading(true);
      await deleteRecipe(id);
    } catch (error) {
      console.error("Error deleting recipe:", error);
      Alert.alert("Error", "Failed to delete recipe");
    } finally {
      setLoading(false);
    }
  };

  const renderRightActions = (
    _progress: unknown,
    _translation: unknown,
    swipeableMethods: { close: () => void }
  ) => (
    <View className="ml-2 flex flex-row">
      <Pressable
        onPress={() => {
          swipeableMethods.close();
          router.push({ pathname: "/account/edit-recipe/[recipeId]", params: { recipeId: id } });
        }}
        className="bg-orange-500 justify-center items-center w-20 rounded-xl rounded-r-none gap-1"
      >
        <IconSymbol name="pencil-outline" size={28} color="--color-background" />
        <Text className="text-background text-sm font-medium">Edit</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          handleDeleteRecipe();
          swipeableMethods.close();
        }}
        className="bg-red-primary justify-center items-center w-20 rounded-xl rounded-l-none gap-1"
      >
        <IconSymbol name="trash-can-outline" size={28} color="--color-background" />
        {loading ? <ActivityIndicator size="small" color="white" /> : <Text className="text-background text-sm font-medium">Delete</Text>}
      </Pressable>
    </View>
  );

  return (
    <ReanimatedSwipeable
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <RecipeCard id={id} title={title} calories={calories} rating={rating} reviewsLength={reviewsLength} variant="horizontal" imageUrl={image} />
    </ReanimatedSwipeable>
  );
}
