import { NativeModules, StyleSheet, Text, View, Pressable, Button } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";

const {LocationModule} = NativeModules;

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
    const location = await LocationModule.getCurrentLocation();
    console.log("Latitude:", location.latitude);
    console.log("Longitude:", location.longitude);
  } catch (eror) {
    console.log("Error getting location:", eror);
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
