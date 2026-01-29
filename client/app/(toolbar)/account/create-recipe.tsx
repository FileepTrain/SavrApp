import { useState } from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { Text, View, TouchableOpacity, Alert, Image, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Input from "@/components/ui/input";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Button from "@/components/ui/button";
import { validateRecipe } from "@/types/recipe";
import { Ingredient } from "@/types/ingredient";
import { AddIngredientModal } from "@/components/add-ingredient-modal";
import { IngredientsList } from "@/components/recipe/ingredients-list";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = "http://10.0.2.2:3000";

export default function CreateRecipePage() {
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState<string>("");
  const [recipeDescription, setRecipeDescription] = useState<string>("");
  const [recipePrepTime, setRecipePrepTime] = useState<string>("");
  const [recipeCookTime, setRecipeCookTime] = useState<string>("");
  const [recipeInstructions, setRecipeInstructions] = useState<string>("");
  const [recipeServings, setRecipeServings] = useState<string>("");
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
  const [isIngredientModalVisible, setIsIngredientModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddIngredient = (ingredient: Ingredient) => {
    setRecipeIngredients((prev) => [...prev, ingredient]);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateRecipe = async () => {
    const recipe = validateRecipe({
      name: recipeName,
      description: recipeDescription,
      imageUri: recipeImage,
      prepTime: Number(recipePrepTime),
      cookTime: Number(recipeCookTime),
      servings: Number(recipeServings),
      ingredients: recipeIngredients,
      instructions: recipeInstructions,
    });

    if (!recipe.success) {
      Alert.alert("Validation Error", recipe.errors.join("\n"));
      return;
    }

    try {
      setLoading(true);

      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        Alert.alert("Session expired", "Please log in again to create a recipe.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
        return;
      }

      const res = await fetch(`${SERVER_URL}/api/recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(recipe.data),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create recipe");
      }
      router.push("/account/personal-recipes");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Permission to access the media library is required.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    console.log(result);

    if (!result.canceled) {
      setRecipeImage(result.assets[0].uri);
    }
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {/* Recipe Photo */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Photo</Text>
            <TouchableOpacity className="bg-muted-background h-36 items-center justify-center rounded-xl gap-2" onPress={pickImage}>
              {recipeImage ? <Image source={{ uri: recipeImage }}
                className="w-full h-full"
                resizeMode="contain" /> : (
                <>
                  <IconSymbol name="camera-outline" size={32} color="--color-icon" />
                  <Text className="text-icon text-lg font-medium">Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {/* Recipe Name */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Name</Text>
            <Input
              inputClassName="bg-background border border-muted-background rounded-lg"
              placeholder="Enter recipe name"
              value={recipeName}
              onChangeText={setRecipeName}
            />
          </View>
          {/* Recipe Description */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Description</Text>
            <Input
              multiline
              maxLength={100}
              textAlignVertical="top"
              inputClassName="bg-background border border-muted-background rounded-lg h-16"
              placeholder="Enter a short description of the recipe (optional)"
              value={recipeDescription}
              onChangeText={setRecipeDescription}
            />
          </View>

          <View className="flex-row gap-4">
            {/* Recipe Prep Time */}
            <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
              <Text className="text-lg text-foreground font-bold">Prep Time (minutes)</Text>
              <Input
                inputClassName="bg-background border border-muted-background rounded-lg"
                placeholder="e.g., 30"
                inputType="numeric"
                value={recipePrepTime}
                onChangeText={(text) => setRecipePrepTime(text)}
              />
            </View>
            {/* Recipe Cook Time */}
            <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
              <Text className="text-lg text-foreground font-bold">Cook Time (minutes)</Text>
              <Input
                inputClassName="bg-background border border-muted-background rounded-lg"
                placeholder="e.g., 30"
                inputType="numeric"
                value={recipeCookTime}
                onChangeText={(text) => setRecipeCookTime(text)}
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
              onChangeText={(text) => setRecipeServings(text)}
            />
          </View>
          {/* Recipe Ingredients */}
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
              <IngredientsList list={recipeIngredients} onRemove={handleRemoveIngredient} />
            )}
          </View>

          {/* Add Ingredient Modal */}
          <AddIngredientModal
            visible={isIngredientModalVisible}
            onClose={() => setIsIngredientModalVisible(false)}
            onSubmit={handleAddIngredient}
            title="Add Ingredient"
            nameLabel="Ingredient Name"
            namePlaceholder="e.g., Chicken Breast"
          />
          {/* Recipe Instructions */}
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
          <Button variant="default" className="h-16 rounded-xl" textClassName="text-lg font-medium text-primary" onPress={handleCreateRecipe} disabled={loading}>
            Create Recipe
          </Button>
        </View>
      </ScrollView >
    </ThemedSafeView >
  );
}
