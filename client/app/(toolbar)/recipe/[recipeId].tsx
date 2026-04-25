import { IngredientsList } from "@/components/recipe/ingredients-list";
import { RecipeHeroGallery } from "@/components/recipe/recipe-hero-gallery";
import RecipeRating from "@/components/recipe/recipe-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useNetwork } from "@/contexts/network-context";
import { Ingredient } from "@/types/ingredient";
import {
  CACHE_KEYS,
  CachedRecipeEntry,
  collectionDetailKey,
  readCache,
  recipeDetailKey,
  writeCache,
} from "@/utils/offline-cache";
import { recordRecipeViewHistory, recipeToHistoryEntry } from "@/utils/recipe-view-history";
import { enqueueMutation } from "@/utils/mutation-queue";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import { RecipeNotesModal } from "@/components/recipe/recipe-notes-modal";
import { useThemePalette } from "@/components/theme-provider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildRecipeShareWebUrl, openNativeShare } from "@/utils/profile-share";

import { SERVER_URL } from "@/utils/server-url";
import { useRecipeWebColumnWidth } from "@/hooks/use-recipe-web-column-width";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";

function newClientCollectionId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Reads the ID-only favorites list and pushes it to the server.
// When offline, the caller is responsible for queuing this operation instead.
async function syncFavorites() {
  const idToken = await AsyncStorage.getItem("idToken");
  const raw = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES_IDS);
  const favoriteIds: string[] = raw ? JSON.parse(raw) : [];

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

/** Display shape used by the UI (normalized from both personal and external).
 *  Must remain structurally compatible with CachedRecipeEntry["recipe"]. */
