// app/(toolbar)/calendar/meal-plan.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import type { Recipe } from "@/contexts/meal-plan-selection-context";
import { useMealPlanSelection } from "@/contexts/meal-plan-selection-context";
import { useMealPlans } from "@/contexts/meal-plans-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Pressable, Text, View, Modal, ScrollView } from "react-native";
import Button from "@/components/ui/button";
import { SwipeableRecipeCardRemovable } from "@/components/swipeable-recipe-card";
import { IconSymbol } from "@/components/ui/icon-symbol";

const SERVER_URL = "http://10.0.2.2:3000";

const CAL_SLIDER_MIN = 100;
const CAL_SLIDER_MAX = 1200;
const CAL_SLIDER_STEP = 25;

type MealSlot = "Breakfast" | "Lunch" | "Dinner";

export default function MealPlanPage() {
  const [start_date, setStartDate] = useState(new Date());
  const [end_date, setEndDate] = useState(new Date());

  const [showPicker, setShowPicker] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "end" | null>(null);

  const [visible, setVisible] = useState(false);
  const [pendingMealSlot, setPendingMealSlot] = useState<MealSlot | null>(null);
  //Meal state arrays
  const [breakfastRecipe, setBreakfastRecipe] = useState<Recipe[]>([]);
  const [lunchRecipe, setLunchRecipe] = useState<Recipe[]>([]);
  const [dinnerRecipe, setDinnerRecipe] = useState<Recipe[]>([]);

  //button states
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [calorieMin, setCalorieMin] = useState(400);
  const [calorieMax, setCalorieMax] = useState(700);

  const [count, setCount] = useState<Record<string, number>>({});

  const { pendingSelectedRecipe, setPendingSelectedRecipe } = useMealPlanSelection();
  const { refetch: refetchMealPlans } = useMealPlans();

  const increment = (id: string) => {
    setCount((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };
  const decrement = (id: string) => {
    setCount((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) - 1),
    }));
  };

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

  const handleDelete = (recipeId: string, meal: MealSlot) => {
    //delete from meals array
    if (meal === "Breakfast") {
      setBreakfastRecipe(prev => prev.filter(recipe => recipe.id !== recipeId));
    } else if (meal === "Lunch") {
      setLunchRecipe(prev => prev.filter(recipe => recipe.id !== recipeId));
    } else if (meal === "Dinner") {
      setDinnerRecipe(prev => prev.filter(recipe => recipe.id !== recipeId));
    }
  };

  const handleAutoMealPlan = useCallback(async () => {
    setAutoGenerating(true);
    try {
      const params = new URLSearchParams({
        calorieMin: String(Math.min(calorieMin, calorieMax)),
        calorieMax: String(Math.max(calorieMin, calorieMax)),
      });
      const res = await fetch(
        `${SERVER_URL}/api/external-recipes/auto-meal-plan?${params.toString()}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to auto generate meal plan");
      }

      const meals = data?.meals ?? {};
      const toRecipe = (r: any): Recipe => ({
        id: String(r?.id ?? ""),
        title: r?.title ?? undefined,
        calories: typeof r?.calories === "number" ? r.calories : undefined,
        rating: typeof r?.rating === "number" ? r.rating : undefined,
        image: r?.image ?? undefined,
      });

      console.log(meals.breakfast, meals.lunch, meals.dinner);

      setBreakfastRecipe(
        Array.isArray(meals.breakfast)
          ? meals.breakfast.filter((r: any) => r?.id != null).map(toRecipe)
          : [],
      );
      setLunchRecipe(
        Array.isArray(meals.lunch)
          ? meals.lunch.filter((r: any) => r?.id != null).map(toRecipe)
          : [],
      );
      setDinnerRecipe(
        Array.isArray(meals.dinner)
          ? meals.dinner.filter((r: any) => r?.id != null).map(toRecipe)
          : [],
      );
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to auto generate meal plan.",
      );
    } finally {
      setAutoGenerating(false);
    }
  }, [calorieMin, calorieMax]);

  const renderRecipeCard = (recipe: any, mealslot: MealSlot) => {
    if (!recipe) return null;
    return (
      <View className="mb-3 gap-2">
        <SwipeableRecipeCardRemovable
          id={recipe.id}
          title={recipe.title}
          calories={recipe.calories}
          rating={recipe.rating}
          reviewsLength={recipe.reviews?.length || 0}
          image={recipe.image ?? undefined}
          onPress={() => router.push(`/recipe/${recipe.id}`)}
          onActionPress={() => {
            handleDelete(recipe.id, mealslot);
          }}
        />
      </View>
    );
  };

  const renderMealContainer = (meal: MealSlot, color: string, recipeData: Recipe[]) => {
    return (
      <View className="gap-2 py-4">
        {/*header*/}
        <View className="flex-row items-center">
          <View
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: color }}
          />
          <Text className="font-bold text-xl"> {meal} </Text>
        </View>

        {recipeData.map((recipe: Recipe) => (
          <View key={recipe.id}>
            {renderRecipeCard(recipe, meal)}
            <View className="flex-row">
              <Text className="flex-1 text-base">Servings per day:</Text>

              <View className="flex-row items-center bg-gray-100 rounded-full shadow px-2 py-1 gap-2">
                {/*decrease*/}
                <Pressable
                  onPress={() => decrement(recipe.id)}
                  className="w-8 h-8 flex bg-[#dce4e8] items-center justify-center rounded-full active:scale-95"
                >
                  <Text className="text-lg">&lt;</Text>
                </Pressable>
                <Text className="min-w-[24px] text-center font-medium text-gray-800">
                  {count[recipe.id] || 1}
                </Text>
                {/*increase*/}
                <Pressable
                  onPress={() => increment(recipe.id)}
                  className="w-8 h-8 flex bg-[#dce4e8] items-center justify-center rounded-full active:scale-95"
                >
                  <Text className="text-lg">&gt;</Text>
                </Pressable>
              </View>

            </View>
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
          style={{ borderColor: color }}
          color="white"
          onPress={() => openAddRecipeModal(meal)}
        >
          <Text className="text-xl font-bold" style={{ color: color }}>
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
        <View className="flex-row gap-2">
          {/*auto meal plan button*/}
          <Pressable className="flex-1 h-12 bg-white rounded-lg shadow-sm items-center justify-center"
            onPress={handleAutoMealPlan}
            disabled={autoGenerating}
          >
            <Text>{autoGenerating ? "Generating..." : "Auto Meal Plan"}</Text>
          </Pressable>

          {/* meal plan settings — opens calorie range modal */}
          <Pressable
            className="h-12 w-12 bg-white rounded-lg shadow-sm items-center justify-center"
            onPress={() => setSettingsModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Meal plan settings"
          >
            <IconSymbol name="cog" size={22} color="--color-foreground" />
          </Pressable>
        </View>

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

        {/* recipe select modal pop up */}
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

        {/* meal plan settings — target calories per meal for auto generator */}
        <Modal
          transparent
          visible={settingsModalVisible}
          animationType="fade"
          statusBarTranslucent
        >
          <View className="flex-1 justify-center items-center">
            <Pressable
              className="absolute inset-0 bg-black/50"
              onPress={() => setSettingsModalVisible(false)}
            />
            <View className="mx-4 w-[90%] max-w-sm rounded-2xl bg-background p-6 gap-5 shadow-lg">
              <Text className="text-lg font-bold text-center text-foreground">
                Meal plan settings
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Auto meal plan will prefer recipes between these calories (per meal)
              </Text>

              <View className="gap-2">
                <Text className="font-semibold text-foreground">
                  Minimum: {Math.min(calorieMin, calorieMax)} cal
                </Text>
                <Slider
                  minimumValue={CAL_SLIDER_MIN}
                  maximumValue={CAL_SLIDER_MAX}
                  step={CAL_SLIDER_STEP}
                  value={calorieMin}
                  onValueChange={(v) => {
                    const next = Math.round(v / CAL_SLIDER_STEP) * CAL_SLIDER_STEP;
                    setCalorieMin(next);
                    if (next > calorieMax) setCalorieMax(next);
                  }}
                  minimumTrackTintColor="#bd9b64"
                  maximumTrackTintColor="#e5e5e5"
                  thumbTintColor="#bd9b64"
                />
              </View>

              <View className="gap-2">
                <Text className="font-semibold text-foreground">
                  Maximum: {Math.max(calorieMin, calorieMax)} cal
                </Text>
                <Slider
                  minimumValue={CAL_SLIDER_MIN}
                  maximumValue={CAL_SLIDER_MAX}
                  step={CAL_SLIDER_STEP}
                  value={calorieMax}
                  onValueChange={(v) => {
                    const next = Math.round(v / CAL_SLIDER_STEP) * CAL_SLIDER_STEP;
                    setCalorieMax(next);
                    if (next < calorieMin) setCalorieMin(next);
                  }}
                  minimumTrackTintColor="#bd9b64"
                  maximumTrackTintColor="#e5e5e5"
                  thumbTintColor="#bd9b64"
                />
              </View>

              <Button
                variant="default"
                className="rounded-xl"
                onPress={() => setSettingsModalVisible(false)}
              >
                Done
              </Button>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </ThemedSafeView>
  );
}