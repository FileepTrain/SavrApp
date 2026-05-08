import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Input from "@/components/ui/input";

import { AddCookwareModal } from "@/components/add-cookware-modal";
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
  const [recipeCookware, setRecipeCookware] = useState<string[]>([]);
  const [cookwareDraft, setCookwareDraft] = useState<string[]>([]);
  const [isIngredientModalVisible, setIsIngredientModalVisible] = useState(false);
  const [isCookwareModalVisible, setIsCookwareModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddIngredient = (ingredient: ExtendedIngredient) => {
    setRecipeIngredients((prev) => [...prev, ingredient]);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCookware = (selected: string[]) => {
    setRecipeCookware((prev) => [...prev, ...selected]);
    setCookwareDraft([]);
  };

  const handleRemoveCookware = (item: string) => {
    setRecipeCookware((prev) => prev.filter((c) => c !== item));
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
    const payloadForValidation = {
      title: recipeTitle,
      summary: recipeSummary,
      image: recipeImage,
      prepTime: Number(recipePrepTime),
      cookTime: Number(recipeCookTime),
      servings: Number(recipeServings),
      extendedIngredients: recipeIngredients.map((ing) => ({
        name: ing.name,
        amount: Number(ing.amount),
        unit: ing.unit,
      })),
      instructions: recipeInstructions,
      equipment: recipeCookware,
    };

    const validated = validateRecipe(payloadForValidation);
    if (!validated.success) {
      Alert.alert("Validation Error", validated.errors.join("\n"));
      return;
    }

    try {
      setLoading(true);

      await createRecipe(validated.data, recipeImage ?? undefined);

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
      <AccountWebColumn className="flex-1">
        <AccountSubpageBody>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-6">
          {/* Photo */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Recipe Photo</Text>
            <TouchableOpacity
              className="bg-muted-background border border-muted-background h-36 items-center justify-center rounded-xl gap-2"
              onPress={pickImage}
            >
              {recipeImage ? (
                <Image source={{ uri: recipeImage }} className="w-full h-full" resizeMode="contain" />
              ) : (
                <>
                  <IconSymbol name="camera-outline" size={32} color="--color-muted-foreground" />
                  <Text className="text-muted-foreground text-[14px] font-medium tracking-[0.5px]">Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Recipe Name</Text>
            <Input
              inputClassName="bg-background border border-muted-background rounded-lg"
              placeholder="Enter recipe name"
              value={recipeTitle}
              onChangeText={setRecipeTitle}
            />
          </View>

          {/* Summary */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Recipe Description</Text>
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
            <View className="flex-1 bg-background p-4 gap-2 rounded-xl shadow-sm">
              <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Prep Time (minutes)</Text>
              <Input
                inputClassName="bg-background border border-muted-background rounded-lg"
                placeholder="e.g., 30"
                inputType="numeric"
                value={recipePrepTime}
                onChangeText={setRecipePrepTime}
              />
            </View>

            <View className="flex-1 bg-background p-4 gap-2 rounded-xl shadow-sm">
              <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Cook Time (minutes)</Text>
              <Input
                inputClassName="bg-background border border-muted-background rounded-lg"
                placeholder="e.g., 30"
                inputType="numeric"
                value={recipeCookTime}
                onChangeText={setRecipeCookTime}
              />
            </View>
          </View>

          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Total Servings</Text>
            <Input
              inputClassName="bg-background border border-muted-background rounded-lg"
              placeholder="e.g., 4"
              inputType="numeric"
              value={recipeServings}
              onChangeText={setRecipeServings}
            />
          </View>

          {/* Ingredients */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Ingredients</Text>

            {recipeIngredients.length > 0 && (
              <IngredientsList
                list={recipeIngredients.map((ing) => ({
                  name: ing.name,
                  amount: Number(ing.amount),
                  unit: ing.unit,
                }))}
                onRemove={handleRemoveIngredient}
              />
            )}

            <Button
              variant="primary"
              icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
              className="bg-muted-background rounded-xl"
              textClassName="text-[16px] font-medium tracking-[0.5px] text-icon"
              onPress={() => setIsIngredientModalVisible(true)}
            >
              Add Ingredient
            </Button>
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
          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Instructions</Text>
            <Input
              multiline
              textAlignVertical="top"
              inputClassName="bg-background border border-muted-background rounded-lg h-32"
              placeholder="Enter cooking instructions"
              value={recipeInstructions}
              onChangeText={setRecipeInstructions}
            />
          </View>

          {/* Cookware */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-sm">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">Cookware</Text>

            {recipeCookware.length > 0 && (
              <View className="flex-row flex-wrap gap-2">
                {recipeCookware.map((item) => (
                  <View
                    key={item}
                    className="flex-row items-center bg-muted-background rounded-lg pl-3 pr-1 py-2 gap-1"
                  >
                    <Text className="text-foreground font-medium">{item}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveCookware(item)}
                      className="p-1"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <IconSymbol name="close" size={18} color="#666" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Button
              variant="primary"
              icon={{ name: "plus-circle-outline", position: "left", size: 20, color: "--color-icon" }}
              className="bg-muted-background rounded-xl"
              textClassName="text-[16px] font-medium tracking-[0.5px] text-icon"
              onPress={() => setIsCookwareModalVisible(true)}
            >
              Add Cookware
            </Button>
          </View>

          <AddCookwareModal
            visible={isCookwareModalVisible}
            onClose={(draftSelection) => {
              setIsCookwareModalVisible(false);
              if (draftSelection) setCookwareDraft(draftSelection);
            }}
            onSubmit={handleAddCookware}
            recipeCookware={recipeCookware}
            draftSelection={cookwareDraft}
            summaryAndInstructions={`${recipeSummary}\n${recipeInstructions}`}
          />

          <Button
            variant="default"
            className="h-16 rounded-xl"
            textClassName="text-[16px] font-medium tracking-[0.5px] text-primary"
            onPress={handleCreateRecipe}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" color="black" /> : "Create Recipe"}
          </Button>
        </View>
      </ScrollView>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}
