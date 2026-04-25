import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useEffect, useMemo } from "react";
import { AddReviewModal } from "@/components/add-review-pop-up";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";

import { useRecipeWebColumnWidth } from "@/hooks/use-recipe-web-column-width";
import { SERVER_URL } from "@/utils/server-url";

export default function ReviewsPage() {
  const recipeColumnWidth = useRecipeWebColumnWidth();
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const id = useMemo( //useMemo is a react hook to cache reults (kinda like useCallback)
    () => (Array.isArray(recipeId) ? recipeId[0] : recipeId) ?? "",
    [recipeId]
  );

  const [isAddReviewOpen, setIsAddReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type Review = {
    id: string;
    authorDisplayName: string | null;
    rating: number;
    review: string;
    createdAt?: string;
  };

  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const loadReviews = async () => {
    if (!id) return;

    const token = await AsyncStorage.getItem("idToken");
    if (!token) return;

    setLoadingReviews(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/reviews?recipeId=${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load reviews");

      setReviews(Array.isArray(json.reviews) ? json.reviews : []);
      setAverageRating(typeof json.averageRating === "number" ? json.averageRating : 0);
      setReviewCount(typeof json.reviewCount === "number" ? json.reviewCount : json.reviews?.length ?? 0);
    } catch (e) {
      setError("Failed to load reviews");
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [id]);

  const handleSubmitReview = async (data: { rating: number; review: string }) => {
    console.log("New review submitted:", data);
    if (!id) {
      setError("Recipe not found.");
      return;
    }
    const token = await AsyncStorage.getItem("idToken");
    if (!token) {
      setError("Please sign in to submit a review.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipeId: id,
          rating: data.rating,
          review: data.review.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error || json.message || "Failed to submit review");
        return;
      }

      setIsAddReviewOpen(false);
      loadReviews();
    } catch (e) {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">

      {/* MAIN CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          recipeColumnWidth != null
            ? {
                alignItems: "center",
                paddingHorizontal: 24,
                paddingTop: 16,
                paddingBottom: 16,
              }
            : { padding: 16 }
        }
      >
        <View
          className="w-full"
          style={
            recipeColumnWidth != null
              ? { maxWidth: recipeColumnWidth, width: "100%" as const }
              : undefined
          }
        >
        {/* Rating Summary */}
        <View className="bg-background rounded-xl shadow p-6 items-center mb-6">
          <Text className="text-5xl font-bold text-foreground">
            {reviewCount > 0 ? averageRating.toFixed(1) : "—"}
          </Text>

          <View className="flex-row mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <IconSymbol
                key={i}
                name={i + 1 <= Math.round(averageRating) ? "star" : "star-outline"}
                size={24}
                color={i + 1 <= Math.round(averageRating) ? "#FBCD4F" : "#D1D5DC"}
              />
            ))}
          </View>

          <Text className="text-muted-foreground mt-2">
            Based on {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
          </Text>
        </View>

        {/* Reviews List */}
        <Text className="text-muted-foreground mb-2 ml-1">Reviews</Text>

        {error ? (
          <View className="bg-red-secondary border border-red-secondary rounded-xl p-3 mb-3">
            <Text className="text-red-primary">{error}</Text>
          </View>
        ) : null}

        {/* Review tiles */}
        {loadingReviews ? (
          <Text className="text-muted-foreground">Loading reviews...</Text>
        ) : reviews.length === 0 ? (
          <Text className="text-muted-foreground">No reviews yet.</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} className="bg-background rounded-xl shadow p-4 mb-4 flex-row gap-3">
              <View className="w-12 h-12 rounded-full bg-red-primary items-center justify-center">
                <Text className="text-foreground font-bold text-lg">
                  {(r.authorDisplayName?.[0] ?? "?").toUpperCase()}
                </Text>
              </View>

              <View className="flex-1">
                <Text className="font-bold text-base text-foreground">
                  {r.authorDisplayName ?? "Anonymous"}
                </Text>

                <View className="flex-row mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconSymbol
                      key={i}
                      name={i + 1 <= r.rating ? "star" : "star-outline"}
                      size={16}
                      color={i + 1 <= r.rating ? "#FBCD4F" : "#D1D5DC"}
                    />
                  ))}
                </View>

                <Text className="text-muted-foreground">{r.review}</Text>
              </View>
            </View>
          ))
        )}

        <View className="h-24" />
        </View>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        onPress={() => setIsAddReviewOpen(true)}
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-red-primary shadow-xl items-center justify-center"
      >
        <Text className="text-white text-3xl font-bold">+</Text>
      </TouchableOpacity>

      {/* Review Modal */}
      <AddReviewModal
        visible={isAddReviewOpen}
        onClose={() => setIsAddReviewOpen(false)}
        onSubmit={handleSubmitReview}
      />
    </ThemedSafeView>
  );
}
