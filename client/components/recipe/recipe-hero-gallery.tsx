import { IconSymbol } from "@/components/ui/icon-symbol";
import { prepareProfilePhotoForUpload } from "@/utils/prepare-profile-photo-upload";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type RecipeGalleryListItem = {
  url: string;
  uploadedBy: string | null;
  isMain: boolean;
};

type RecipeHeroGalleryProps = {
  items: RecipeGalleryListItem[];
  recipeId: string;
  canUpload: boolean;
  serverUrl: string;
  currentUserId: string | null;
  recipeOwnerId: string | null;
  onAppendGalleryEntry: (entry: { url: string; uploadedBy: string }) => void;
  onRemoveImageUrl: (url: string) => void;
};

//I want only the uploader and owner of the recipe to delete the image
//since external recipes have no owner we have to remove manually for now
function canDeleteGalleryItem(
  item: RecipeGalleryListItem,
  currentUserId: string | null,
  recipeOwnerId: string | null,
): boolean {
  if (!currentUserId) return false;
  if (item.isMain) {
    return recipeOwnerId !== null && recipeOwnerId === currentUserId;
  }
  if (recipeOwnerId !== null && recipeOwnerId === currentUserId) return true;
  if (item.uploadedBy != null && item.uploadedBy !== "" && item.uploadedBy === currentUserId)
    return true;
  return false;
}

