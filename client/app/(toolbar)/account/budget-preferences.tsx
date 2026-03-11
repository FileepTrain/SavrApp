import { View, Text, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { ThemedSafeView } from '@/components/themed-safe-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useThemePalette } from '@/components/theme-provider';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';

const BUDGET_STORAGE_KEY = "USER_BUDGET";
const SERVER_URL = "http://10.0.2.2:3000";

const BudgetPreferencesPage = () => {
  const [budget, setBudget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const theme = useThemePalette();

  useEffect(() => {
    const loadBudget = async () => {
      try {
        setLoading(true);
        // Try to get budget from local storage first
        const storedBudget = await AsyncStorage.getItem(
          BUDGET_STORAGE_KEY
        )
        if (storedBudget) {
          setBudget(JSON.parse(storedBudget));
          return;
        }

        // If no local storage, get budget from server
        const idToken = await AsyncStorage.getItem("idToken");
        if (!idToken) return;

        const res = await fetch(`${SERVER_URL}/api/auth/get-budget`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });
        const data = await res.json();

        if (!res.ok) console.warn("Failed to get budget", data);
        if (data.budget) {
          setBudget(data.budget);
        }
      } catch (e) {
        console.warn("Error getting budget", e);
      } finally {
        setLoading(false);
      }
    };

    loadBudget();
  }, []);

  const handleInputChange = (value: string) => {
    const numericValue = Number(value.replace("$", ""));
    if (numericValue < 0 || !numericValue) setBudget(0);
    else if (numericValue > 100) setBudget(100);
    else setBudget(numericValue)
  }

  const handleBudgetSave = async (budget: number) => {
    try {
      setUpdating(true);
      // Save budget to local storage
      await AsyncStorage.setItem(
        BUDGET_STORAGE_KEY,
        JSON.stringify(budget)
      );
    } catch (error) {
      console.error("Error saving budget to local storage:", error);
    } finally {
      setUpdating(false);
    }

    // Update budget on server
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/auth/update-budget`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ budget }),
      });
      const data = await res.json();
      if (!res.ok) console.warn("Failed to save budget", data);
    } catch (e) {
      console.warn("Error saving budget", e);
    }
  }
  return (
    <ThemedSafeView className="flex-1 bg-app-background pt-safe-or-20">
      <View className="px-4 pt-4 pb-2 gap-2">
        <Text className="text-base text-foreground">Your budget preferences are considered when searching for recipes and meal plans.</Text>
        <Slider
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={budget}
          onValueChange={(value) => setBudget(value)}
          minimumTrackTintColor={theme["--color-foreground"]}
          thumbTintColor={theme["--color-foreground"]}
          StepMarker={({ index, min, max }) =>
            <View className="mt-4 ">
              {(index === min ? <Text className="font-medium text-muted-foreground">$0</Text> : index === max ? <Text className="font-medium text-muted-foreground">$100</Text> : null)}
            </View>}
        />
        {/* Change budget with keyboard input instead of slider */}
        <Input
          inputType="numeric"
          inputClassName="text-xl self-center font-medium"
          value={`$${budget.toString()}`}
          onChangeText={(value) => handleInputChange(value)}
          placeholder="$0"
        />
        {/* Save button */}
        <Button
          className="mt-4"
          size="lg"
          onPress={() => handleBudgetSave(budget)}
          textClassName="font-medium text-lg"
          disabled={updating || loading}
        >
          {updating ? <ActivityIndicator size="small" color="black" /> : "Save Changes"}
        </Button>
      </View>
    </ThemedSafeView>
  )
}

export default BudgetPreferencesPage