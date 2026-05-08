import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Pressable,
} from "react-native";
import { useThemePalette } from "@/components/theme-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface AddReviewModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; review: string }) => void;
}

export function AddReviewModal({ visible, onClose, onSubmit }: AddReviewModalProps) {
  const theme = useThemePalette();
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
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent={true}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
        }}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            width: 361,
            maxWidth: "100%",
            backgroundColor: theme["--color-background"],
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
        {/* HEADER */}
        <View className="flex-row justify-between items-center px-6 h-[81px] border-b border-muted-background">
          <Text className="text-[20px] font-bold" style={{ color: theme["--color-red-primary"] }}>
            Write a Review
          </Text>

          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 items-center justify-center"
          >
            <IconSymbol name="close" size={22} color="--color-icon" />
          </TouchableOpacity>
        </View>

        {/* CONTENT */}
        <View className="px-6 pt-6 pb-4">

          {/* Rating Section */}
          <Text className="text-[14px] font-medium mb-2 text-foreground">Your Rating</Text>

          <View className="flex-row gap-2 mb-6">
            {Array.from({ length: 5 }).map((_, i) => {
              const index = i + 1;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleStarPress(index)}
                >
                  <IconSymbol
                    name={index <= rating ? "star" : "star-outline"}
                    size={40}
                    color={index <= rating ? "#FBCD4F" : "#D1D5DC"}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Review Input */}
          <Text className="text-sm font-medium mb-2 text-foreground">Your Review</Text>

          <TextInput
            multiline
            placeholder="Share your experience with this recipe..."
            className="border border-muted-background rounded-xl p-4 h-[128px] text-sm text-foreground"
            value={review}
            onChangeText={setReview}
          />

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            className="rounded-xl h-[48px] items-center justify-center mt-6 shadow"
            style={{ backgroundColor: theme["--color-red-primary"] }}
          >
            <Text className="text-base font-medium" style={{ color: "#ffffff" }}>
              Submit Review
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </Pressable>
    </Modal>
  );
}
