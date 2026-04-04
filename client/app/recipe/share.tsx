import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

const SHARE_BASE_URL = "http://10.0.2.2:3000";

export default function ShareRecipePage() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const [copying, setCopying] = useState(false);

  const id = useMemo(() => {
    const raw = Array.isArray(recipeId) ? recipeId[0] : recipeId;
    return raw ?? "";
  }, [recipeId]);

  const shareLink = useMemo(() => {
    if (!id) return "";
    return `${SHARE_BASE_URL}/recipe/${id}`;
  }, [id]);

  const handleCopy = async () => {
    if (!shareLink) return;
    setCopying(true);
    try {
      await Clipboard.setStringAsync(shareLink);
      Alert.alert("Link copied", "Share link copied to your clipboard.");
    } catch (err) {
      console.error("Failed to copy share link:", err);
      Alert.alert("Copy failed", "Could not copy the link to clipboard.");
    } finally {
      setCopying(false);
    }
  };

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      >
        <View className="gap-3 mt-2">
          <Text className="text-2xl font-bold text-foreground">Share Recipe</Text>
          <Text className="text-muted-foreground">
            Copy the link below. Anyone who opens it will land on this recipe.
          </Text>

          <View className="bg-background rounded-xl p-4 border border-muted-background">
            <Text className="text-muted-foreground text-sm mb-2">Deep link</Text>
            <Text selectable className="text-foreground">
              {shareLink || "—"}
            </Text>
          </View>

          <View className="gap-3 mt-2">
            <Button
              onPress={handleCopy}
              disabled={!shareLink || copying}
              textClassName="font-medium text-lg"
              size="lg"
            >
              {copying ? "Copying..." : "Copy link"}
            </Button>

            <Button
              variant="outline"
              onPress={() => {
                if (!shareLink) return;
                void Linking.openURL(shareLink);
              }}
              disabled={!shareLink}
              textClassName="font-medium text-lg"
              size="lg"
            >
              Open in Savr
            </Button>
          </View>
        </View>
      </ScrollView>
    </ThemedSafeView>
  );
}
