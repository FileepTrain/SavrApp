import { useState, useEffect } from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { Text, View, TouchableOpacity, Alert, Image, ScrollView, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Input from "@/components/ui/input";
import { IconSymbol } from "@/components/ui/icon-symbol";
import Button from "@/components/ui/button";
import { validateRecipe } from "@/types/recipe";
import { Ingredient } from "@/types/ingredient";
import { AddIngredientModal } from "@/components/add-ingredient-modal";
import { IngredientsList } from "@/components/recipe/ingredients-list";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type ExtendedIngredient,
  usePersonalRecipes,
} from "@/contexts/personal-recipes-context";

const SERVER_URL = "http://10.0.2.2:3000";

export default function EditRecipePage() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { updateRecipe } = usePersonalRecipes();
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeTitle, setRecipeTitle] = useState<string>("");
  const [recipeSummary, setRecipeSummary] = useState<string>("");
  const [recipePrepTime, setRecipePrepTime] = useState<string>("");
  const [recipeCookTime, setRecipeCookTime] = useState<string>("");
  const [recipeInstructions, setRecipeInstructions] = useState<string>("");
  const [recipeServings, setRecipeServings] = useState<string>("");
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
  const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null); // from server, to determine if we should replace vs keep same URL
  const [isIngredientModalVisible, setIsIngredientModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!recipeId) return;

      try {
        setFetching(true);
        const idToken = await AsyncStorage.getItem("idToken");
        const response = await fetch(`${SERVER_URL}/api/recipes/${recipeId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          method: "GET",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch recipe");
        }

        const recipe = data.recipe;
        setRecipeTitle(recipe.title ?? "");
        setRecipeSummary(recipe.summary ?? "");
        setRecipeImage(recipe.image ?? null);
        setInitialImageUrl(recipe.image ?? null);
        setRecipePrepTime(String(recipe.prepTime ?? ""));
        setRecipeCookTime(String(recipe.cookTime ?? ""));
        setRecipeServings(String(recipe.servings ?? ""));
        setRecipeInstructions(recipe.instructions || "");

        if (Array.isArray(recipe.extendedIngredients)) {
          setRecipeIngredients(
            recipe.extendedIngredients.map((ing: ExtendedIngredient) => ({
              name: ing.name,
              amount: ing.amount,
              unit: ing.unit,
            }))
          );
        } else {
          setRecipeIngredients([]);
        }
      } catch (err: any) {
        Alert.alert("Error", err.message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } finally {
        setFetching(false);
      }
    };

    fetchRecipe();
  }, [recipeId]);

  const handleAddIngredient = (ingredient: Ingredient) => {
    setRecipeIngredients((prev) => [...prev, ingredient]);
  };

  const handleRemoveIngredient = (index: number) => {
    setRecipeIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = async () => {
    const recipe = validateRecipe({
      title: recipeTitle,
      summary: recipeSummary,
      image: recipeImage,
      prepTime: Number(recipePrepTime),
      cookTime: Number(recipeCookTime),
      servings: Number(recipeServings),
      extendedIngredients: recipeIngredients,
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
        Alert.alert("Session expired", "Please log in again to save changes.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
        return;
      }
      // Determine if we should remove the image or replace it with a new one
      const imageOptions =
        initialImageUrl && !recipeImage
          ? { removeImage: true as const }
          : recipeImage && (recipeImage.startsWith("file://") || recipeImage.startsWith("content://"))
            ? { imageUri: recipeImage }
            : undefined;
      await updateRecipe(recipeId!, recipe.data, imageOptions);
      router.back();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update recipe";
      if (message === "Session expired") {
        Alert.alert("Session expired", "Please log in again to save changes.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
      } else {
        Alert.alert("Error", message);
      }
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Permission to access the media library is required."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setRecipeImage(result.assets[0].uri);
    }
  };

  if (fetching) {
    return (
      <ThemedSafeView className="flex-1 items-center justify-center pt-safe-or-20">
        <ActivityIndicator size="large" color="red" />
      </ThemedSafeView>
    );
  }

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {/* Recipe Photo */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Photo</Text>
            <TouchableOpacity
              className="bg-muted-background h-36 items-center justify-center rounded-xl gap-2"
              onPress={pickImage}
            >
              {recipeImage ? (
                <Image
                  source={{ uri: recipeImage }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              ) : (
                <>
                  <IconSymbol
                    name="camera-outline"
                    size={32}
                    color="--color-icon"
                  />
                  <Text className="text-icon text-lg font-medium">Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
            {recipeImage ? (
              <Button
                variant="default"
                className="rounded-lg"
                textClassName="text-destructive"
                onPress={() => setRecipeImage(null)}
              >
                Remove photo
              </Button>
            ) : null}
          </View>

          {/* Recipe Title */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">Recipe Name</Text>
            <Input
              inputClassName="bg-background border border-muted-background rounded-lg"
              placeholder="Enter recipe name"
              value={recipeTitle}
              onChangeText={setRecipeTitle}
            />
          </View>

          {/* Recipe Description */}
          <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
            <Text className="text-lg text-foreground font-bold">
              Recipe Description
            </Text>
            <Input
              multiline
              maxLength={100}
              textAlignVertical="top"
              inputClassName="bg-background border border-muted-background rounded-lg h-16"
              placeholder="Enter a short description of the recipe (optional)"
              value={recipeSummary}
              onChangeText={setRecipeSummary}
            />
          </View>

          <View className="flex-row gap-4">
            {/* Recipe Prep Time */}
            <View className="bg-background p-4 gap-2 rounded-xl shadow-lg">
              <Text className="text-lg text-foreground font-bold">
                Prep Time (minutes)
              </Text>
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
              <Text className="text-lg text-foreground font-bold">
                Cook Time (minutes)
              </Text>
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
            <Text className="text-lg text-foreground font-bold">
              Total Servings
            </Text>
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
              icon={{
                name: "plus-circle-outline",
                position: "left",
                size: 20,
                color: "--color-icon",
              }}
              className="bg-muted-background rounded-xl"
              textClassName="text-lg font-medium text-icon"
              onPress={() => setIsIngredientModalVisible(true)}
            >
              Add Ingredient
            </Button>
            {recipeIngredients.length > 0 && (
              <IngredientsList
                list={recipeIngredients}
                onRemove={handleRemoveIngredient}
              />
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
            <Text className="text-lg text-foreground font-bold">
              Instructions
            </Text>
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
            onPress={handleSaveRecipe}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" color="black" /> : "Save Recipe"}
          </Button>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
}
