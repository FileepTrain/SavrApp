import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import React from "react";
import { router } from "expo-router";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useLocalSearchParams, useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function RecipeDetailsPage() {
  const router = useRouter();
  const { recipeId } = useLocalSearchParams();
  const recipeNumber = Number(recipeId) + 1;

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8]">
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ---------------------------------------------------------------------- */}
        {/* IMAGE + FAVORITE BUTTON */}
        {/* ---------------------------------------------------------------------- */}
        <View className="relative">
          <View className="w-full h-60 bg-gray-300 rounded-b-xl justify-center items-center">
            <Text>Recipe Image Placeholder</Text>
          </View>

          <TouchableOpacity
            onPress={() => console.log("Favorite clicked")}
            className="absolute right-4 top-4 w-10 h-10 bg-white rounded-full shadow items-center justify-center"
          >
            <IconSymbol name="favorite-border" size={24} color="#EB2D2D" />
          </TouchableOpacity>
        </View>

        {/* ---------------------------------------------------------------------- */}
        {/* TITLE + SUBTEXT */}
        {/* ---------------------------------------------------------------------- */}
        <View className="px-6 mt-6">
          <Text className="text-2xl font-bold text-center text-[#EB2D2D]">
            Recipe #{recipeNumber}
          </Text>

          <Text className="text-center text-black mt-1">
            Rating • Calories • Price Placeholder
          </Text>
        </View>

        {/* ---------------------------------------------------------------------- */}
        {/* BUTTON ROW: Nutrition | Reviews | Share */}
        {/* ---------------------------------------------------------------------- */}
        <View className="flex-row justify-between px-6 mt-6">

          {/* Nutrition */}
          <TouchableOpacity
            className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
            onPress={() => router.push(`/recipe/nutrition`)}
          >
            <IconSymbol name="restaurant" size={18} />
            <Text className="font-medium">Nutrition</Text>
          </TouchableOpacity>

          {/* Reviews */}
          <TouchableOpacity
            className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
            onPress={() => router.push(`/recipe/reviews`)}
          >
            <IconSymbol name="chat-bubble-outline" size={18} />
            <Text className="font-medium">Reviews</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            className="flex-1 mx-1 bg-white rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
            onPress={() => router.push(`/recipe/share`)}
          >
            <IconSymbol name="share" size={18} />
            <Text className="font-medium">Share</Text>
          </TouchableOpacity>


        </View>

        {/* ---------------------------------------------------------------------- */}
        {/* CONTENT SECTIONS */}
        {/* ---------------------------------------------------------------------- */}
        <View className="px-6 mt-8">

          {/* Ingredients */}
          <View className="bg-white rounded-xl p-4 shadow mb-4">
            <Text className="text-lg font-semibold">Ingredients Placeholder</Text>
            <Text className="text-gray-600 mt-2">
              This area will display the ingredients list.
            </Text>
          </View>

          {/* Instructions */}
          <View className="bg-white rounded-xl p-4 shadow mb-4">
            <Text className="text-lg font-semibold">Instructions Placeholder</Text>
            <Text className="text-gray-600 mt-2">
              This area will display the steps.
            </Text>
          </View>

          {/* Similar Recipes */}
          <View className="bg-white rounded-xl p-4 shadow mb-20">
            <Text className="text-lg font-semibold">Similar Recipes Placeholder</Text>
            <Text className="text-gray-600 mt-2">
              This area will display similar recipe items.
            </Text>
          </View>

        </View>

      </ScrollView>
    </ThemedSafeView>
  );
}