type DisplayRecipe = CachedRecipeEntry["recipe"] & { equipment?: EquipmentItem[] };

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
  /** Kept in sync with `recipeIds.length` for collection grid tiles (offline + cache). */
  recipeCount: number;
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
  const theme = useThemePalette();
  const saveModalMaxHeight = Math.round(Dimensions.get("window").height * 0.88);
  const router = useRouter();
  const navigation = useNavigation();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const { isOnline } = useNetwork();
  const { isWebDesktop } = useWebDesktopLayout();
  const recipeDesktopColumnWidth = useRecipeWebColumnWidth();

  const insets = useSafeAreaInsets();

  const id = useMemo(() => {
    const raw = Array.isArray(recipeId) ? recipeId[0] : recipeId;
    return raw ?? "";
  }, [recipeId]);

  const [loading, setLoading] = useState(true);
  const [notCached, setNotCached] = useState(false);
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
  // Notes feature
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [substitutions, setSubstitutions] = useState<
    {
      originalIngredient: { name: string; amount: number; unit: string; spoonacularId?: number };
      substituteIngredients: { name: string; amount: number; unit: string }[];
      rawText: string;
    }[]
  >([]);

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

    // FAVORITES_IDS holds only the plain string IDs; this is the source of truth
    // for which recipes are favorited and what gets synced to Firebase.
    const raw = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES_IDS);
    const favoriteIds: string[] = raw ? JSON.parse(raw) : [];

    const updated = next
      ? [...new Set([...favoriteIds, id])]
      : favoriteIds.filter((fav) => fav !== id);

    await AsyncStorage.setItem(CACHE_KEYS.FAVORITES_IDS, JSON.stringify(updated));

    if (isOnline) {
      await syncFavorites();
    } else {
      // Enqueue the sync so it runs when connectivity is restored.
      await enqueueMutation({ type: "SYNC_FAVORITES", payload: { favoriteIds: updated } });
    }
  };

  const fetchCollectionsForSave = async () => {
    try {
      setSaveCollectionsLoading(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setSaveCollections([]);
        return;
      }
      if (!isOnline) {
        const cached = await readCache<RecipeCollectionRow[]>(CACHE_KEYS.COLLECTIONS_MINE);
        const rows = Array.isArray(cached) ? cached : [];
        setSaveCollections(
          rows.map((c) => ({
            ...c,
            recipeIds: Array.isArray(c.recipeIds) ? c.recipeIds : [],
            recipeCount:
              typeof c.recipeCount === "number"
                ? c.recipeCount
                : Array.isArray(c.recipeIds)
                  ? c.recipeIds.length
                  : 0,
          })),
        );
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/auth/collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const cached = await readCache<RecipeCollectionRow[]>(CACHE_KEYS.COLLECTIONS_MINE);
        const rows = Array.isArray(cached) ? cached : [];
        setSaveCollections(
          rows.map((c) => ({
            ...c,
            recipeIds: Array.isArray(c.recipeIds) ? c.recipeIds : [],
            recipeCount:
              typeof c.recipeCount === "number"
                ? c.recipeCount
                : Array.isArray(c.recipeIds)
                  ? c.recipeIds.length
                  : 0,
          })),
        );
        return;
      }
      const data = await res.json();
      const list: RecipeCollectionRow[] = Array.isArray(data.collections)
        ? data.collections.map((c: { id: string; name: string; recipeIds?: string[]; recipeCount?: number }) => {
          const ids = Array.isArray(c.recipeIds) ? c.recipeIds : [];
          return {
            id: c.id,
            name: c.name,
            recipeIds: ids,
            recipeCount: typeof c.recipeCount === "number" ? c.recipeCount : ids.length,
          };
        })
        : [];
      setSaveCollections(list);
      await writeCache(CACHE_KEYS.COLLECTIONS_MINE, list);
    } catch {
      const cached = await readCache<RecipeCollectionRow[]>(CACHE_KEYS.COLLECTIONS_MINE);
      const rows = Array.isArray(cached) ? cached : [];
      setSaveCollections(
        rows.map((c) => ({
          ...c,
          recipeIds: Array.isArray(c.recipeIds) ? c.recipeIds : [],
          recipeCount:
            typeof c.recipeCount === "number"
              ? c.recipeCount
              : Array.isArray(c.recipeIds)
                ? c.recipeIds.length
                : 0,
        })),
      );
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

  const closeAndSaveNotes = async () => {
    setNotesModalOpen(false);
    if (!id) return;

    // Always keep the local cache in sync for offline access.
    await AsyncStorage.setItem(`recipe_note_${id}`, noteText);
    await AsyncStorage.setItem(`recipe_substitutions_${id}`, JSON.stringify(substitutions));

    if (isOnline) {
      try {
        const idToken = await AsyncStorage.getItem("idToken");
        if (!idToken) return;
        await fetch(`${SERVER_URL}/api/auth/recipe-notes/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: noteText, substitutions }),
        });
      } catch {
        // Network failure — the local cache is still up to date; enqueue for retry.
        await enqueueMutation({ type: "UPSERT_RECIPE_NOTES", payload: { recipeId: id, text: noteText, substitutions } });
      }
    } else {
      await enqueueMutation({ type: "UPSERT_RECIPE_NOTES", payload: { recipeId: id, text: noteText, substitutions } });
    }
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
      if (!isOnline) {
        await enqueueMutation({
          type: "ADD_COLLECTION_RECIPE",
          payload: { collectionId, recipeId: id },
        });
        setSaveCollections((prev) => {
          const next = prev.map((c) => {
            if (c.id !== collectionId) return c;
            const recipeIds = [...c.recipeIds, id];
            return { ...c, recipeIds, recipeCount: recipeIds.length };
          });
          void writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
          return next;
        });
        const detailKey = collectionDetailKey("me", collectionId);
        const cur = await readCache<{ name: string; recipeIds: string[] }>(detailKey);
        const nextIds = cur?.recipeIds?.includes(id)
          ? cur.recipeIds
          : [id, ...(cur?.recipeIds ?? [])];
        const nm = cur?.name ?? col?.name ?? "";
        await writeCache(detailKey, { name: nm, recipeIds: nextIds });
        setSaveModalOpen(false);
        return;
      }
      const res = await fetch(`${SERVER_URL}/api/auth/collections/${collectionId}/recipes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipeId: id }),
      });
      if (res.ok) {
        setSaveCollections((prev) => {
          const next = prev.map((c) => {
            if (c.id !== collectionId) return c;
            const recipeIds = [...c.recipeIds, id];
            return { ...c, recipeIds, recipeCount: recipeIds.length };
          });
          void writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
          return next;
        });
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
      if (!isOnline) {
        const clientCollectionId = newClientCollectionId();
        await enqueueMutation({
          type: "CREATE_COLLECTION",
          payload: { clientCollectionId, name, recipeId: id },
        });
        const row: RecipeCollectionRow = {
          id: clientCollectionId,
          name,
          recipeIds: [id],
          recipeCount: 1,
        };
        setSaveCollections((prev) => {
          const next = [row, ...prev];
          void writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
          return next;
        });
        await writeCache(collectionDetailKey("me", clientCollectionId), {
          name,
          recipeIds: [id],
        });
        setNewCollectionName("");
        setCreateCollectionStep(false);
        setSaveModalOpen(false);
        return;
      }
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
        setSaveCollections((prev) => {
          const ids = Array.isArray(col.recipeIds) ? col.recipeIds : [id];
          const next = [
            {
              id: col.id,
              name: col.name ?? name,
              recipeIds: ids,
              recipeCount: typeof col.recipeCount === "number" ? col.recipeCount : ids.length,
            },
            ...prev,
          ];
          void writeCache(CACHE_KEYS.COLLECTIONS_MINE, next);
          return next;
        });
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
      setNotCached(false);

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

        const raw = await AsyncStorage.getItem(CACHE_KEYS.FAVORITES_IDS);
        const favoriteIds: string[] = raw ? JSON.parse(raw) : [];
        setIsFavorited(favoriteIds.includes(id));

        if (isOnline) {
          try {
            const notesRes = await fetch(
              `${SERVER_URL}/api/auth/recipe-notes/${encodeURIComponent(id)}`,
              { headers: { Authorization: `Bearer ${idToken}` } },
            );
            if (notesRes.ok) {
              const notesData = await notesRes.json();
              const text = typeof notesData.text === "string" ? notesData.text : "";
              const subs = Array.isArray(notesData.substitutions) ? notesData.substitutions : [];
              setNoteText(text);
              setSubstitutions(subs);
              // Keep local cache in sync.
              await AsyncStorage.setItem(`recipe_note_${id}`, text);
              await AsyncStorage.setItem(`recipe_substitutions_${id}`, JSON.stringify(subs));
            }
          } catch {
            // Fall back to local cache on network error.
            const savedNote = await AsyncStorage.getItem(`recipe_note_${id}`);
            setNoteText(savedNote ?? "");
            const savedSubs = await AsyncStorage.getItem(`recipe_substitutions_${id}`);
            setSubstitutions(savedSubs ? JSON.parse(savedSubs) : []);
          }
        } else {
          const savedNote = await AsyncStorage.getItem(`recipe_note_${id}`);
          setNoteText(savedNote ?? "");
          const savedSubs = await AsyncStorage.getItem(`recipe_substitutions_${id}`);
          setSubstitutions(savedSubs ? JSON.parse(savedSubs) : []);
        }

        if (!isOnline) {
          // Attempt to serve the recipe from the per-recipe cache.
          const cached = await readCache<CachedRecipeEntry>(recipeDetailKey(id));
          if (cached) {
            setRecipe(cached.recipe);
            // Guard against a malformed cache entry that is missing the ingredients array.
            setIngredients((cached.ingredients ?? []) as Ingredient[]);
            void recordRecipeViewHistory(recipeToHistoryEntry(id, cached.recipe));
          } else {
            // Recipe was never viewed while online; nothing to show.
            setNotCached(true);
          }
          setLoading(false);
          return;
        }

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

          const displayRecipe: DisplayRecipe = {
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
          };

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

          const mappedIngredients: Ingredient[] = ext.map((ing: any) => ({
            name: ing.name,
            amount: Number(ing.amount ?? 0),
            unit: ing.unit ?? "",
            spoonacularId: typeof ing.id === "number" ? ing.id : undefined,
          }));

          setRecipe(displayRecipe);
          setIngredients(mappedIngredients);
          void recordRecipeViewHistory(recipeToHistoryEntry(id, displayRecipe));

          // Cache so this recipe is available when the user is next offline.
          await writeCache<CachedRecipeEntry>(recipeDetailKey(id), {
            recipe: displayRecipe,
            ingredients: mappedIngredients,
          });

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

          const displayRecipe: DisplayRecipe = {
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
          };

          const ext = Array.isArray(r?.extendedIngredients)
            ? r.extendedIngredients
            : [];

          const mappedIngredients: Ingredient[] = ext.map((ing: any) => ({
            name: ing.name,
            amount: Number(ing.amount ?? 0),
            unit: ing.unit ?? "",
            spoonacularId: typeof ing.id === "number" ? ing.id : undefined,
          }));

          setRecipe(displayRecipe);
          setIngredients(mappedIngredients);
          void recordRecipeViewHistory(recipeToHistoryEntry(id, displayRecipe));

          await writeCache<CachedRecipeEntry>(recipeDetailKey(id), {
            recipe: displayRecipe,
            ingredients: mappedIngredients,
          });

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

          const displayRecipe: DisplayRecipe = {
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
          };

          const mappedIngredients: Ingredient[] = (r.extendedIngredients ?? []).map((ing) => ({
            name: ing.name,
            amount: Number((ing.amount ?? 1).toFixed(2)),
            unit: ing.unit ?? "serving",
            spoonacularId: typeof ing.id === "number" ? ing.id : undefined,
          }));

          setRecipe(displayRecipe);
          setIngredients(mappedIngredients);
          void recordRecipeViewHistory(recipeToHistoryEntry(id, displayRecipe));

          await writeCache<CachedRecipeEntry>(recipeDetailKey(id), {
            recipe: displayRecipe,
            ingredients: mappedIngredients,
          });

          await fetchSimilarRecipes(id);
        }
      } catch (error) {
        console.error("Error fetching recipe:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-app-background items-center justify-center">
        <ActivityIndicator size="large" color="red" />
      </View>
    );
  }

  // The recipe has never been viewed while online and cannot be served from cache.
  if (notCached) {
    return (
      <View className="flex-1 bg-app-background items-center justify-center px-8 gap-4">
        {!isWebDesktop ? (
          <TouchableOpacity
            onPress={() => router.back()}
            className="absolute left-4 top-20 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
          >
            <IconSymbol name="chevron-left" size={24} color="--color-red-primary" />
          </TouchableOpacity>
        ) : null}
        <IconSymbol name="wifi-off" size={48} color="--color-muted-foreground" />
        <Text className="text-foreground text-center text-lg font-semibold">
          Recipe not available offline
        </Text>
        <Text className="text-muted-foreground text-center">
          Open this recipe while connected to the internet to make it available offline.
        </Text>
      </View>
    );
  }

  const renderRecipeDetailBody = () => (
    <>
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
            <IngredientsList list={ingredients} substitutions={substitutions} />
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

        {/* Similar recipes require a live API call; hide the section when offline */}
        {!isOnline ? (
          <Text className="text-muted-foreground">
            Similar recipes are not available offline.
          </Text>
        ) : similarLoading ? (
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
    </>
  );

  return (
    <View className="flex-1 bg-app-background">
      {isWebDesktop ? (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator
          contentContainerStyle={{
            alignItems: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <View
            className="w-full"
            style={{
              maxWidth: recipeDesktopColumnWidth ?? undefined,
              width: "100%",
            }}
          >
            <View className="relative w-full overflow-hidden rounded-b-2xl">
        <RecipeHeroGallery
          items={recipeGalleryItems}
          recipeId={id}
          canUpload={canUploadGallery}
          serverUrl={SERVER_URL}
          currentUserId={currentUserId}
          recipeOwnerId={recipeOwnerId}
          heroSlideWidth={recipeDesktopColumnWidth}
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
              <View className="absolute right-3 flex-row gap-2" style={{ top: insets.top + 8 }}>
                <TouchableOpacity
                  onPress={() => setNotesModalOpen(true)}
                  className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
                >
                  <IconSymbol name="pencil-outline" size={20} color="--color-red-primary" />
                </TouchableOpacity>
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
            <View className="gap-4 w-full mt-5">
              {renderRecipeDetailBody()}
            </View>
          </View>
        </ScrollView>
      ) : (
        <>
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
              <View className="absolute right-4 top-20 flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setNotesModalOpen(true)}
                  className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
                >
                  <IconSymbol name="pencil-outline" size={20} color="--color-red-primary" />
                </TouchableOpacity>
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
              <View className="gap-4 w-full">{renderRecipeDetailBody()}</View>
            </ScrollView>
          </View>
        </>
      )}

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
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
              alignItems: isWebDesktop ? "center" : "stretch",
            }}
            onPress={() => {
              if (createCollectionStep) setCreateCollectionStep(false);
              else setSaveModalOpen(false);
            }}
          >
            <Pressable
              style={{
                maxHeight: saveModalMaxHeight,
                width: "100%",
                maxWidth: isWebDesktop ? 560 : undefined,
                backgroundColor: theme["--color-background"],
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderBottomLeftRadius: isWebDesktop ? 24 : 0,
                borderBottomRightRadius: isWebDesktop ? 24 : 0,
              }}
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
                      className="flex-1 py-3 rounded-xl items-center"
                      style={{ backgroundColor: theme["--color-red-primary"] }}
                      onPress={() => void createCollectionAndSaveRecipe()}
                      disabled={saveActionId === "__create__"}
                    >
                      {saveActionId === "__create__" ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="font-semibold" style={{ color: "#ffffff" }}>
                          Create
                        </Text>
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
                    className="mt-2 py-3.5 rounded-xl items-center"
                    style={{
                      borderWidth: 1,
                      borderColor: theme["--color-red-primary"],
                    }}
                    onPress={() => {
                      setNewCollectionName("");
                      setCreateCollectionStep(true);
                    }}
                  >
                    <Text className="font-semibold" style={{ color: theme["--color-red-primary"] }}>
                      Add collection
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <RecipeNotesModal
        visible={notesModalOpen}
        onRequestClose={() => void closeAndSaveNotes()}
        noteText={noteText}
        onNoteTextChange={setNoteText}
        substitutions={substitutions}
        onSubstitutionsChange={setSubstitutions}
        ingredients={ingredients}
      />
    </View>
  );
}
