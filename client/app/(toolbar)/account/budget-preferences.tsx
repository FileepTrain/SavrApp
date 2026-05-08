import { View, Text, ActivityIndicator } from 'react-native'
import React, { useState, useEffect } from 'react'
import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from '@/components/themed-safe-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '@/components/ui/button';
import { BudgetPreferencesSection } from '@/components/preferences';

const BUDGET_STORAGE_KEY = "USER_BUDGET";
import { SERVER_URL } from "@/utils/server-url";

const BudgetPreferencesPage = () => {
  const [budget, setBudget] = useState(100);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

        const res = await fetch(
          `${SERVER_URL}/api/auth/get-preferences?fields=budget`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          }
        );
        const data = await res.json();

        if (!res.ok) console.warn("Failed to get budget", data);
        if (typeof data.budget === "number" && !Number.isNaN(data.budget)) {
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
      const res = await fetch(`${SERVER_URL}/api/auth/update-preferences`, {
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
      <AccountWebColumn className="flex-1">
        <AccountSubpageBody>
      <View className="pt-4 pb-2 gap-2">
        <BudgetPreferencesSection value={budget} onChange={setBudget} />
        {/* Save button */}
        <Button
          className="mt-4"
          size="lg"
          onPress={() => handleBudgetSave(budget)}
          textClassName="text-[16px] font-medium tracking-[0.5px]"
          disabled={updating || loading}
        >
          {updating ? <ActivityIndicator size="small" color="black" /> : "Save Changes"}
        </Button>
      </View>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  )
}

export default BudgetPreferencesPage