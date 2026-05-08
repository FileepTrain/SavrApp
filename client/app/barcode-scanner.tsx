import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { SERVER_URL } from "@/constants/api";

export default function BarcodeScannerPage() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);

  const scanLockRef = useRef(false);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanLockRef.current || scanned || loadingLookup) return;

    scanLockRef.current = true;
    setScanned(true);
    setLoadingLookup(true);

    try {
      const idToken = await AsyncStorage.getItem("idToken");

      if (!idToken) {
        throw new Error("You must be logged in.");
      }

      const res = await fetch(
        `${SERVER_URL}/api/pantry/barcode/${encodeURIComponent(data)}`,
        {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      const result = await res.json();

      console.log("BARCODE PRODUCT RESPONSE:", result);

      if (!res.ok) {
        throw new Error(result?.error || "Lookup failed");
      }

      const productName =
        result?.itemName ||
        result?.name ||
        result?.title ||
        result?.productName ||
        "";

      router.replace({
        pathname: "/(toolbar)/account/pantry",
        params: {
          scannedName: productName,
          scannedQuantity: String(result?.suggestedQuantity ?? 1),
          scannedUnit: result?.suggestedUnit ?? "each",
        },
      });
    } catch (err: any) {
      console.error(err);

      Alert.alert("Scan failed", err.message, [
        {
          text: "Try Again",
          onPress: () => {
            scanLockRef.current = false;
            setScanned(false);
            setLoadingLookup(false);
          },
        },
      ]);
    } finally {
      setLoadingLookup(false);
    }
  };

  if (!permission) return <View className="flex-1 bg-black" />;

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Camera permission needed</Text>
        <Pressable onPress={requestPermission}>
          <Text>Grant</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
      />

      {loadingLookup && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" color="white" />
          <Text className="text-white">Looking up product...</Text>
        </View>
      )}
    </View>
  );
}