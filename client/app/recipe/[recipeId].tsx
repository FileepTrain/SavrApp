import { View, Text, ScrollView } from "react-native";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useLocalSearchParams } from "expo-router";

const ViewRecipePage = () => {
  const { recipeId } = useLocalSearchParams();

  return (
    <ThemedSafeView>
      <ScrollView>
        <Text>ViewRecipePage for recipeId {Number(recipeId) + 1}</Text>
      </ScrollView>
    </ThemedSafeView>
  );
};

export default ViewRecipePage;
