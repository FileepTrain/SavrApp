import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Pressable,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface AddReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; review: string }) => void;
}

export function AddReviewModal({ visible, onClose, onSubmit }: AddReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const handleStarPress = (value: number) => {
    setRating(value);
  };

  const handleSubmit = () => {
    if (!rating || !review.trim()) {
      alert("Please provide a rating and a review.");
      return;
    }

    onSubmit({ rating, review });
    setRating(0);
    setReview("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* Dark Background Overlay */}
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/40 justify-center items-center"
      />

      {/* MODAL CARD */}
      <View className="absolute top-[92px] left-[16px] w-[361px] bg-white rounded-2xl shadow-2xl">

        {/* HEADER */}
        <View className="flex-row justify-between items-center px-6 h-[81px] border-b border-gray-200">
          <Text className="text-[20px] font-bold text-[#EB2D2D]">Write a Review</Text>

          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 items-center justify-center"
          >
            <IconSymbol name="close" size={22} color="#4A5565" />
          </TouchableOpacity>
        </View>

        {/* CONTENT */}
        <View className="px-6 pt-6 pb-4">

          {/* Rating Section */}
          <Text className="text-[14px] font-medium mb-2">Your Rating</Text>

          <View className="flex-row gap-2 mb-6">
            {Array.from({ length: 5 }).map((_, i) => {
              const index = i + 1;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleStarPress(index)}
                >
                  <IconSymbol
                    name={index <= rating ? "star" : "star-border"}
                    size={40}
                    color={index <= rating ? "#FBCD4F" : "#D1D5DC"}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Review Input */}
          <Text className="text-[14px] font-medium mb-2">Your Review</Text>

          <TextInput
            multiline
            placeholder="Share your experience with this recipe..."
            className="border border-gray-300 rounded-xl p-4 h-[128px] text-[14px]"
            value={review}
            onChangeText={setReview}
          />

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            className="bg-[#EB2D2D] rounded-xl h-[48px] items-center justify-center mt-6 shadow"
          >
            <Text className="text-white text-[16px] font-medium">
              Submit Review
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
