import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState, useEffect, useMemo } from "react";
import { AddReviewModal } from "@/components/add-review-pop-up";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams } from "expo-router";

const SERVER_URL = "http://10.0.2.2:3000";

export default function ReviewsPage() {
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
    <ThemedSafeView className="flex-1 bg-[#F5E7E8]">

      {/* MAIN CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
      >

        {/* Rating Summary */}
        <View className="bg-white rounded-xl shadow p-6 items-center mb-6">
          <Text className="text-5xl font-bold">—</Text>

          <View className="flex-row mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <IconSymbol key={i} name="star" size={24} color="#FBCD4F" />
            ))}
          </View>

          <Text className="text-gray-600 mt-2">Based on {reviews.length} reviews</Text>
        </View>

        {/* Reviews List */}
        <Text className="text-gray-600 mb-2 ml-1">Reviews</Text>
        
        {error ? (
          <View className="bg-red-100 border border-red-300 rounded-xl p-3 mb-3">
            <Text className="text-red-700">{error}</Text>
          </View>
        ) : null}

        {/* Review tiles */}
        {loadingReviews ? (
          <Text className="text-gray-600">Loading reviews...</Text>
        ) : reviews.length === 0 ? (
          <Text className="text-gray-600">No reviews yet.</Text>
        ) : (  
          reviews.map((r) => (
            <View key={r.id} className="bg-white rounded-xl shadow p-4 mb-4 flex-row gap-3">
              <View className="w-12 h-12 rounded-full bg-[#EB2D2D] items-center justify-center">
                <Text className="text-white font-bold text-lg">
                  {(r.authorDisplayName?.[0] ?? "?").toUpperCase()}
                </Text>      
              </View>      
              
              <View className="flex-1">        
                <Text className="font-bold text-base">
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
              
                <Text className="text-gray-600">{r.review}</Text>
              </View>
            </View>
          ))
        )}

        <View className="h-24" />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        onPress={() => setIsAddReviewOpen(true)}
        className="absolute bottom-8 right-6 w-14 h-14 rounded-full bg-[#EB2D2D] shadow-xl items-center justify-center"
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
