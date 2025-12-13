import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useState } from "react";
import { AddReviewModal } from "@/components/add-review-pop-up";

export default function ReviewsPage() {
  const [isAddReviewOpen, setIsAddReviewOpen] = useState(false);

  const handleSubmitReview = (data: { rating: number; review: string }) => {
    console.log("New review submitted:", data);
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

          <Text className="text-gray-600 mt-2">Based on 0 reviews</Text>
        </View>

        {/* Reviews List */}
        <Text className="text-gray-600 mb-2 ml-1">Reviews</Text>

        <View className="bg-white rounded-xl shadow p-4 mb-4 flex-row gap-3">
          <View className="w-12 h-12 rounded-full bg-[#EB2D2D] items-center justify-center">
            <Text className="text-white font-bold text-lg">?</Text>
          </View>

          <View className="flex-1">
            <Text className="font-bold text-base">Anonymous</Text>

            <View className="flex-row mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <IconSymbol key={i} name="star" size={16} color="#FBCD4F" />
              ))}
            </View>

            <Text className="text-gray-600">Review text placeholder...</Text>
          </View>
        </View>

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
