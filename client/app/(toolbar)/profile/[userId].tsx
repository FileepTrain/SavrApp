import {
  SwipeableMealPlanCard,
  type MealPlanBulkExpandSignal,
} from "@/components/swipeable-mealplan-card";
import { CollectionTile } from "@/components/collection/collection-tile";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { RecipeCard } from "@/components/recipe-card";
import { useCollectionCoverImages } from "@/hooks/use-collection-cover-images";
import { useMealPlans } from "@/contexts/meal-plans-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { buildProfileShareWebUrl, openNativeShare } from "@/utils/profile-share";
import { prepareProfilePhotoForUpload } from "@/utils/prepare-profile-photo-upload";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountWebColumn } from "@/components/account/account-web-column";
import { useThemePalette } from "@/components/theme-provider";
import { useAccountWebColumnWidth } from "@/hooks/use-account-web-column-width";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import { SERVER_URL } from "@/utils/server-url";

type TabId = "recipes" | "favorites" | "boards" | "plans";

type RecipeRow = {
  id: string;
  title?: string;
  image?: string | null;
  calories?: number;
  rating?: number;
  reviewsLength?: number;
  reviews?: unknown[];
};

type CollectionRow = {
  id: string;
  name: string;
  recipeIds: string[];
  recipeCount: number;
};

type MealPlanRow = {
  id: string;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  start_date: string | null;
  end_date: string | null;
};

type ProfilePrivacy = {
  showFavorites: boolean;
  showCollections: boolean;
  showMealPlans: boolean;
};

function formatPlanDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function singleQueryParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push(arr.slice(i, i + 2));
  }
  return out;
}