export function RecipeHeroGallery({
  items,
  recipeId,
  canUpload,
  serverUrl,
  currentUserId,
  recipeOwnerId,
  onAppendGalleryEntry,
  onRemoveImageUrl,
}: RecipeHeroGalleryProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroHeight = 240;

  const [heroIndex, setHeroIndex] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const modalListRef = useRef<FlatList<RecipeGalleryListItem>>(null);

  const urisKey = items.map((i) => i.url).join("|");

  const openModalAt = useCallback(
    (index: number) => {
      if (items.length === 0) return;
      const i = Math.max(0, Math.min(index, items.length - 1));
      setModalIndex(i);
      setModalVisible(true);
      requestAnimationFrame(() => {
        modalListRef.current?.scrollToIndex({ index: i, animated: false });
      });
    },
    [items.length],
  );

  const onHeroScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const next = Math.round(x / windowWidth);
      if (next >= 0 && next < items.length) setHeroIndex(next);
    },
    [items.length, windowWidth],
  );

  useEffect(() => {
    setHeroIndex((i) => (items.length === 0 ? 0 : Math.min(i, items.length - 1)));
  }, [items.length, urisKey]);

  useEffect(() => {
    if (modalVisible && items.length === 0) {
      setModalVisible(false);
    }
  }, [items.length, modalVisible]);

  useEffect(() => {
    if (modalVisible && modalIndex >= items.length) {
      setModalIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, modalIndex, modalVisible]);

  const pickAndUploadGalleryImage = useCallback(async () => {
    if (!recipeId) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "Allow photo library access to add images to this recipe.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.9,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (!idToken) {
        Alert.alert("Sign in required", "Log in to add photos.");
        return;
      }

      const prepared = await prepareProfilePhotoForUpload(result.assets[0]);
      const formData = new FormData();
      formData.append("image", {
        uri: prepared.uri,
        name: prepared.name,
        type: prepared.type,
      } as unknown as Blob);

      const res = await fetch(`${serverUrl}/api/recipes/${recipeId}/gallery-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to upload image",
        );
      }
      const entry = data.entry as { url?: string; uploadedBy?: string } | undefined;
      if (entry?.url) {
        onAppendGalleryEntry({
          url: entry.url,
          uploadedBy: typeof entry.uploadedBy === "string" ? entry.uploadedBy : "",
        });
      } else {
        throw new Error("No image data returned");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
    }
  }, [onAppendGalleryEntry, recipeId, serverUrl]);

  const confirmDeleteCurrent = useCallback(async () => {
    const item = items[modalIndex];
    if (!item || !canDeleteGalleryItem(item, currentUserId, recipeOwnerId)) return;

    const label = item.isMain ? "Remove the main recipe image?" : "Remove this photo from the gallery?";
    Alert.alert("Remove image", label, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              const idToken = await AsyncStorage.getItem("idToken");
              if (!idToken) {
                Alert.alert("Sign in required", "Log in to remove photos.");
                return;
              }
              const res = await fetch(`${serverUrl}/api/recipes/${recipeId}/gallery-image`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${idToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ url: item.url }),
              });
              const data = await res.json();
              if (!res.ok) {
                throw new Error(
                  typeof data?.error === "string" ? data.error : "Failed to remove image",
                );
              }
              onRemoveImageUrl(item.url);
            } catch (e) {
              const message = e instanceof Error ? e.message : "Remove failed";
              Alert.alert("Could not remove", message);
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  }, [currentUserId, modalIndex, items, onRemoveImageUrl, recipeId, recipeOwnerId, serverUrl]);

  const currentModalItem = items[modalIndex];
  const showDeleteInModal =
    currentModalItem && canDeleteGalleryItem(currentModalItem, currentUserId, recipeOwnerId);

  const renderHeroItem = useCallback(
    ({ item, index }: { item: RecipeGalleryListItem; index: number }) => (
      <Pressable
        onPress={() => openModalAt(index)}
        style={{ width: windowWidth, height: heroHeight }}
        className="bg-muted-background"
      >
        <Image source={{ uri: item.url }} className="w-full h-full" resizeMode="cover" />
      </Pressable>
    ),
    [heroHeight, openModalAt, windowWidth],
  );

  const renderModalItem = useCallback(
    ({ item }: { item: RecipeGalleryListItem }) => (
      <View style={{ width: windowWidth, height: windowHeight }} className="bg-black items-center justify-center">
        <Image
          source={{ uri: item.url }}
          style={{ width: windowWidth, height: windowHeight }}
          resizeMode="contain"
        />
      </View>
    ),
    [windowHeight, windowWidth],
  );

  const showDots = items.length > 1;
  const showHeroActions = canUpload;

  return (
    <View>
      <View className="relative w-full bg-muted-background" style={{ height: heroHeight }}>
        {items.length > 0 ? (
          <FlatList
            data={items}
            keyExtractor={(it, i) => `${it.url}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            renderItem={renderHeroItem}
            onMomentumScrollEnd={onHeroScrollEnd}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
          />
        ) : (
          <View className="w-full h-full items-center justify-center gap-2 mt-12">
            <IconSymbol name="image-outline" size={36} color="--color-icon" />
            <Text className="text-icon text-lg font-medium">No image available</Text>
          </View>
        )}

        {showDots ? (
          <View
            className={`absolute left-0 right-0 flex-row justify-center gap-1.5 ${showHeroActions ? "bottom-14" : "bottom-3"}`}
          >
            {items.map((_, i) => (
              <View
                key={`dot-${i}`}
                className="h-1.5 rounded-full"
                style={{
                  width: i === heroIndex ? 16 : 6,
                  backgroundColor: i === heroIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </View>
        ) : null}

        {canUpload ? (
          <TouchableOpacity
            onPress={() => void pickAndUploadGalleryImage()}
            disabled={uploading}
            className="absolute right-3 bottom-3 flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-background/90 shadow"
            style={{ opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#c00" />
            ) : (
              <IconSymbol name="camera-outline" size={20} color="--color-red-primary" />
            )}
            <Text className="text-red-primary text-sm font-semibold">Add photo</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setModalVisible(false)}
      >
        <View className="flex-1 bg-black">
          <FlatList
            ref={modalListRef}
            data={items}
            keyExtractor={(it, i) => `modal-${it.url}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={items.length > 0 ? Math.min(modalIndex, items.length - 1) : 0}
            renderItem={renderModalItem}
            getItemLayout={(_, index) => ({
              length: windowWidth,
              offset: windowWidth * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => modalListRef.current?.scrollToIndex({ index, animated: false }), 100);
            }}
            onMomentumScrollEnd={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setModalIndex(Math.round(x / windowWidth));
            }}
          />

          <View
            className="absolute flex-row items-center justify-between left-0 right-0 z-10"
            style={{ top: insets.top + 8, paddingHorizontal: 12 }}
          >
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              className="w-10 h-10 rounded-full bg-white/15 items-center justify-center"
            >
              <IconSymbol name="close" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              {showDeleteInModal ? (
                <TouchableOpacity
                  onPress={() => void confirmDeleteCurrent()}
                  disabled={deleting}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white/15"
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol name="trash-can-outline" size={20} color="#ff6b6b" />
                  )}
                  <Text className="text-[#ff6b6b] text-sm font-semibold">Delete</Text>
                </TouchableOpacity>
              ) : null}
              {canUpload ? (
                <TouchableOpacity
                  onPress={() => void pickAndUploadGalleryImage()}
                  disabled={uploading}
                  className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white/15"
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol name="camera-outline" size={20} color="#ffffff" />
                  )}
                  <Text className="text-white text-sm font-semibold">Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {items.length > 1 ? (
            <View
              className="absolute left-0 right-0 flex-row justify-center gap-1.5"
              style={{ bottom: insets.bottom + 16 }}
            >
              {items.map((_, i) => (
                <View
                  key={`mdot-${i}`}
                  className="h-1.5 rounded-full"
                  style={{
                    width: i === modalIndex ? 16 : 6,
                    backgroundColor: i === modalIndex ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
