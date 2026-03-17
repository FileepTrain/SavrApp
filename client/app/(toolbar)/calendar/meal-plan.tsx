// app/(toolbar)/calendar/meal-plan.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import type { Recipe } from "@/contexts/meal-plan-selection-context";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { useMealPlans } from "@/contexts/meal-plans-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View, Modal, ScrollView } from "react-native";
import Button from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";

const SERVER_URL = "http://10.0.2.2:3000";

type MealSlot = "Breakfast" | "Lunch" | "Dinner";

export default function MealPlanPage() {
  const [start_date, setStartDate] = useState(new Date());
  const [end_date, setEndDate] = useState(new Date());

  const [showPicker, setShowPicker] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "end" | null>(null);

  const [visible, setVisible] = useState(false);
  const [pendingMealSlot, setPendingMealSlot] = useState<MealSlot | null>(null);
  const [breakfastRecipe, setBreakfastRecipe] = useState<Recipe[]>([]);
  const [lunchRecipe, setLunchRecipe] = useState<Recipe[]>([]);
  const [dinnerRecipe, setDinnerRecipe] = useState<Recipe[]>([]);
  const [saving, setSaving] = useState(false);

  const { pendingSelectedRecipe, setPendingSelectedRecipe } = useMealPlanSelection();
  const { refetch: refetchMealPlans } = useMealPlans();

  const handleSave = useCallback(async () => {
    const idToken = await AsyncStorage.getItem("idToken");
    if (!idToken) {
      Alert.alert("Not signed in", "Sign in to save your meal plan.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/meal-plans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          breakfast: breakfastRecipe.map(r => r.id),
          lunch: lunchRecipe?.map(r => r.id),
          dinner: dinnerRecipe?.map(r => r.id),
          start_date: start_date.toISOString(),
          end_date: end_date.toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save meal plan");
      }
      Alert.alert("Saved", "Your meal plan has been saved.");
      await refetchMealPlans();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save meal plan.");
    } finally {
      setSaving(false);
    }
  }, [start_date, end_date, breakfastRecipe, lunchRecipe, dinnerRecipe]);

  useFocusEffect(
    useCallback(() => {
      if (pendingSelectedRecipe && pendingMealSlot) {
        if (pendingMealSlot === "Breakfast") {
          setBreakfastRecipe(prev => [...prev, pendingSelectedRecipe]);
        } else if (pendingMealSlot === "Lunch") {
          setLunchRecipe(prev => [...prev, pendingSelectedRecipe]);
        } else if (pendingMealSlot === "Dinner") {
          setDinnerRecipe(prev => [...prev, pendingSelectedRecipe]);
        }
        setPendingSelectedRecipe(null);
        setPendingMealSlot(null);
      }
    }, [pendingSelectedRecipe, pendingMealSlot, setPendingSelectedRecipe])
  );

  const openAddRecipeModal = (slot: MealSlot) => {
    setPendingMealSlot(slot);
    setVisible(true);
  };

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);

    if (!selectedDate) return;
    if (activeField === "start") {
      if (selectedDate > end_date) {
        setEndDate(selectedDate);
      }
      setStartDate(selectedDate);
    } else if (activeField === "end") {
      setEndDate(selectedDate);
    }
  };

  const renderRecipeCard = (recipe: any) => {
    if (!recipe) return null;
    return (
      <View className="mb-3 gap-2">
        <RecipeCard
          id={recipe.id}
          variant="horizontal"
          title={recipe.title}
          calories={recipe.calories}
          rating={recipe.rating}
          reviewsLength={recipe.reviews?.length || 0}
          imageUrl={recipe.image ?? undefined}
          onPress={() => router.push(`/recipe/${recipe.id}`)}
        />
      </View>
    );
  };

  const renderMealContainer = (meal:MealSlot, color:string, recipeData:Recipe[]) => {
    return(
    <View className="gap-2 py-4">
      {/*header*/}
      <View className="flex-row items-center">
        <View
          className="h-4 w-4 rounded-full"
          style={{backgroundColor: color}}
        />
        <Text className="font-bold text-xl"> {meal} </Text>
      </View>

      {recipeData.map((recipe: Recipe) => (
        <View key={recipe.id}>
          {renderRecipeCard(recipe)}
        </View>
      ))}
      <Button
        variant="outline"
        icon={{
          name: "plus",
          position: "left",
          size: 16,
          color: color,
        }}
        className="h-14 flex px-20 rounded-2xl shadow-sm border-2"
        style={{borderColor: color}}
        color="white"
        onPress={() => openAddRecipeModal(meal)}
      >
        <Text className="text-xl font-bold" style={{color: color}}>
          Add {meal}
        </Text>
      </Button>

    </View>
    )
  }

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8] px-4 pt-safe-or-20">
    <ScrollView
      className="flex-1 px-4"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="py-4"> Plan Duration </Text>
      {/* Plan Duration container */}
      <View className="flex-row gap-4 w-full">

        {/* start */}
        <Pressable className="flex-1 bg-white p-4 rounded-lg shadow-sm"
          onPress={() => {
            setActiveField("start");
            setShowPicker(true);
          }}
        >
          <Text> Start Date </Text>
          <Text> {start_date.toDateString()} </Text>
        </Pressable>

        {/* End */}
        <Pressable className="flex-1 bg-white p-4 rounded-lg shadow-sm"
          onPress={() => {
            setActiveField("end");
            setShowPicker(true);
          }}
        >
          <Text> End Date </Text>
          <Text> {end_date.toDateString()} </Text>
        </Pressable>

        {showPicker && (
          <DateTimePicker
            value={activeField === "start" ? start_date : end_date}
            mode="date"
            display="calendar"
            onChange={onChange}
          />
        )}
      </View>

      <View className="py-3">
        <Button
          variant="outline"
          icon={{ name: "invoice-list-outline", position: "left", size: 18 }}
          className="rounded-xl border-2 border-[#666]"
          textClassName="font-semibold text-foreground"
          onPress={() => {
            router.push({
              pathname: "/calendar/meal-plan-nutrient-preview",
              params: {
                breakfastIds: JSON.stringify(breakfastRecipe.map(r => r.id)),
                lunchIds: JSON.stringify(lunchRecipe.map(r => r.id)),
                dinnerIds: JSON.stringify(dinnerRecipe.map(r => r.id)),
              },
            });
          }}
        >
          Preview nutrient
        </Button>
      </View>

      {/*Breakfast container*/}
      <View>{renderMealContainer("Breakfast", "#fcba03", breakfastRecipe)}</View>

      {/*Lunch container*/}
      <View>{renderMealContainer("Lunch", "#14cc0a", lunchRecipe)}</View>

      {/*dinner container*/}
      <View>{renderMealContainer("Dinner", "#bd9b64", dinnerRecipe)}</View>

      {/*Save button*/}
      <View className="flex items-center">
        <Button
          variant="default"
          className="h-16 flex  px-20 bg-red-primary rounded-2xl shadow-sm"
          textClassName="text-xl font-bold text-white"
          onPress={() => {
            handleSave();
            //router.back()
          }}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </View>

      {/* recipe select pop up */}
      <Modal
        transparent
        visible={visible}
        animationType="fade"
        statusBarTranslucent={true}
      >
        {/* Backdrop */}
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center"
          onPress={() => setVisible(false)}
        >
          {/* Stop press propagation */}
          <Pressable className="w-80 bg-background rounded-2xl p-6 gap-4">
            <Text className="text-lg font-bold text-center text-foreground">Choose Recipe</Text>
            <Button
              variant="outline"
              onPress={() => {
                setVisible(false);
                //console.log("Favorites selected");
                router.push({
                  pathname: "/account/favorites",
                  params: { mode: "select" },
                });
              }}
              icon={{ name: "heart-outline", position: "left" }}
            >
              From Favorites
            </Button>

            <Button
              variant="outline"
              onPress={() => {
                setVisible(false);
                //console.log("Search selected");
                router.push({
                  pathname: "/home/search",
                  params: { mode: "select" },
                })
              }}
              icon={{ name: "magnify", position: "left" }}
            >
              Search Recipes
            </Button>

            </Pressable>
          </Pressable>
        </Modal>
    </ScrollView>
    </ThemedSafeView>
  );
}