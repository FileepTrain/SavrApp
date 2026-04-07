import { IngredientsList } from "@/components/recipe/ingredients-list";
import { RecipeHeroGallery } from "@/components/recipe/recipe-hero-gallery";
import RecipeRating from "@/components/recipe/recipe-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Ingredient } from "@/types/ingredient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildRecipeShareWebUrl, openNativeShare } from "@/utils/profile-share";

// Your backend base (Android emulator -> host machine)
const SERVER_URL = "http://10.0.2.2:3000";
const FAVORITES_KEY = "FAV_RECIPE_IDS";

async function syncFavorites() {
  const idToken = await AsyncStorage.getItem("idToken");
  const saved = await AsyncStorage.getItem(FAVORITES_KEY);
  const favoriteIds: string[] = saved ? JSON.parse(saved) : [];

  await fetch(`${SERVER_URL}/api/auth/update-favorites`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ favoriteIds }),
  });
}

type ExternalIngredient = {
  id: number;
  name: string;
  original: string;
  amount?: number;
  unit?: string;
  image?: string;
};

type Nutrient = {
  name: string;
  amount: number;
  unit: string;
  percentOfDailyNeeds: number;
};

type EquipmentItem = {
  name: string;
  image?: string | null;
};

type ExternalRecipe = {
  id: number;
  title: string;
  image?: string;
  sourceUrl?: string;
  readyInMinutes?: number;
  servings?: number;
  summary?: string;
  instructions?: string;
  extendedIngredients?: ExternalIngredient[];
  equipment?: EquipmentItem[];
  nutrition?: { nutrients: Nutrient[] } | null;
  price?: number;
  reviewCount?: number;
  totalStars?: number;
  viewCount?: number;
  galleryImages?: unknown;
};

/** Display shape used by the UI (normalized from both personal and external) */
type DisplayRecipe = {
  title: string;
  image?: string | null;
  /** Extra photos from firebase storage */
  galleryImages?: Array<{ url: string; uploadedBy: string | null }>;
  readyInMinutes?: number;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  summary?: string;
  instructions?: string;
  equipment?: EquipmentItem[];
  calories?: number;
  rating?: number;
  reviewsLength?: number;
  viewCount?: number;
  price?: number;
};

type SimilarRecipe = {
  id: string;
  title: string;
  image?: string | null;
  calories?: number | null;
  similarityScore?: number;
};

type RecipeCollectionRow = {
  id: string;
  name: string;
  recipeIds: string[];
};

