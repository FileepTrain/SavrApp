import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Input from "@/components/ui/input";

import { AddIngredientModal, ExtendedIngredient } from "@/components/add-ingredient-modal";
import { IngredientsList } from "@/components/recipe/ingredients-list";

import { usePersonalRecipes } from "@/contexts/personal-recipes-context";
import { validateRecipe } from "@/types/recipe";

export default function CreateRecipePage() {
  const { createRecipe } = usePersonalRecipes();

  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeTitle, setRecipeTitle] = useState<string>("");
  const [recipeSummary, setRecipeSummary] = useState<string>("");
  const [recipePrepTime, setRecipePrepTime] = useState<string>("");
  const [recipeCookTime, setRecipeCookTime] = useState<string>("");
  const [recipeInstructions, setRecipeInstructions] = useState<string>("");
  const [recipeServings, setRecipeServings] = useState<string>("");

  const [recipeIngredients, setRecipeIngredients] = useState<ExtendedIngredient[]>([]);
  const [isIngredientModalVisible, setIsIngredientModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddIngredient = (ingredient: ExtendedIngredient) => {
    setRecipeIngredients((prev) => [...prev, ingredient]);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission required", "Permission to access the media library is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setRecipeImage(result.assets[0].uri);
    }
  };

  const handleCreateRecipe = async () => {
    // ✅ Keep your existing validation (it expects `ingredients` with quantity/unit)
    const payloadForValidation = {
      title: recipeTitle,
      summary: recipeSummary,
      image: recipeImage,
      prepTime: Number(recipePrepTime || 0),
      cookTime: Number(recipeCookTime || 0),
      servings: Number(recipeServings || 1),
      ingredients: recipeIngredients.map((ing) => ({
        name: ing.name,
        quantity: Number(ing.amount),
        unit: ing.unit,
      })),
      instructions: recipeInstructions,
    };

    const validated = validateRecipe(payloadForValidation);
    if (!validated.success) {
      Alert.alert("Validation Error", validated.errors.join("\n"));
      return;
    }

    // 🚨 IMPORTANT: Backend expects `extendedIngredients`, not `ingredients`
    const backendPayload = {
      title: validated.data.title,
      summary: validated.data.summary ?? "",
      prepTime: validated.data.prepTime ?? 0,
      cookTime: validated.data.cookTime ?? 0,
      servings: validated.data.servings ?? 1,
      instructions: validated.data.instructions,

      // ✅ The correct field name + correct object shape
      extendedIngredients: recipeIngredients.map((ing) => ({
        id: ing.id ?? null,
        name: ing.name,
        original: ing.original ?? ing.name,
        amount: Number(ing.amount),
        unit: String(ing.unit).toLowerCase(),
        image: ing.image ?? null,
      })),
    };

    try {
      setLoading(true);

      // ✅ Send correct shape to context
      await createRecipe(backendPayload as any, recipeImage ?? undefined);

      router.push("/account/personal-recipes");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create recipe";

      if (message.toLowerCase().includes("session")) {
        Alert.alert("Session expired", "Please log in again.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-4 p-4">
          {/* Photo */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Photo</Text>
            <TouchableOpacity
              className="bg-muted-background h-36 items-center justify-center rounded-xl gap-2"
              onPress={pickImage}
            >
              {recipeImage ? (
                <Image source={{ uri: recipeImage }} className="w-full h-full" resizeMode="contain" />
              ) : (
                <>
                  <IconSymbol name="camera-outline" size={32} color="--color-icon" />
                  <Text className="text-icon text-lg font-medium">Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Name</Text>
            <Input
              inputClassName="bg-background border border-muted-background rounded-lg"
              placeholder="Enter recipe name"
              value={recipeTitle}
              onChangeText={setRecipeTitle}
            />
          </View>

          {/* Summary */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Description</Text>
            <Input
              multiline
              maxLength={100}
              textAlignVertical="top"
              inputClassName="bg-background border border-muted-background rounded-lg h-16"
              placeholder="Enter a short description (optional)"
              value={recipeSummary}
              onChangeText={setRecipeSummary}
            />
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1 bg-background p-4 gap-2 rounded-xl shadow-lg">
              <Text className="text-lg text-foreground font-bold">Prep Time (minutes)</Text>
              <Input
                inputClassName="bg-background border border-muted-background rounded-lg"
                placeholder="e.g., 30"
                inputType="numeric"
                value={recipePrepTime}
                onChangeText={setRecipePrepTime}
              />
            </View>

            <View className="flex-1 bg-background p-4 gap-2 rounded-xl shadow-lg">
              <Text className="text-lg text-foreground font-bold">Cook Time (minutes)</Text>
              <Input
                inputClassName="bg-background border border-muted-background rounded-lg"
                placeholder="e.g., 30"
                inputType="numeric"
                value={recipeCookTime}
                onChangeText={setRecipeCookTime}
              />
            </View>
          </View>

          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Total Servings</Text>
            <Input
              inputClassName="bg-background border border-muted-background rounded-lg"
              placeholder="e.g., 4"
              inputType="numeric"
              value={recipeServings}
              onChangeText={setRecipeServings}
            />
          </View>

          {/* Ingredients */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Ingredients</Text>

            <Button
              variant="primary"
              icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
              className="bg-muted-background rounded-xl"
              textClassName="text-lg font-medium text-icon"
              onPress={() => setIsIngredientModalVisible(true)}
            >
              Add Ingredient
            </Button>

            {recipeIngredients.length > 0 && (
              <IngredientsList
                list={recipeIngredients.map((ing) => ({
                  name: ing.name,
                  quantity: Number(ing.amount),
                  unit: ing.unit,
                }))}
                onRemove={handleRemoveIngredient}
              />
            )}
          </View>

          <AddIngredientModal
            visible={isIngredientModalVisible}
            onClose={() => setIsIngredientModalVisible(false)}
            onSubmit={handleAddIngredient}
            title="Add Ingredient"
            nameLabel="Ingredient Name"
            namePlaceholder="Type and select an ingredient…"
          />

          {/* Instructions */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Instructions</Text>
            <Input
              multiline
              textAlignVertical="top"
              inputClassName="bg-background border border-muted-background rounded-lg h-32"
              placeholder="Enter cooking instructions"
              value={recipeInstructions}
              onChangeText={setRecipeInstructions}
            />
          </View>

          <Button
            variant="default"
            className="h-16 rounded-xl"
            textClassName="text-lg font-medium text-primary"
            onPress={handleCreateRecipe}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" color="black" /> : "Create Recipe"}
          </Button>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
}
