import { useState, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator } from "react-native";

const SERVER_URL = "http://10.0.2.2:3000";

export default function EditRecipePage() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [recipeTitle, setRecipeTitle] = useState<string>("");
  const [recipeSummary, setRecipeSummary] = useState<string>("");
  const [recipePrepTime, setRecipePrepTime] = useState<string>("");
  const [recipeCookTime, setRecipeCookTime] = useState<string>("");
  const [recipeInstructions, setRecipeInstructions] = useState<string>("");
  const [recipeServings, setRecipeServings] = useState<string>("");
  const [recipeIngredients, setRecipeIngredients] = useState<Ingredient[]>([]);
  const [recipeDiets, setRecipeDiets] = useState<string[]>([]);
  const [recipeDishTypes, setRecipeDishTypes] = useState<string[]>([]);
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

        if (Array.isArray(recipe.ingredients)) {
          setRecipeIngredients(
            recipe.ingredients.map((ing: { name: string; quantity: number; unit: string }) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            }))
          );
        } else {
          setRecipeIngredients([]);
        }
        setRecipeDiets(Array.isArray(recipe.diets) ? recipe.diets : []);
        setRecipeDishTypes(
          Array.isArray(recipe.dishTypes) ? recipe.dishTypes : []
        );
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
        Alert.alert("Session expired", "Please log in again to save changes.", [
          { text: "OK", onPress: () => router.replace("/login") },
        ]);
        return;
      }

      const formData = new FormData();
      formData.append("title", recipe.data.title);
      formData.append("summary", recipe.data.summary ?? "");
      formData.append("prepTime", String(recipe.data.prepTime));
      formData.append("cookTime", String(recipe.data.cookTime));
      formData.append("servings", String(recipe.data.servings));
      formData.append("instructions", recipe.data.instructions);
      formData.append("ingredients", JSON.stringify(recipe.data.ingredients));

      if (initialImageUrl && !recipeImage) {
        formData.append("removeImage", "true");
      } else if (recipeImage && (recipeImage.startsWith("file://") || recipeImage.startsWith("content://"))) {
        const filename = recipeImage.split("/").pop() || "recipe-image.jpg";
        const match = filename.toLowerCase().match(/\.(jpe?g|png|gif|webp)$/);
        const mimeType = match
          ? (match[1] === "jpg" || match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`)
          : "image/jpeg";
        formData.append("image", {
          uri: recipeImage,
          name: filename,
          type: mimeType,
        } as unknown as Blob);
      }

      const res = await fetch(`${SERVER_URL}/api/recipes/${recipeId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(Array.isArray(data.error) ? data.error.join("\n") : data.error || "Failed to update recipe");
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
            Save Recipe
          </Button>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
}
