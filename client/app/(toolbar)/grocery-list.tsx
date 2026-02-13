import { StyleSheet, Text, View, Pressable, Button } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { ThemedSafeView } from "@/components/themed-safe-view";
import * as Location from "expo-location";


async function isLocationEnabled() {
  const value = await AsyncStorage.getItem("LOCATION_ENABLED");
  return value === "true";
}

/*If your emulator still does not output zip try opening google maps app.
For some reason that seems to solve whatever bug causing denied location access :/
*/
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
    const {latitude, longitude} = location.coords;
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude});
    const zipcode = address?.postalCode?? ''; //if no zip returns empty string
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);
    console.log("zipcode:", zipcode)
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