function stripHtml(html?: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function isExternalFirestoreRecipeId(id: string): boolean {
  return id.startsWith("spoonacular_");
}

function isRawExternalRecipeId(id: string): boolean {
  return /^\d+$/.test(id);
}

/* Personal recipes use Firestore IDs (alphanumeric); external use Spoonacular IDs (numeric only) */
function isPersonalRecipeId(id: string): boolean {
  return !isExternalFirestoreRecipeId(id) && !isRawExternalRecipeId(id);
}

function parseGalleryImagesFromApi(
  galleryImages: unknown,
  recipeUserId: string | null,
): Array<{ url: string; uploadedBy: string | null }> {
  if (!Array.isArray(galleryImages)) return [];
  const out: Array<{ url: string; uploadedBy: string | null }> = [];
  for (const item of galleryImages) {
    if (typeof item === "string" && item.length > 0) {
      out.push({
        url: item,
        uploadedBy: recipeUserId,
      });
    } else if (
      item &&
      typeof item === "object" &&
      "url" in item &&
      typeof (item as { url: unknown }).url === "string"
    ) {
      const g = item as { url: string; uploadedBy?: string };
      out.push({
        url: g.url,
        uploadedBy: typeof g.uploadedBy === "string" ? g.uploadedBy : recipeUserId,
      });
    }
  }
  return out;
}

export default function RecipeDetailsPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();

  const insets = useSafeAreaInsets();

  const id = useMemo(() => {
    const raw = Array.isArray(recipeId) ? recipeId[0] : recipeId;
    return raw ?? "";
  }, [recipeId]);

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<DisplayRecipe | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isIngredientsOpen, setIsIngredientsOpen] = useState(true);
  const [isFavorited, setIsFavorited] = useState(false);
  const [similarRecipes, setSimilarRecipes] = useState<SimilarRecipe[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveCollections, setSaveCollections] = useState<RecipeCollectionRow[]>([]);
  const [saveCollectionsLoading, setSaveCollectionsLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [saveActionId, setSaveActionId] = useState<string | null>(null);
  const [createCollectionStep, setCreateCollectionStep] = useState(false);
  /** Personal recipe creator (from API userId + authorUsername + optional photo). */
  const [recipeAuthor, setRecipeAuthor] = useState<{
    userId: string;
    username: string | null;
    profilePhotoUrl: string | null;
  } | null>(null);
  /** Recipe owner `userId` from API (set even when author row is not shown). */
  const [recipeOwnerId, setRecipeOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem("uid").then(setCurrentUserId);
  }, []);

  const recipeGalleryItems = useMemo(() => {
    const owner = recipeOwnerId ?? recipeAuthor?.userId ?? null;
    const out: { url: string; uploadedBy: string | null; isMain: boolean }[] = [];
    if (recipe?.image) {
      out.push({ url: recipe.image, uploadedBy: owner, isMain: true });
    }
    for (const g of recipe?.galleryImages ?? []) {
      const url = g.url;
      const uploadedBy = g.uploadedBy != null && g.uploadedBy !== "" ? g.uploadedBy : owner;
      if (url && !out.some((x) => x.url === url)) {
        out.push({ url, uploadedBy, isMain: false });
      }
    }
    return out;
  }, [recipe?.galleryImages, recipe?.image, recipeAuthor?.userId, recipeOwnerId]);

  /** Numeric Spoonacular ids use external_recipes; gallery is stored there once the recipe is cached. */
  const canUploadGallery =
    (isPersonalRecipeId(id) ||
      isExternalFirestoreRecipeId(id) ||
      isRawExternalRecipeId(id)) &&
    currentUserId !== null;

  const toggleFavorite = async () => {
    if (!id) return;

    const next = !isFavorited;
    setIsFavorited(next);

    const saved = await AsyncStorage.getItem(FAVORITES_KEY);
    const favoriteIds: string[] = saved ? JSON.parse(saved) : [];

    const updated = next
      ? [...new Set([...favoriteIds, id])]
      : favoriteIds.filter((fav) => fav !== id);

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    await syncFavorites();
  };

  const fetchCollectionsForSave = async () => {
    try {
      setSaveCollectionsLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setSaveCollections([]);
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setSaveCollections([]);
        return;
      }
      const data = await res.json();
      const list: RecipeCollectionRow[] = Array.isArray(data.collections)
        ? data.collections.map((c: RecipeCollectionRow) => ({
            id: c.id,
            name: c.name,
            recipeIds: Array.isArray(c.recipeIds) ? c.recipeIds : [],
          }))
        : [];
      setSaveCollections(list);
    } catch {
      setSaveCollections([]);
    } finally {
      setSaveCollectionsLoading(false);
    }
  };

  const openSaveModal = () => {
    setSaveModalOpen(true);
    setCreateCollectionStep(false);
    setNewCollectionName("");
    void fetchCollectionsForSave();
  };

  const collectionContainsRecipe = (c: RecipeCollectionRow) =>
    id ? c.recipeIds.includes(id) : false;

  const addRecipeToCollectionAndClose = async (collectionId: string) => {
    if (!id) return;
    const col = saveCollections.find((c) => c.id === collectionId);
    if (col && collectionContainsRecipe(col)) {
      setSaveModalOpen(false);
      return;
    }
    try {
      setSaveActionId(collectionId);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch(`${SERVER_URL}/api/auth/collections/${collectionId}/recipes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipeId: id }),
      });
      if (res.ok) {
        setSaveCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId ? { ...c, recipeIds: [...c.recipeIds, id] } : c,
          ),
        );
        setSaveModalOpen(false);
      }
    } finally {
      setSaveActionId(null);
    }
  };

  const createCollectionAndSaveRecipe = async () => {
    const name = newCollectionName.trim();
    if (!name || !id) {
      Alert.alert("Name required", "Enter a name for your new collection.");
      return;
    }
    try {
      setSaveActionId("__create__");
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, recipeId: id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Alert.alert("Could not create", err?.error || "Try again.");
        return;
      }
      const data = await res.json();
      const col = data.collection;
      if (col?.id) {
        setSaveCollections((prev) => [
          {
            id: col.id,
            name: col.name ?? name,
            recipeIds: Array.isArray(col.recipeIds) ? col.recipeIds : [id],
          },
          ...prev,
        ]);
      }
      setNewCollectionName("");
      setCreateCollectionStep(false);
      setSaveModalOpen(false);
    } finally {
      setSaveActionId(null);
    }
  };

  /* SIMILAR RECIPES FETCH */
  const fetchSimilarRecipes = async (recipeIdValue: string) => {
    if (!recipeIdValue) {
      setSimilarRecipes([]);
      return;
    }

    const similarityId = /^\d+$/.test(recipeIdValue)
      ? `spoonacular_${recipeIdValue}`
      : recipeIdValue;

    try {
      setSimilarLoading(true);

      const response = await fetch(
        `${SERVER_URL}/api/combined-recipes/similar/${similarityId}`
      );
      const data = await response.json();
      if (!response.ok) {
        setSimilarRecipes([]);
        return;
      }

      const results: SimilarRecipe[] = Array.isArray(data?.results)
        ? data.results
        : [];

      setSimilarRecipes(results);
    } catch (error) {
      setSimilarRecipes([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  const shareRecipeLink = () => {
    if (!id) return;
    void openNativeShare(buildRecipeShareWebUrl(id), "Share recipe");
  };

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) return;
      setLoading(true);

      try {
        setRecipeAuthor(null);
        setRecipeOwnerId(null);
        const idToken = await AsyncStorage.getItem("idToken");
        const uid = await AsyncStorage.getItem("uid");
        if (!idToken || !uid) {
          router.replace({
            pathname: "/login",
            params: { redirectTo: `/recipe/${id}` },
          });
          return;
        }

        const saved = await AsyncStorage.getItem(FAVORITES_KEY);
        const favoriteIds: string[] = saved ? JSON.parse(saved) : [];
        setIsFavorited(favoriteIds.includes(id));

        if (isPersonalRecipeId(id)) {
          const response = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });

          const data = await response.json();

          if (!response.ok) {
            const msg = data?.error || "Failed to fetch recipe";
            if (
              typeof msg === "string" &&
              msg.toLowerCase().includes("token")
            ) {
              router.replace({
                pathname: "/login",
                params: { redirectTo: `/recipe/${id}` },
              });
              return;
            }
            throw new Error(msg);
          }

          const r = data.recipe;

          const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : (Array.isArray(r.reviews) ? r.reviews.length : 0);
          const totalStars = typeof r.totalStars === "number" ? r.totalStars : (Array.isArray(r.reviews) ? r.reviews.reduce((s: number, rev: { rating?: number }) => s + (rev?.rating ?? 0), 0) : 0);
          const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

          const ownerId = typeof r.userId === "string" ? r.userId : null;
          setRecipeOwnerId(ownerId);

          setRecipe({
            title: r.title,
            summary: r.summary,
            image: r.image,
            galleryImages: parseGalleryImagesFromApi(r.galleryImages, ownerId),
            prepTime: r.prepTime,
            cookTime: r.cookTime,
            readyInMinutes: (r.prepTime ?? 0) + (r.cookTime ?? 0),
            servings: r.servings,
            instructions: r.instructions,
            calories:
              Array.isArray(r?.nutrition?.nutrients)
                ? Math.round(
                  Number(
                    r.nutrition.nutrients.find((n: any) => n?.name === "Calories")
                      ?.amount ?? 0
                  )
                ) || undefined
                : undefined,
            rating: avgRating,
            reviewsLength: reviewCount,
            viewCount: typeof r.viewCount === "number" ? r.viewCount : 0,
            price: r.price,
          });

          const photoRaw =
            typeof r.authorProfilePhotoUrl === "string" ? r.authorProfilePhotoUrl.trim() : "";
          setRecipeAuthor(
            ownerId
              ? {
                  userId: ownerId,
                  username:
                    typeof r.authorUsername === "string" ? r.authorUsername : null,
                  profilePhotoUrl: photoRaw.length > 0 ? photoRaw : null,
                }
              : null,
          );

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          setIngredients(
            ext.map((ing: any) => ({
              name: ing.name,
              quantity: Number(ing.amount ?? 0),
              unit: ing.unit ?? "",
            }))
          );

          await fetchSimilarRecipes(id);
        }

        /* EXTERNAL FIRESTORE RECIPE */
        else if (isExternalFirestoreRecipeId(id)) {
          setRecipeAuthor(null);
          const idToken = await AsyncStorage.getItem("idToken");

          const response = await fetch(`${SERVER_URL}/api/recipes/${id}`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });
          const data = await response.json();
          const r = data.recipe;

          const fsOwnerId = typeof r.userId === "string" ? r.userId : null;
          setRecipeOwnerId(fsOwnerId);

          setRecipe({
            title: r.title,
            summary: r.summary,
            image: r.image,
            galleryImages: parseGalleryImagesFromApi(r.galleryImages, fsOwnerId),
            readyInMinutes: r.readyInMinutes,
            servings: r.servings,
            instructions: r.instructions,
            equipment: r.equipment ?? [],
            calories: r.calories,
            rating: r.rating ?? 0,
            reviewsLength: r.reviews?.length ?? 0,
            price: r.price,
          });

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          setIngredients(
            ext.map((ing: any) => ({
              name: ing.name,
              quantity: Number(ing.amount ?? 0),
              unit: ing.unit ?? "",
            }))
          );

          await fetchSimilarRecipes(id);

        // External recipe: include nutrition so we can show calories on this page
        } else {
          setRecipeAuthor(null);
          setRecipeOwnerId(null);
          const response = await fetch(
            `${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`,
            { method: "GET" },
          );
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data?.error || "Failed to fetch external recipe");
          }

          const r: ExternalRecipe = data.recipe;

          const caloriesNutrient = r.nutrition?.nutrients?.find(
            (n) => n.name === "Calories",
          );
          const calories =
            caloriesNutrient?.amount != null
              ? Math.round(Number(caloriesNutrient.amount))
              : undefined;

          const reviewCount = typeof r.reviewCount === "number" ? r.reviewCount : 0;
          const totalStars = typeof r.totalStars === "number" ? r.totalStars : 0;
          const avgRating = reviewCount > 0 ? Math.round((totalStars / reviewCount) * 10) / 10 : 0;

          setRecipe({
            title: r.title,
            image: r.image,
            galleryImages: parseGalleryImagesFromApi(r.galleryImages, null),
            readyInMinutes: r.readyInMinutes,
            servings: r.servings,
            summary: r.summary ?? undefined,
            instructions: r.instructions ?? undefined,
            equipment: r.equipment ?? [],
            calories,
            rating: avgRating,
            reviewsLength: reviewCount,
            viewCount: typeof r.viewCount === "number" ? r.viewCount : 0,
            price: r.price ?? undefined,
          });

          setIngredients(
            (r.extendedIngredients ?? []).map((ing) => ({
              name: ing.name,
              amount: Number((ing.amount ?? 1).toFixed(2)),
              unit: ing.unit ?? "serving",
            })),
          );

          await fetchSimilarRecipes(id);
        }
      } catch (error) {
        console.error("Error fetching recipe:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id, router]);

  if (loading) {
    return (
      <View className="flex-1 bg-app-background items-center justify-center">
        <ActivityIndicator size="large" color="red" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-app-background gap-6">
      {/* HEADER: Recipe Image + Favorite Button + Back Button */}
      <View className="relative">
        <RecipeHeroGallery
          items={recipeGalleryItems}
          recipeId={id}
          canUpload={canUploadGallery}
          serverUrl={SERVER_URL}
          currentUserId={currentUserId}
          recipeOwnerId={recipeOwnerId}
          onAppendGalleryEntry={(entry) => {
            setRecipe((prev) =>
              prev
                ? {
                    ...prev,
                    galleryImages: [
                      ...(prev.galleryImages ?? []),
                      { url: entry.url, uploadedBy: entry.uploadedBy || null },
                    ],
                  }
                : null,
            );
          }}
          onRemoveImageUrl={(url) => {
            setRecipe((prev) => {
              if (!prev) return null;
              if (prev.image === url) {
                return { ...prev, image: null };
              }
              return {
                ...prev,
                galleryImages: (prev.galleryImages ?? []).filter((g) => g.url !== url),
              };
            });
          }}
        />

        <TouchableOpacity
          onPress={() => {
            if (navigation.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/home");
          }}
          className="absolute left-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
        >
          <IconSymbol name="chevron-left" size={24} color="--color-red-primary" />
        </TouchableOpacity>

        {/* Favorite Button */}
        <View className="absolute right-4 top-20 flex-row gap-2">
          <TouchableOpacity
            onPress={openSaveModal}
            className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
          >
            <IconSymbol name="bookmark-outline" size={22} color="--color-red-primary" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleFavorite}
            className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
          >
            <IconSymbol
              name={isFavorited ? "cards-heart" : "cards-heart-outline"}
              size={24}
              color="--color-red-primary"
              style={{ transform: [{ translateY: 1 }, { translateX: 0.5 }] }}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View
        className="flex-1"
        style={{
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: insets.bottom,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} className="px-6">
          <View className="gap-4">
            {/* TITLE + SUBTEXT */}
            <View className="gap-2">
              <Text className="text-3xl font-bold text-center text-red-primary">
                {recipe?.title || "Recipe Name"}
              </Text>

              {recipeAuthor ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  className="flex-row items-center justify-center gap-2 py-0.5"
                  onPress={() =>
                    router.push({
                      pathname: "/profile/[userId]",
                      params: { userId: recipeAuthor.userId },
                    })
                  }
                >
                  <Text className="text-muted-foreground text-xs">by</Text>
                  {recipeAuthor.profilePhotoUrl ? (
                    <Image
                      source={{ uri: recipeAuthor.profilePhotoUrl }}
                      style={{ width: 22, height: 22, borderRadius: 11 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-[22px] h-[22px] rounded-full bg-red-primary/15 items-center justify-center">
                      <Text className="text-[10px] font-bold text-red-primary">
                        {(recipeAuthor.username || "?").trim().slice(0, 1).toUpperCase() || "?"}
                      </Text>
                    </View>
                  )}
                  <Text className="text-foreground text-xs font-medium max-w-[70%]" numberOfLines={1}>
                    {recipeAuthor.username || "Savr creator"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View className="flex-row items-center justify-center gap-4 flex-wrap">
                <RecipeRating
                  rating={recipe?.rating ?? 0}
                  reviewsLength={recipe?.reviewsLength ?? 0}
                />
                <Text className="text-muted-foreground text-sm font-medium">
                  {(recipe?.viewCount ?? 0).toLocaleString()} views
                </Text>
                <Text className="text-muted-foreground text-sm font-medium">
                  Calories: {recipe?.calories != null ? recipe.calories : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm font-medium">
                  Avg. ${recipe?.price != null ? recipe.price.toFixed(2) : "—"}
                </Text>
              </View>
            </View>

            <View className="bg-background rounded-xl shadow h-20 w-full items-center justify-evenly flex-row">
              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.prepTime != null
                    ? `${recipe.prepTime} min`
                    : recipe?.readyInMinutes != null
                      ? `${recipe.readyInMinutes} min`
                      : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm">
                  {recipe?.prepTime != null ? "Prep" : "Total"}
                </Text>
              </View>

              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.cookTime != null ? `${recipe.cookTime} min` : "—"}
                </Text>
                <Text className="text-muted-foreground text-sm">Cook</Text>
              </View>

              <View className="justify-center items-center">
                <Text className="text-foreground font-bold">
                  {recipe?.servings ?? 0}
                </Text>
                <Text className="text-muted-foreground text-sm">Servings</Text>
              </View>
            </View>

            {/* Description */}
            <Text className="text-foreground">
              {stripHtml(recipe?.summary ?? "") || "No description available"}
            </Text>

            {/* BUTTON ROW */}
            <View className="flex-row justify-between gap-2">
              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({
                    pathname: "/recipe/nutrition",
                    params: { recipeId: id },
                  })
                }
              >
                <IconSymbol
                  name="invoice-list-outline"
                  size={18}
                  color="--color-foreground"
                />
                <Text className="font-medium text-foreground">Nutrition</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={() =>
                  router.push({
                    pathname: "/recipe/reviews",
                    params: { recipeId: id },
                  })
                }
              >
                <IconSymbol name="chat-outline" size={18} color="--color-foreground" />
                <Text className="font-medium text-foreground">Reviews</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-background rounded-xl shadow h-12 flex-row items-center justify-center gap-2"
                onPress={shareRecipeLink}
              >
                <IconSymbol
                  name="share-variant-outline"
                  size={18}
                  color="--color-foreground"
                />
                <Text className="font-medium text-foreground">Share</Text>
              </TouchableOpacity>
            </View>

            {/* TOGGLE BUTTONS */}
            <View className="flex-row justify-around items-center bg-background rounded-xl h-10 p-1 shadow">
              <TouchableOpacity
                className={`w-1/2 py-1 rounded-lg ${isIngredientsOpen ? "bg-red-primary" : "bg-background"
                  }`}
                onPress={() => setIsIngredientsOpen(true)}
              >
                <Text
                  className={`text-center ${isIngredientsOpen ? "text-white" : "text-foreground"
                    }`}
                >
                  Ingredients
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`w-1/2 py-1 rounded-lg ${!isIngredientsOpen ? "bg-red-primary" : "bg-background"
                  }`}
                onPress={() => setIsIngredientsOpen(false)}
              >
                <Text
                  className={`text-center ${!isIngredientsOpen ? "text-white" : "text-foreground"
                    }`}
                >
                  Instructions
                </Text>
              </TouchableOpacity>
            </View>

            {/* CONTENT SECTIONS */}
            <View className="gap-2">
              {isIngredientsOpen ? (
                <View className="bg-background rounded-xl p-4 shadow gap-2">
                  {ingredients.length > 0 ? (
                    <IngredientsList list={ingredients} />
                  ) : (
                    <Text className="text-foreground font-medium">
                      No ingredients available
                    </Text>
                  )}
                </View>
              ) : (
                <View className="bg-background rounded-xl p-4 shadow gap-2">
                  <Text className="text-foreground font-medium">
                    {stripHtml(recipe?.instructions) || "No instructions available"}
                  </Text>
                </View>
              )}

              {/* Cookware / Equipment */}
              {recipe?.equipment && recipe.equipment.length > 0 && (
                <View className="bg-background rounded-xl p-4 shadow gap-2">
                  <Text className="text-lg font-semibold text-foreground">
                    Cookware Needed
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {recipe.equipment.map((item, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center gap-2 bg-background border border-muted-background rounded-xl px-3 py-2"
                      >
                        {item.image ? (
                          <Image
                            source={{ uri: item.image }}
                            className="w-8 h-8 rounded"
                            resizeMode="contain"
                          />
                        ) : (
                          <IconSymbol
                            name="pot-steam-outline"
                            size={20}
                            color="--color-icon"
                          />
                        )}
                        <Text className="text-foreground font-medium">
                          {item.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View className="bg-background rounded-xl p-4 shadow gap-3">
                <Text className="text-lg font-semibold text-foreground">
                  Similar Recipes
                </Text>

                {similarLoading ? (
                  <View className="py-4 items-center justify-center">
                    <ActivityIndicator size="small" color="red" />
                  </View>
                ) : similarRecipes.length > 0 ? (
                  similarRecipes.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      className="flex-row items-center bg-white rounded-xl p-3 shadow"
                      onPress={() =>
                        router.push({
                          pathname: "/recipe/[recipeId]",
                          params: { recipeId: String(item.id) },
                        })
                      }
                    >
                      {item.image ? (
                        <Image
                          source={{ uri: item.image }}
                          className="w-20 h-20 rounded-xl mr-3"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-20 h-20 rounded-xl mr-3 bg-muted-background items-center justify-center">
                          <IconSymbol
                            name="image-outline"
                            size={24}
                            color="--color-icon"
                          />
                        </View>
                      )}

                      <View className="flex-1">
                        <Text className="text-red-primary font-bold text-base">
                          {item.title}
                        </Text>
                        <Text className="text-foreground mt-1">
                          {item.calories != null
                            ? `${item.calories} calories`
                            : "Calories unavailable"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text className="text-muted-foreground">
                    No similar recipes found.
                  </Text>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      <Modal
        visible={saveModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (createCollectionStep) setCreateCollectionStep(false);
          else setSaveModalOpen(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/40 justify-end"
            onPress={() => {
              if (createCollectionStep) setCreateCollectionStep(false);
              else setSaveModalOpen(false);
            }}
          >
            <Pressable
              className="bg-background rounded-t-3xl"
              style={{ maxHeight: "88%" }}
              onPress={(e) => e.stopPropagation()}
            >
              {createCollectionStep ? (
                <View className="p-5 gap-4">
                  <Text className="text-lg font-bold text-foreground">New collection</Text>
                  <TextInput
                    placeholder="Collection name"
                    placeholderTextColor="#888"
                    value={newCollectionName}
                    onChangeText={setNewCollectionName}
                    className="border border-border rounded-xl px-3 py-2.5 text-foreground"
                    editable={saveActionId !== "__create__"}
                    autoFocus
                  />
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className="flex-1 py-3 rounded-xl bg-muted-background items-center"
                      onPress={() => {
                        setCreateCollectionStep(false);
                        setNewCollectionName("");
                      }}
                      disabled={saveActionId === "__create__"}
                    >
                      <Text className="font-medium text-foreground">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="flex-1 py-3 rounded-xl bg-red-primary items-center"
                      onPress={() => void createCollectionAndSaveRecipe()}
                      disabled={saveActionId === "__create__"}
                    >
                      {saveActionId === "__create__" ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="font-semibold text-white">Create</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View className="p-5 gap-3">
                  <Text className="text-lg font-bold text-foreground">Save to collection</Text>

                  {saveCollectionsLoading ? (
                    <View className="py-10 items-center">
                      <ActivityIndicator size="large" color="red" />
                    </View>
                  ) : (
                    <ScrollView
                      className="max-h-80"
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                    >
                      {saveCollections.length === 0 ? (
                        <Text className="text-muted-foreground text-sm py-2">
                          No collections yet. Add one below.
                        </Text>
                      ) : (
                        saveCollections.map((c) => {
                          const saved = collectionContainsRecipe(c);
                          const busy = saveActionId === c.id;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              className="py-3.5 border-b border-border flex-row items-center justify-between gap-2"
                              onPress={() => void addRecipeToCollectionAndClose(c.id)}
                              disabled={busy}
                            >
                              <View className="flex-1 flex-row items-center gap-1.5 min-w-0">
                                <Text className="text-foreground font-medium flex-1" numberOfLines={1}>
                                  {c.name}
                                </Text>
                                {saved ? (
                                  <Text className="text-muted-foreground text-xs">· saved</Text>
                                ) : null}
                              </View>
                              {busy ? <ActivityIndicator size="small" color="red" /> : null}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  )}

                  <TouchableOpacity
                    className="mt-2 py-3.5 rounded-xl border border-red-primary items-center"
                    onPress={() => {
                      setNewCollectionName("");
                      setCreateCollectionStep(true);
                    }}
                  >
                    <Text className="text-red-primary font-semibold">Add collection</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
