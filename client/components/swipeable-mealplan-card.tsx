import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { palettes } from "@/theme";
import { buildProfileShareWebUrl, openNativeShare } from "@/utils/profile-share";

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://10.0.2.2:3000";

/** Bump `generation` and set `expanded` so every card in the list applies the same open/closed state. */
export type MealPlanBulkExpandSignal = { generation: number; expanded: boolean };

export interface SwipeableMealPlanCardProps {
  id: string;
  startDateLabel: string;
  endDateLabel: string;
  breakfastId?: string | null;
  lunchId?: string | null;
  dinnerId?: string | null;
  readOnly?: boolean;
  onRecipePress?: (recipeId: string) => void;
  /** Called after a successful delete so lists can refetch (calendar + profile). */
  onMealPlanDeleted?: () => void;
  /** When false, card starts collapsed (ignored while {@link linkHighlightPlanId} is non-null). */
  initialExpanded?: boolean;
  /**
   * Profile deep link: when non-null, only the matching plan stays expanded; also re-syncs if the id
   * arrives after mount (useState(initialExpanded) alone would leave every card stuck expanded).
   */
  linkHighlightPlanId?: string | null;
  /** Parent-driven expand/collapse all; runs after link-highlight sync so toolbar actions win. */
  bulkExpandSignal?: MealPlanBulkExpandSignal | null;
  /** Opens Plans tab on this profile with this meal plan highlighted when the link is opened. */
  shareTargets?: { profileUserId: string; mealPlanId: string };
}

function parseRecipeIds(input?: string | null): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

type Palette = (typeof palettes)["brand"]["light"];

function useProfilePalette(): Palette {
  const scheme = useColorScheme();
  return scheme === "dark" ? palettes.brand.dark : palettes.brand.light;
}

