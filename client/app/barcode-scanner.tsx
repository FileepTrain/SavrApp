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
import { SERVER_URL } from "@/utils/server-url";
import { getFirebaseAuth } from "@/firebase/firebase";

async function getFreshIdToken() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (user) {
    const freshToken = await user.getIdToken(true);
    await AsyncStorage.setItem("idToken", freshToken);
    return freshToken;
  }

  const storedToken = await AsyncStorage.getItem("idToken");

  if (!storedToken) {
    throw new Error("You must be logged in.");
  }

  return storedToken;
}

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
      const idToken = await getFreshIdToken();

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
          scannedExpirationDate: result?.expirationDate ?? "",
        },
      });
    } catch (err: any) {
      console.error(err);

      Alert.alert("Scan failed", err.message || "Please try again.", [
        {
          text: "Try Again",
          onPress: () => {
            scanLockRef.current = false;
            setScanned(false);
            setLoadingLookup(false);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            router.back();
          },
        },
      ]);
    } finally {
      setLoadingLookup(false);
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-app-background">
        <Text className="text-foreground">Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-app-background px-6">
        <Text className="text-foreground text-xl font-semibold mb-2">
          Camera Permission Needed
        </Text>

        <Text className="text-muted-foreground text-center mb-6">
          Savr needs camera access to scan grocery barcodes.
        </Text>

        <Pressable
          onPress={requestPermission}
          className="bg-red-500 px-6 py-4 rounded-xl"
        >
          <Text className="text-white font-bold">Grant Camera Access</Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-6 py-3"
        >
          <Text className="text-muted-foreground font-medium">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      <View className="absolute top-14 left-4 right-4 flex-row justify-between items-center">
        <Pressable
          onPress={() => router.back()}
          className="bg-black/60 px-4 py-3 rounded-xl"
        >
          <Text className="text-white font-bold">Back</Text>
        </Pressable>

        <View className="bg-black/60 px-4 py-3 rounded-xl">
          <Text className="text-white font-medium">Scan Barcode</Text>
        </View>
      </View>

      {loadingLookup && (
        <View className="absolute inset-0 items-center justify-center bg-black/50">
          <ActivityIndicator size="large" color="white" />
          <Text className="text-white mt-3">Looking up product...</Text>
        </View>
      )}

      {scanned && !loadingLookup && (
        <View className="absolute bottom-10 left-0 right-0 items-center">
          <Pressable
            onPress={() => {
              scanLockRef.current = false;
              setScanned(false);
            }}
            className="bg-red-500 px-6 py-4 rounded-xl"
          >
            <Text className="text-white font-bold">Scan Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}