export default function CreatorProfilePage() {
  const theme = useThemePalette();
  const router = useRouter();
  const navigation = useNavigation();
  const { isWebDesktop, contentWidth } = useWebDesktopLayout();
  const accountColumnMax = useAccountWebColumnWidth();
  const { refetch: refetchMealPlans } = useMealPlans();
  const params = useLocalSearchParams<{
    userId: string;
    tab?: string;
    mealPlanId?: string;
  }>();
  const globalParams = useGlobalSearchParams();
  const { userId } = params;
  const uid = Array.isArray(userId) ? userId[0] : userId;
  const linkTab =
    singleQueryParam(params.tab) ?? singleQueryParam(globalParams.tab);
  const linkMealPlanId =
    singleQueryParam(params.mealPlanId) ??
    singleQueryParam(globalParams.mealPlanId);

  const [viewerUid, setViewerUid] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("recipes");
  const [username, setUsername] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePrivacy, setProfilePrivacy] = useState<ProfilePrivacy>({
    showFavorites: true,
    showCollections: true,
    showMealPlans: true,
  });
  const [sectionVisibility, setSectionVisibility] = useState({
    favorites: true,
    collections: true,
    mealPlans: true,
  });
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [favorites, setFavorites] = useState<RecipeRow[] | null>(null);
  const [collections, setCollections] = useState<CollectionRow[] | null>(null);
  const [mealPlans, setMealPlans] = useState<MealPlanRow[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draftPrivacy, setDraftPrivacy] = useState<ProfilePrivacy>(profilePrivacy);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [mealPlanBulkSignal, setMealPlanBulkSignal] = useState<MealPlanBulkExpandSignal | null>(
    null,
  );
  const [plansMenuOpen, setPlansMenuOpen] = useState(false);
  const [followedCollectionKeys, setFollowedCollectionKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [followBusyCollectionId, setFollowBusyCollectionId] = useState<string | null>(null);
  const [collectionMenuId, setCollectionMenuId] = useState<string | null>(null);

  const { height: winH } = useWindowDimensions();
  /** Width of the profile column (matches other toolbar pages on desktop web). */
  const profileColumnWidth = useMemo(() => {
    if (isWebDesktop && accountColumnMax != null) {
      return Math.min(accountColumnMax, contentWidth);
    }
    return contentWidth;
  }, [isWebDesktop, accountColumnMax, contentWidth]);
  /** Boards tab: `px-4` container, two tiles, `gap-4` between them. */
  const collectionTileW = useMemo(
    () => Math.max(0, (profileColumnWidth - 32 - 16) / 2),
    [profileColumnWidth],
  );
  const profileEditSheetMaxHeight = Math.round(winH * 0.88);

  const profileCollectionCoverRows = useMemo(
    () => (collections ?? []).map((c) => ({ coverId: c.id, recipeIds: c.recipeIds })),
    [collections],
  );
  const profileCollectionCovers = useCollectionCoverImages(profileCollectionCoverRows);

  /** Meal plan to expand from shared link (`?mealPlanId=`); others start collapsed. */
  const highlightedPlanIdFromLink = useMemo(
    () => linkMealPlanId ?? null,
    [linkMealPlanId],
  );

  /** Signed-in user's uid must match this page's userId — do not rely on API alone for edit/delete. */
  const viewingOwnProfile = Boolean(uid && viewerUid && viewerUid === uid);

  useFocusEffect(
    useCallback(() => {
      void AsyncStorage.getItem("uid").then(setViewerUid);
    }, []),
  );

  const refreshFollowedKeys = useCallback(async () => {
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) {
      setFollowedCollectionKeys(new Set());
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/followed-collections`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) return;
      const next = new Set<string>();
      for (const c of data.collections ?? []) {
        if (typeof c.ownerUid === "string" && typeof c.id === "string") {
          next.add(`${c.ownerUid}_${c.id}`);
        }
      }
      setFollowedCollectionKeys(next);
    } catch {
      /* ignore */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshFollowedKeys();
    }, [refreshFollowedKeys]),
  );

  useEffect(() => {
    if (linkTab === "plans" || linkMealPlanId) setActiveTab("plans");
  }, [uid, linkTab, linkMealPlanId]);

  useEffect(() => {
    if (!mealPlans?.length) setPlansMenuOpen(false);
  }, [mealPlans?.length]);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      setLoading(true);
      setError(null);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        setError("Sign in to view profiles.");
        return;
      }
      const res = await fetch(
        `${SERVER_URL}/api/auth/users/${encodeURIComponent(uid)}/profile`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not load profile.");
        return;
      }
      setUsername(typeof data.username === "string" ? data.username : "User");
      const rawPhoto =
        typeof data.profilePhotoUrl === "string" ? data.profilePhotoUrl.trim() : "";
      setProfilePhotoUrl(rawPhoto.length > 0 ? rawPhoto : null);
      if (data.isOwnProfile && data.profilePrivacy && typeof data.profilePrivacy === "object") {
        const p = data.profilePrivacy as ProfilePrivacy;
        setProfilePrivacy({
          showFavorites: p.showFavorites !== false,
          showCollections: p.showCollections !== false,
          showMealPlans: p.showMealPlans !== false,
        });
      }
      if (data.sectionVisibility && typeof data.sectionVisibility === "object") {
        const s = data.sectionVisibility as {
          favorites?: boolean;
          collections?: boolean;
          mealPlans?: boolean;
        };
        setSectionVisibility({
          favorites: s.favorites !== false,
          collections: s.collections !== false,
          mealPlans: s.mealPlans !== false,
        });
      }
      setRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      setFavorites(data.favorites === null ? null : Array.isArray(data.favorites) ? data.favorites : []);
      setCollections(
        data.collections === null ? null : Array.isArray(data.collections) ? data.collections : [],
      );
      setMealPlans(
        data.mealPlans === null ? null : Array.isArray(data.mealPlans) ? data.mealPlans : [],
      );
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const insets = useSafeAreaInsets();
  const [photoLoadError, setPhotoLoadError] = useState(false);

  useEffect(() => {
    setPhotoLoadError(false);
  }, [profilePhotoUrl]);

  useEffect(() => {
    if (editOpen) {
      setDraftPrivacy(profilePrivacy);
    }
  }, [editOpen, profilePrivacy]);

  const initial = (username || "?").trim().slice(0, 1).toUpperCase() || "?";

  const openRecipe = (recipeId: string) => {
    router.push({
      pathname: "/recipe/[recipeId]",
      params: { recipeId },
    });
  };

  const shareProfilePlansLink = useCallback(() => {
    if (!uid) return;
    const url = buildProfileShareWebUrl(uid, { tab: "plans" });
    void openNativeShare(url, "Share profile");
  }, [uid]);

  const renderRecipeItem = ({ item }: { item: RecipeRow }) => {
    const reviewCount =
      typeof item.reviewsLength === "number"
        ? item.reviewsLength
        : Array.isArray(item.reviews)
          ? item.reviews.length
          : 0;
    const totalStars: number =
      Array.isArray(item.reviews)
        ? (item.reviews as { rating?: number }[]).reduce<number>(
            (s, rev) => s + (rev?.rating ?? 0),
            0,
          )
        : 0;
    const rating: number =
      typeof item.rating === "number"
        ? item.rating
        : reviewCount > 0
          ? Math.round((totalStars / reviewCount) * 10) / 10
          : 0;
    return (
      <View className="mb-3">
        <RecipeCard
          id={item.id}
          variant="horizontal"
          title={item.title ?? "Recipe"}
          calories={item.calories ?? 0}
          rating={rating}
          reviewsLength={reviewCount}
          imageUrl={item.image ?? undefined}
          onPress={() => openRecipe(item.id)}
        />
      </View>
    );
  };

  const hiddenMessage = (label: string) => (
    <View className="py-12 px-6">
      <View className="bg-background rounded-xl p-6 shadow-sm items-center gap-2">
        <IconSymbol name="lock-outline" size={36} color="--color-muted-foreground" />
        <Text className="text-foreground text-center font-medium">
          {label} are hidden
        </Text>
        <Text className="text-muted-foreground text-center text-sm">
          This creator chose not to share this section on their public profile.
        </Text>
      </View>
    </View>
  );

  const onPlansTabPress = () => {
    if (activeTab !== "plans") {
      setActiveTab("plans");
      setPlansMenuOpen(false);
      return;
    }
    if (!mealPlans?.length) return;
    setPlansMenuOpen((v) => !v);
  };

  const regularTabButton = (id: Exclude<TabId, "plans">, label: string) => {
    const on = activeTab === id;
    return (
      <TouchableOpacity
        key={id}
        className={`flex-1 py-2 rounded-lg ${on ? "bg-red-primary" : "bg-background"}`}
        onPress={() => {
          setPlansMenuOpen(false);
          setActiveTab(id);
        }}
      >
        <Text
          className={`text-center text-xs font-medium ${on ? "text-white" : "text-foreground"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const plansTabButton = () => {
    const on = activeTab === "plans";
    const showChevron = on && Boolean(mealPlans?.length);
    return (
      <TouchableOpacity
        key="plans"
        className={`flex-1 py-2 rounded-lg flex-row items-center justify-center gap-0.5 ${on ? "bg-red-primary" : "bg-background"}`}
        onPress={onPlansTabPress}
        accessibilityRole="button"
        accessibilityLabel={
          on && mealPlans?.length
            ? plansMenuOpen
              ? "Plans, close meal plan options"
              : "Plans, open meal plan options"
            : "Plans"
        }
      >
        <Text
          className={`text-center text-xs font-medium ${on ? "text-white" : "text-foreground"}`}
          numberOfLines={1}
        >
          Plans
        </Text>
        {showChevron ? (
          <IconSymbol
            name={plansMenuOpen ? "chevron-up" : "chevron-down"}
            size={14}
            color={on ? "#ffffff" : "--color-foreground"}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const savePrivacy = async () => {
    try {
      setSavingPrivacy(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;
      const res = await fetch(`${SERVER_URL}/api/auth/profile-privacy`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draftPrivacy),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Could not save settings.");
        return;
      }
      const next = data.profilePrivacy as ProfilePrivacy;
      if (next) {
        setProfilePrivacy({
          showFavorites: next.showFavorites !== false,
          showCollections: next.showCollections !== false,
          showMealPlans: next.showMealPlans !== false,
        });
      }
      setEditOpen(false);
      await load();
    } catch {
      setError("Could not save settings.");
    } finally {
      setSavingPrivacy(false);
    }
  };

  const pickAndUploadPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError("Photo library access is required.");
        return;
      }
      // allowsEditing breaks many Android content:// sources (e.g. Google Photos / Downloads).
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
        selectionLimit: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploadingPhoto(true);
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) return;

      const asset = result.assets[0];
      let uploadUri: string;
      let uploadName: string;
      let uploadType: string;
      try {
        const prepared = await prepareProfilePhotoForUpload(asset);
        uploadUri = prepared.uri;
        uploadName = prepared.name;
        uploadType = prepared.type;
      } catch (prepErr) {
        const msg =
          prepErr instanceof Error ? prepErr.message : "Could not read that photo.";
        setError(msg);
        Alert.alert("Photo", msg);
        return;
      }

      const form = new FormData();
      form.append("image", {
        uri: uploadUri,
        name: uploadName,
        type: uploadType,
      } as unknown as Blob);

      const res = await fetch(`${SERVER_URL}/api/auth/profile-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error === "string" ? data.error : "Upload failed. Try another photo.";
        setError(msg);
        Alert.alert("Upload failed", msg);
        return;
      }
      if (typeof data.profilePhotoUrl === "string") {
        setProfilePhotoUrl(data.profilePhotoUrl);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      setError(msg);
      Alert.alert("Upload failed", msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const listForTab = (): RecipeRow[] => {
    if (activeTab === "recipes") return recipes;
    if (activeTab === "favorites") return favorites ?? [];
    return [];
  };

  const listEmptyText = () => {
    if (activeTab === "recipes") return "No personal recipes yet.";
    if (activeTab === "favorites") return "No favorites yet.";
    return "";
  };

  const followCollectionKey = (collectionId: string) =>
    uid && collectionId ? `${uid}_${collectionId}` : "";

  const toggleFollowCollection = async (collectionId: string) => {
    if (!uid || viewingOwnProfile) return;
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return;
    const key = followCollectionKey(collectionId);
    const following = followedCollectionKeys.has(key);
    setFollowBusyCollectionId(collectionId);
    try {
      if (following) {
        const res = await fetch(
          `${SERVER_URL}/api/auth/followed-collections/${encodeURIComponent(uid)}/${encodeURIComponent(collectionId)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } },
        );
        if (res.ok) {
          setFollowedCollectionKeys((prev) => {
            const n = new Set(prev);
            n.delete(key);
            return n;
          });
          setCollectionMenuId(null);
        }
      } else {
        const res = await fetch(`${SERVER_URL}/api/auth/followed-collections`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ownerUid: uid, collectionId }),
        });
        if (res.ok) {
          setFollowedCollectionKeys((prev) => new Set(prev).add(key));
          setCollectionMenuId(null);
        }
      }
    } finally {
      setFollowBusyCollectionId(null);
    }
  };

  const collectionMenuRow =
    collectionMenuId && collections
      ? collections.find((c) => c.id === collectionMenuId)
      : null;
  const collectionMenuFollowing =
    collectionMenuId != null && followedCollectionKeys.has(followCollectionKey(collectionMenuId));

  const profileMetaAndTabs = (
    <>
      <View className="px-4 pt-4 pb-2 gap-1">
        <Text className="text-3xl font-bold text-center text-red-primary" numberOfLines={2}>
          {username || "User"}
        </Text>
        <Text className="text-muted-foreground text-center text-sm">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          {favorites && favorites.length > 0
            ? ` · ${favorites.length} favorited`
            : null}
        </Text>
      </View>

      {error ? (
        <Text className="text-center text-muted-foreground px-6 mb-2 text-sm">{error}</Text>
      ) : null}

      <View className="px-4 mb-3">
        <View className="flex-row bg-background rounded-xl h-11 p-1 shadow-sm gap-1">
          {regularTabButton("recipes", "Recipes")}
          {regularTabButton("favorites", "Favorites")}
          {regularTabButton("boards", "Collections")}
          {plansTabButton()}
        </View>
        {plansMenuOpen && activeTab === "plans" && mealPlans && mealPlans.length > 0 ? (
          <View className="mt-2 rounded-xl overflow-hidden bg-background border border-muted-background shadow-sm">
            <Pressable
              className="px-4 py-3.5 border-b border-muted-background active:opacity-80"
              onPress={() => {
                setMealPlanBulkSignal((s) => ({
                  generation: (s?.generation ?? 0) + 1,
                  expanded: true,
                }));
                setPlansMenuOpen(false);
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Expand all meal plans"
            >
              <Text className="text-foreground font-medium text-sm">Expand all</Text>
            </Pressable>
            <Pressable
              className="px-4 py-3.5 active:opacity-80"
              onPress={() => {
                setMealPlanBulkSignal((s) => ({
                  generation: (s?.generation ?? 0) + 1,
                  expanded: false,
                }));
                setPlansMenuOpen(false);
              }}
              accessibilityRole="menuitem"
              accessibilityLabel="Collapse all meal plans"
            >
              <Text className="text-foreground font-medium text-sm">Collapse all</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </>
  );

  const recipeList = (
    <FlatList
      data={listForTab()}
      keyExtractor={(item) => item.id}
      key={`${activeTab}-list`}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      ListHeaderComponent={profileMetaAndTabs}
      ListEmptyComponent={
        activeTab === "favorites" && !sectionVisibility.favorites ? (
          hiddenMessage("Favorites")
        ) : (
          <Text className="text-center text-muted-foreground py-10">{listEmptyText()}</Text>
        )
      }
      renderItem={renderRecipeItem}
    />
  );

  const boardsOrPlansScroll = (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {profileMetaAndTabs}
      <View className="px-4">
        {activeTab === "boards" ? (
          !sectionVisibility.collections ? (
            hiddenMessage("Collections")
          ) : !collections || collections.length === 0 ? (
            <Text className="text-center text-muted-foreground py-10">No collections yet.</Text>
          ) : (
            <View className="gap-4">
              {chunkPairs(collections).map((pair) => (
                <View key={pair[0].id} className="flex-row gap-4">
                  {pair.map((c) => (
                    <CollectionTile
                      key={c.id}
                      width={collectionTileW}
                      name={c.name}
                      recipeCount={c.recipeCount}
                      covers={profileCollectionCovers[c.id]}
                      onPress={() =>
                        router.push({
                          pathname: "/account/collection/[collectionId]",
                          params: {
                            collectionId: c.id,
                            ownerUid: uid,
                            fromProfile: "1",
                          },
                        })
                      }
                      showMenuButton={!viewingOwnProfile}
                      onMenuPress={() => setCollectionMenuId(c.id)}
                    />
                  ))}
                  {pair.length === 1 ? <View style={{ width: collectionTileW }} /> : null}
                </View>
              ))}
            </View>
          )
        ) : !sectionVisibility.mealPlans ? (
          hiddenMessage("Meal plans")
        ) : !mealPlans || mealPlans.length === 0 ? (
          <Text className="text-center text-muted-foreground py-10">No meal plans yet.</Text>
        ) : (
          <View className="gap-4">
            {mealPlans.map((p) => (
              <SwipeableMealPlanCard
                key={p.id}
                id={p.id}
                startDateLabel={formatPlanDate(p.start_date)}
                endDateLabel={formatPlanDate(p.end_date)}
                breakfastId={p.breakfast}
                lunchId={p.lunch}
                dinnerId={p.dinner}
                readOnly={!viewingOwnProfile}
                onRecipePress={openRecipe}
                onMealPlanDeleted={() => {
                  void load();
                  void refetchMealPlans();
                }}
                linkHighlightPlanId={highlightedPlanIdFromLink}
                bulkExpandSignal={mealPlanBulkSignal}
                shareTargets={
                  uid ? { profileUserId: uid, mealPlanId: p.id } : undefined
                }
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const showRemotePhoto =
    typeof profilePhotoUrl === "string" &&
    profilePhotoUrl.length > 0 &&
    !photoLoadError;

  return (
    <View className="flex-1 bg-app-background">
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="red" />
        </View>
      ) : (
        <AccountWebColumn className="flex-1 min-h-0 w-full">
        <>
          <View className="relative w-full bg-muted-background" style={{ height: 256 }}>
            {showRemotePhoto ? (
              <Image
                source={{ uri: profilePhotoUrl! }}
                style={{ width: "100%", height: 256 }}
                resizeMode="cover"
                onError={() => setPhotoLoadError(true)}
                onLoad={() => setPhotoLoadError(false)}
              />
            ) : (
              <View
                className="w-full items-center justify-center bg-red-primary/12"
                style={{ height: 256 }}
              >
                <Text className="text-5xl font-bold text-red-primary">{initial}</Text>
                <Text className="text-muted-foreground text-sm mt-2">Creator</Text>
              </View>
            )}

            {!isWebDesktop ? (
              <TouchableOpacity
                onPress={() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                    return;
                  }
                  router.replace("/home");
                }}
                className="absolute left-4 w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
                style={{ top: insets.top + 8, zIndex: 2 }}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <IconSymbol name="chevron-left" size={24} color="--color-red-primary" />
              </TouchableOpacity>
            ) : null}

            <View
              className="absolute right-4 flex-row gap-2"
              style={{ top: insets.top + 8, zIndex: 2 }}
            >
              {viewingOwnProfile ? (
                <TouchableOpacity
                  onPress={() => {
                    setDraftPrivacy(profilePrivacy);
                    setEditOpen(true);
                  }}
                  className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile and photo"
                >
                  <IconSymbol name="pencil-outline" size={22} color="--color-red-primary" />
                </TouchableOpacity>
              ) : null}
              {uid ? (
                <TouchableOpacity
                  onPress={() => void shareProfilePlansLink()}
                  className="w-10 h-10 bg-background rounded-full shadow items-center justify-center opacity-90"
                  accessibilityRole="button"
                  accessibilityLabel="Share profile"
                >
                  <IconSymbol name="share-variant-outline" size={22} color="--color-red-primary" />
                </TouchableOpacity>
              ) : null}
            </View>

            {uploadingPhoto ? (
              <View
                className="absolute inset-0 bg-black/35 items-center justify-center"
                style={{ zIndex: 3 }}
              >
                <ActivityIndicator color="#ffffff" size="large" />
              </View>
            ) : null}
          </View>

          <View className="flex-1" style={{ paddingBottom: insets.bottom }}>
            {activeTab === "recipes" || activeTab === "favorites" ? recipeList : boardsOrPlansScroll}
          </View>
        </>
        </AccountWebColumn>
      )}

      <Modal
        visible={editOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditOpen(false)}
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
            onPress={() => setEditOpen(false)}
          >
            <Pressable
              style={{
                maxHeight: profileEditSheetMaxHeight,
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
              <View className="p-5 gap-5">
                <Text className="text-xl font-bold text-foreground">Profile & privacy</Text>
                <Text className="text-muted-foreground text-sm">
                  Choose what others see on your public profile. You always see everything here.
                </Text>

                <TouchableOpacity
                  className="py-3 rounded-xl items-center flex-row justify-center gap-2"
                  style={{ backgroundColor: theme["--color-red-primary"] }}
                  onPress={() => void pickAndUploadPhoto()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="font-semibold" style={{ color: "#ffffff" }}>
                      Change profile photo
                    </Text>
                  )}
                </TouchableOpacity>

                <Text className="text-foreground font-semibold">Visible to others</Text>

                <View className="gap-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-foreground flex-1">Favorites tab</Text>
                    <Switch
                      value={draftPrivacy.showFavorites}
                      onValueChange={(v) => setDraftPrivacy((d) => ({ ...d, showFavorites: v }))}
                    />
                  </View>
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-foreground flex-1">Collections tab</Text>
                    <Switch
                      value={draftPrivacy.showCollections}
                      onValueChange={(v) => setDraftPrivacy((d) => ({ ...d, showCollections: v }))}
                    />
                  </View>
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-foreground flex-1">Meal plans tab</Text>
                    <Switch
                      value={draftPrivacy.showMealPlans}
                      onValueChange={(v) => setDraftPrivacy((d) => ({ ...d, showMealPlans: v }))}
                    />
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl bg-muted-background items-center"
                    onPress={() => setEditOpen(false)}
                  >
                    <Text className="font-medium text-foreground">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: theme["--color-red-primary"] }}
                    onPress={() => void savePrivacy()}
                    disabled={savingPrivacy}
                  >
                    {savingPrivacy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="font-semibold" style={{ color: "#ffffff" }}>
                        Save
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={collectionMenuId != null}
        animationType="slide"
        transparent
        onRequestClose={() => setCollectionMenuId(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
            alignItems: isWebDesktop ? "center" : "stretch",
          }}
          onPress={() =>
            followBusyCollectionId == null && setCollectionMenuId(null)
          }
        >
          <Pressable
            style={{
              width: "100%",
              maxWidth: isWebDesktop ? 560 : undefined,
              backgroundColor: theme["--color-background"],
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: isWebDesktop ? 24 : 0,
              borderBottomRightRadius: isWebDesktop ? 24 : 0,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 32,
              gap: 4,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-lg font-bold text-foreground mb-2" numberOfLines={2}>
              {collectionMenuRow?.name ?? "Collection"}
            </Text>
            {collectionMenuFollowing ? (
              <TouchableOpacity
                className="py-4"
                onPress={() =>
                  collectionMenuId && void toggleFollowCollection(collectionMenuId)
                }
                disabled={followBusyCollectionId != null}
              >
                {followBusyCollectionId === collectionMenuId ? (
                  <ActivityIndicator color="red" />
                ) : (
                  <Text className="text-red-primary text-base font-semibold">
                    Unfollow collection
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="py-4 border-b border-muted-background"
                onPress={() =>
                  collectionMenuId && void toggleFollowCollection(collectionMenuId)
                }
                disabled={followBusyCollectionId != null}
              >
                {followBusyCollectionId === collectionMenuId ? (
                  <ActivityIndicator color="red" />
                ) : (
                  <Text className="text-foreground text-base font-medium">Follow collection</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="py-3 mt-2 rounded-xl bg-muted-background items-center"
              onPress={() => setCollectionMenuId(null)}
              disabled={followBusyCollectionId != null}
            >
              <Text className="font-medium text-foreground">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
