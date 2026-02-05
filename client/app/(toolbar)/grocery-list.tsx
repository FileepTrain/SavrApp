import { StyleSheet, Text, View, Pressable, Button } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import * as Location from "expo-location";


async function isLocationEnabled() {
  const value = await AsyncStorage.getItem("LOCATION_ENABLED");
  return value === "true";
}

async function getLocation() {
  const allowed = await isLocationEnabled();
  if(!allowed) {
    console.log("Location disabled by user");
    return;
  }

  try{
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log("Permission denied");
      return;
    }

    const location = await Location.getCurrentPositionAsync();
    console.log("Latitude:", location.coords.latitude);
    console.log("Longitude:", location.coords.longitude);
  } catch (error) {
    console.log("Error getting location:", error);
  }
}

export default function GroceryListPage() {
  return (
    <ThemedSafeView>
      <Text className="text-foreground text-2xl font-semibold">
        Grocery List
      </Text>

      <View className="flex-row items-center">
        <Button title="location" onPress={getLocation}/>
      </View>
    </ThemedSafeView>
  );
}
