import { useNetwork } from "@/contexts/network-context";
import { getPendingMutationCount } from "@/utils/mutation-queue";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { IconSymbol, MaterialIconName } from "./ui/icon-symbol";

// Height of the banner in pixels. Keep tall enough for one line of text at the xs size.
const BANNER_HEIGHT = 40;

// Background colours for each banner state.
const COLOR_SYNCING = "#2563EB"; // blue-600
const COLOR_PENDING = "#F97316"; // orange-500
const COLOR_OFFLINE = "#EB4034"; // yellow-600

export function OfflineBanner() {
  const { isOnline, isSyncing } = useNetwork();
  const [hasPendingMutations, setHasPendingMutations] = useState(false);

  // Poll the mutation queue so the banner shows an accurate unsynced-changes message.
  // Polling only runs when the device is offline or actively syncing.
  useEffect(() => {
    if (isOnline && !isSyncing) {
      setHasPendingMutations(false);
      return;
    }

    const check = async () => {
      const count = await getPendingMutationCount();
      setHasPendingMutations(count > 0);
    };

    check();
    const interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [isOnline, isSyncing]);

  // The banner is visible when offline or while a sync is in progress.
  const visible = !isOnline || isSyncing;
  const heightValue = useSharedValue(visible ? BANNER_HEIGHT : 0);

  useEffect(() => {
    heightValue.value = withTiming(visible ? BANNER_HEIGHT : 0, { duration: 200 });
  }, [visible, heightValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: heightValue.value,
    overflow: "hidden",
  }));

  let message: string;
  let bgColor: string;
  let icon: string;

  if (isSyncing) {
    message = "Syncing your changes...";
    bgColor = COLOR_SYNCING;
    icon = "cloud-sync-outline";
  } else if (hasPendingMutations) {
    message = "You are offline. Unsynced changes will sync when you reconnect.";
    bgColor = COLOR_PENDING;
    icon = "cloud-off-outline";
  } else {
    message = "You are offline. Some features are unavailable.";
    bgColor = COLOR_OFFLINE;
    icon = "alert-outline";
  }

  return (
    <Animated.View style={[animatedStyle, { backgroundColor: bgColor, position: "fixed", top: 60, left: 0, right: 0, zIndex: 50 }]}>
      <View className="flex-1 flex-row items-center justify-center gap-2 px-3">
        <IconSymbol name={icon as MaterialIconName} size={20} color="white" />
        <Text className="text-white text-xs font-semibold tracking-wide text-center flex-shrink">
          {message}
        </Text>
        {isSyncing && <ActivityIndicator size="small" color="white" />}
      </View>
    </Animated.View>
  );
}