/** No NativeWind className — avoids css-interop View→Pressable upgrades + stringify crash with Navigation context. */
function MealPlanRecipeRow({
  title,
  calories,
  rating,
  reviewsLength,
  imageUrl,
  onPress,
  colors,
}: {
  title: string;
  calories: number;
  rating: number;
  reviewsLength: number;
  imageUrl: string | null;
  onPress: () => void;
  colors: Palette;
}) {
  const imgSource = imageUrl
    ? { uri: imageUrl }
    : require("@/assets/images/SAVR-logo.png");

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <View
        style={[
          styles.recipeRow,
          { backgroundColor: colors["--color-background"] },
        ]}
      >
        <Image
          source={imgSource}
          style={styles.recipeImage}
          resizeMode={imageUrl ? "cover" : "contain"}
        />
        <View style={styles.recipeTextCol}>
          <Text
            style={[styles.recipeTitle, { color: colors["--color-red-primary"] }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Text style={[styles.recipeCal, { color: colors["--color-muted-foreground"] }]}>
            {calories} calories
          </Text>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={12} color="#fbcd4f" />
            <Text style={[styles.ratingText, { color: colors["--color-muted-foreground"] }]}>
              {rating} ({reviewsLength})
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function SwipeableMealPlanCard({
  id,
  startDateLabel,
  endDateLabel,
  breakfastId = null,
  lunchId = null,
  dinnerId = null,
  readOnly = false,
  onRecipePress,
  onMealPlanDeleted,
  initialExpanded = true,
  linkHighlightPlanId = undefined,
  bulkExpandSignal = null,
  shareTargets,
}: SwipeableMealPlanCardProps) {
  const colors = useProfilePalette();
  const matchesLinkHighlight =
    linkHighlightPlanId != null && String(linkHighlightPlanId) === String(id);
  const defaultExpanded =
    linkHighlightPlanId != null
      ? matchesLinkHighlight
      : (initialExpanded ?? true);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (linkHighlightPlanId == null) return;
    setExpanded(String(linkHighlightPlanId) === String(id));
  }, [linkHighlightPlanId, id]);

  useEffect(() => {
    if (bulkExpandSignal == null) return;
    setExpanded(bulkExpandSignal.expanded);
  }, [bulkExpandSignal]);

  const [loading, setLoading] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState<string | null>(null);
  const [recipesById, setRecipesById] = useState<Record<string, any>>({});

  const breakfastRecipeIds = useMemo(() => parseRecipeIds(breakfastId), [breakfastId]);
  const lunchRecipeIds = useMemo(() => parseRecipeIds(lunchId), [lunchId]);
  const dinnerRecipeIds = useMemo(() => parseRecipeIds(dinnerId), [dinnerId]);

  const slotIds = useMemo(() => {
    const all = [...breakfastRecipeIds, ...lunchRecipeIds, ...dinnerRecipeIds];
    return Array.from(new Set(all));
  }, [breakfastRecipeIds, lunchRecipeIds, dinnerRecipeIds]);

  useEffect(() => {
    let cancelled = false;

    const fetchOne = async (recipeId: string, idToken?: string | null) => {
      const isPersonal = !/^\d+$/.test(recipeId);
      const url = isPersonal
        ? `${SERVER_URL}/api/recipes/${recipeId}`
        : `${SERVER_URL}/api/external-recipes/${recipeId}/details`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await fetch(url, { method: "GET", headers });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to fetch recipe");
      return json?.recipe ?? json;
    };

    const run = async () => {
      if (slotIds.length === 0) {
        setRecipesById({});
        setRecipesError(null);
        setRecipesLoading(false);
        return;
      }

      setRecipesLoading(true);
      setRecipesError(null);
      try {
        const idToken = await AsyncStorage.getItem("idToken");
        const entries = await Promise.all(
          slotIds.map(async (rid) => {
            try {
              const data = await fetchOne(rid, idToken);
              return [rid, data] as const;
            } catch {
              return [rid, null] as const;
            }
          }),
        );

        if (cancelled) return;
        const next: Record<string, any> = {};
        for (const [rid, data] of entries) next[rid] = data;
        setRecipesById(next);
      } catch (e) {
        if (cancelled) return;
        setRecipesError(e instanceof Error ? e.message : "Failed to load recipes");
      } finally {
        if (!cancelled) setRecipesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [slotIds]);

  const shareMealPlanLink = useCallback(() => {
    if (!shareTargets) return;
    const url = buildProfileShareWebUrl(shareTargets.profileUserId, {
      tab: "plans",
      mealPlanId: shareTargets.mealPlanId,
    });
    void openNativeShare(url, "Share meal plan");
  }, [shareTargets]);

  const navigateToRecipe = useCallback(
    (recipeId: string) => {
      if (onRecipePress) {
        onRecipePress(recipeId);
        return;
      }
      router.push({ pathname: "/recipe/[recipeId]", params: { recipeId } });
    },
    [onRecipePress],
  );

  const runDeleteMealPlan = useCallback(
    async (closeSwipe: () => void) => {
      try {
        setLoading(true);
        const idToken = await AsyncStorage.getItem("idToken");
        if (!idToken) {
          Alert.alert("Sign in required", "Please sign in to delete meal plans.");
          return;
        }
        const res = await fetch(
          `${SERVER_URL}/api/meal-plans/${encodeURIComponent(id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${idToken}` },
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          Alert.alert(
            "Could not delete",
            typeof data?.error === "string" ? data.error : "Please try again.",
          );
          return;
        }
        closeSwipe();
        onMealPlanDeleted?.();
      } catch {
        Alert.alert("Could not delete", "Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [id, onMealPlanDeleted],
  );

  const requestDeleteMealPlan = useCallback(
    (closeSwipe: () => void) => {
      Alert.alert(
        "Delete meal plan?",
        "Are you sure you want to remove this meal plan? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void runDeleteMealPlan(closeSwipe);
            },
          },
        ],
      );
    },
    [runDeleteMealPlan],
  );

  type MealSlotDisplay = "Breakfast" | "Lunch" | "Dinner";
  const renderRecipeRows = (recipeIds: string[], meal: MealSlotDisplay) => {
    const titleFallback = `${meal} recipe`;
    return recipeIds.map((rid) => (
      <MealPlanRecipeRow
        key={`${meal.toLowerCase()}-${rid}`}
        title={recipesById[rid]?.title ?? titleFallback}
        calories={recipesById[rid]?.calories ?? 0}
        rating={recipesById[rid]?.rating ?? 0}
        reviewsLength={
          Array.isArray(recipesById[rid]?.reviews) ? recipesById[rid].reviews.length : 0
        }
        imageUrl={recipesById[rid]?.image ?? recipesById[rid]?.imageUrl ?? null}
        onPress={() => navigateToRecipe(rid)}
        colors={colors}
      />
    ));
  };

  const renderRightActions = useCallback(
    (
      _progress: unknown,
      _translation: unknown,
      swipeableMethods: { close: () => void },
    ) => (
      <View style={styles.swipeActionsRow}>
        <Pressable
          onPress={() => {
            swipeableMethods.close();
            router.push({
              pathname: "/calendar/meal-plan",
              params: { mealPlanId: String(id) },
            });
          }}
          style={[styles.swipeBtn, styles.swipeBtnEdit]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={28} color="#ffffff" />
          <Text style={styles.swipeBtnText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => requestDeleteMealPlan(swipeableMethods.close)}
          style={[styles.swipeBtn, styles.swipeBtnDelete]}
          disabled={loading}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={28} color="#ffffff" />
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.swipeBtnText}>Delete</Text>
          )}
        </Pressable>
      </View>
    ),
    [id, loading, requestDeleteMealPlan],
  );

  const headerInner = (
    <View
      style={[
        styles.headerBox,
        {
          backgroundColor: colors["--color-background"],
          borderBottomColor: colors["--color-muted-background"],
          borderBottomWidth: expanded ? 1 : 0,
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          borderBottomLeftRadius: expanded ? 0 : 12,
          borderBottomRightRadius: expanded ? 0 : 12,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          style={styles.headerTitlePressable}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Collapse meal plan" : "Expand meal plan"}
        >
          <Text style={[styles.headerTitle, { color: colors["--color-foreground"] }]}>
            {startDateLabel} – {endDateLabel}
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          {shareTargets ? (
            <Pressable
              onPress={() => void shareMealPlanLink()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Share meal plan link"
              style={styles.headerIconBtn}
            >
              <MaterialCommunityIcons
                name="share-variant"
                size={22}
                color={colors["--color-muted-foreground"]}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setExpanded((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Collapse meal plan" : "Expand meal plan"}
            style={styles.headerIconBtn}
          >
            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={22}
              color={colors["--color-muted-foreground"]}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const slotLabel = (label: string, dotColor: string) => (
    <View style={styles.slotLabelRow}>
      <View style={[styles.slotDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.slotLabelText, { color: colors["--color-foreground"] }]}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.root}>
      {readOnly ? (
        headerInner
      ) : (
        <ReanimatedSwipeable
          renderRightActions={renderRightActions}
          overshootRight={false}
          friction={2}
        >
          {headerInner}
        </ReanimatedSwipeable>
      )}

      {expanded ? (
        <View
          style={[
            styles.body,
            { backgroundColor: colors["--color-background"] },
          ]}
        >
          {recipesLoading ? (
            <ActivityIndicator size="small" color={colors["--color-red-primary"]} />
          ) : recipesError ? (
            <Text style={{ color: colors["--color-muted-foreground"] }}>{recipesError}</Text>
          ) : (
            <>
              {breakfastRecipeIds.length > 0 ? (
                <View style={styles.slotBlock}>
                  {slotLabel("Breakfast", "#f0bb29")}
                  {renderRecipeRows(breakfastRecipeIds, "Breakfast")}
                </View>
              ) : null}
              {lunchRecipeIds.length > 0 ? (
                <View style={styles.slotBlock}>
                  {slotLabel("Lunch", "#4fa34b")}
                  {renderRecipeRows(lunchRecipeIds, "Lunch")}
                </View>
              ) : null}
              {dinnerRecipeIds.length > 0 ? (
                <View style={styles.slotBlock}>
                  {slotLabel("Dinner", "#bd9b64")}
                  {renderRecipeRows(dinnerRecipeIds, "Dinner")}
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  headerBox: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitlePressable: { flex: 1, paddingRight: 8 },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIconBtn: { padding: 4 },
  body: {
    padding: 16,
    gap: 12,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  slotBlock: { gap: 8 },
  slotLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  slotDot: { width: 8, height: 8, borderRadius: 4 },
  slotLabelText: { fontWeight: "600" },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 96,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  recipeImage: {
    height: "100%",
    width: 128,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  recipeTextCol: { flex: 1, justifyContent: "center", paddingHorizontal: 12 },
  recipeTitle: { fontWeight: "500" },
  recipeCal: { fontSize: 14, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  ratingText: { fontSize: 14, fontWeight: "500" },
  swipeActionsRow: { flexDirection: "row", marginLeft: 8 },
  swipeBtn: {
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  swipeBtnEdit: {
    backgroundColor: "#f97316",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  swipeBtnDelete: {
    backgroundColor: "#eb2d2d",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  swipeBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "500" },
});
