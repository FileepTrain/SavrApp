"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = "http://10.0.2.2:3000";

/** Recipe as a complete document object returned from GET /api/recipes */
export interface PersonalRecipeItem {
  id: string;
  title: string;
  summary?: string;
  image?: string | null;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  calories?: number;
  rating?: number;
  reviews?: unknown[];
  ingredients?: unknown[];
  instructions?: string;
  [key: string]: unknown;
}

/** Payload for create/update (aligns with recipe schema shape) */
export interface RecipePayload {
  title: string;
  summary?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: { name: string; quantity: number; unit: string }[];
  instructions: string;
}

export interface UpdateRecipeImageOptions {
  /** New image from picker (file:// or content:// URI) */
  imageUri?: string | null;
  /** True if user removed the existing image */
  removeImage?: boolean;
}

interface PersonalRecipesState {
  recipes: PersonalRecipeItem[];
  loading: boolean; // True when in the process of fetching recipes
  error: string | null;
}

interface PersonalRecipesContextValue extends PersonalRecipesState {
  refetch: () => Promise<void>;
  createRecipe: (data: RecipePayload, imageUri?: string | null) => Promise<void>;
  updateRecipe: (
    recipeId: string,
    data: RecipePayload,
    imageOptions?: UpdateRecipeImageOptions
  ) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  setRecipes: React.Dispatch<React.SetStateAction<PersonalRecipeItem[]>>;
}

const PersonalRecipesContext = createContext<PersonalRecipesContextValue | null>(null);

/** Fetch the personal recipes from the server and stores them in the client */
async function fetchPersonalRecipes(): Promise<PersonalRecipeItem[]> {
  const idToken = await AsyncStorage.getItem("idToken");
  if (!idToken) return [];
  const res = await fetch(`${SERVER_URL}/api/recipes`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch recipes");
  return data.recipes ?? [];
}

/** HELPER: Append the image to the form data with the proper MIME type */
const _appendImageToFormData = (formData: FormData, imageUri: string): void => {
  const filename = imageUri.split("/").pop() || "recipe-image.jpg";
  const match = filename.toLowerCase().match(/\.(jpe?g|png|gif|webp)$/);
  const mimeType = match
    ? (match[1] === "jpg" || match[1] === "jpeg" ? "image/jpeg" : `image/${match[1]}`)
    : "image/jpeg";
  formData.append("image", {
    uri: imageUri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);
}

export function PersonalRecipesProvider({ children }: { children: React.ReactNode }) {
  const [recipes, setRecipes] = useState<PersonalRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Refetch the personal recipes from the database by calling fetchPersonalRecipes
   ** Ensures that the client is synced with the database by updating the recipes state
   */
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchPersonalRecipes();
      setRecipes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch recipes");
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Create a new personal recipe in the database */
  const createRecipe = useCallback(
    async (data: RecipePayload, imageUri?: string | null) => {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Session expired");
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("summary", data.summary ?? "");
      formData.append("prepTime", String(data.prepTime));
      formData.append("cookTime", String(data.cookTime));
      formData.append("servings", String(data.servings));
      formData.append("instructions", data.instructions);
      formData.append("ingredients", JSON.stringify(data.ingredients));
      if (imageUri) _appendImageToFormData(formData, imageUri);
      const res = await fetch(`${SERVER_URL}/api/recipes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(json.error) ? json.error.join("\n") : json.error || "Failed to create recipe"
        );
      }
      await refetch();
    },
    [refetch]
  );

  /** Update a personal recipe in the database */
  const updateRecipe = useCallback(
    async (
      recipeId: string,
      data: RecipePayload,
      imageOptions?: UpdateRecipeImageOptions
    ) => {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Session expired");
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("summary", data.summary ?? "");
      formData.append("prepTime", String(data.prepTime));
      formData.append("cookTime", String(data.cookTime));
      formData.append("servings", String(data.servings));
      formData.append("instructions", data.instructions);
      formData.append("ingredients", JSON.stringify(data.ingredients));
      if (imageOptions?.removeImage) formData.append("removeImage", "true");
      else if (imageOptions?.imageUri) _appendImageToFormData(formData, imageOptions.imageUri);
      const res = await fetch(`${SERVER_URL}/api/recipes/${recipeId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(json.error) ? json.error.join("\n") : json.error || "Failed to update recipe"
        );
      }
      await refetch();
    },
    [refetch]
  );

  /** Delete a personal recipe from the database */
  const deleteRecipe = useCallback(
    async (id: string) => {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) throw new Error("Session expired");
      const res = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error("Failed to delete recipe");
      await refetch();
    },
    [refetch]
  );

  useEffect(() => {
    refetch();
  }, [refetch]);

  const value: PersonalRecipesContextValue = {
    recipes,
    loading,
    error,
    refetch,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    setRecipes,
  };

  return (
    <PersonalRecipesContext.Provider value={value}>
      {children}
    </PersonalRecipesContext.Provider>
  );
}

/** Hook to use the personal recipes context
 * @returns The personal recipes context value and CRUD operations
*/
export function usePersonalRecipes(): PersonalRecipesContextValue {
  const ctx = useContext(PersonalRecipesContext);
  if (!ctx) {
    throw new Error("usePersonalRecipes must be used within PersonalRecipesProvider");
  }
  return ctx;
}
