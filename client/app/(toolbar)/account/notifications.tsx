import React, { useEffect, useState } from "react";
import { Alert, Platform, Switch, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { AccountSubpageBody } from "@/components/account/account-subpage-body";
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { useMealPlans, type MealPlanItem } from "@/contexts/meal-plans-context";
import { localDateKeysInclusive } from "@/utils/meal-plan-habit-days";
import { SERVER_URL } from "@/utils/server-url";

const MEAL_PLAN_NOTIFICATIONS_KEY = "mealPlanNotificationsEnabled";
const MEAL_PLAN_NOTIFICATION_IDS_KEY = "mealPlanNotificationIds";

const PANTRY_NOTIFICATIONS_KEY = "pantryExpirationNotificationsEnabled";
const PANTRY_NOTIFICATION_IDS_KEY = "pantryExpirationNotificationIds";

type PantryItem = {
  id?: string;
  name?: string;
  itemName?: string;
  foodName?: string;
  title?: string;
  expirationDate?: string;
  expiration_date?: string;
  expiryDate?: string;
  expiresAt?: string;
};

type NotificationMealDetails = {
  breakfast: string[];
  lunch: string[];
  dinner: string[];
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function NotificationRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="bg-background rounded-xl shadow-sm px-4 py-5 flex-row items-center justify-between">
      <View className="flex-1 pr-4">
        <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">
          {title}
        </Text>
        <Text className="text-[12px] text-muted-foreground tracking-[0.5px] mt-1">
          {subtitle}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D9D9D9", true: "#F2A6A6" }}
        thumbColor={value ? "#E3473C" : "#FFFFFF"}
      />
    </View>
  );
}

async function requestNotificationPermission() {
  const currentPermission = await Notifications.getPermissionsAsync();
  if (currentPermission.status === "granted") {
    return true;
  }

  const requestedPermission = await Notifications.requestPermissionsAsync();
  return requestedPermission.status === "granted";
}

async function setupAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

// Grabs meal plan information
function parseMealSlot(slotValue: string | string[] | any[] | null | undefined) {
  if (!slotValue) return [];
  let parsedValue: any = slotValue;
  if (typeof slotValue === "string") {
    try {
      parsedValue = JSON.parse(slotValue);
    } catch {
      return [slotValue.trim()].filter((value) => value.length > 0);
    }
  }

  if (!Array.isArray(parsedValue)) return [];
  return parsedValue
    .map((meal) => {
      if (typeof meal === "string") {
        return meal.trim();
      }
      if (meal && typeof meal === "object") {
        return String(
          meal.id ??
            meal.recipeId ??
            meal.externalId ??
            meal.spoonacularId ??
            ""
        ).trim();
      }
      return "";
    })
    .filter((id) => id.length > 0);
}

// Meal plan names
async function fetchRecipeTitleById(id: string) {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/external-recipes/${id}/details?includeNutrition=true`
    );
    const data = await response.json();
    if (!response.ok) {
      console.log("Failed to fetch notification recipe title:", id, data);
      return "Unknown Recipe";
    }
    return data?.recipe?.title || "Unknown Recipe";
  } catch (error) {
    console.log("Error fetching notification recipe title:", error);
    return "Unknown Recipe";
  }
}

async function getMealTitles(
  slotValue: string | string[] | any[] | null | undefined
) {
  const ids = parseMealSlot(slotValue);
  if (ids.length === 0) return [];
  const titles = await Promise.all(ids.map((id) => fetchRecipeTitleById(id)));
  return titles;
}

async function getMealPlanNotificationDetails(
  plan: MealPlanItem
): Promise<NotificationMealDetails> {
  const [breakfast, lunch, dinner] = await Promise.all([
    getMealTitles(plan.breakfast),
    getMealTitles(plan.lunch),
    getMealTitles(plan.dinner),
  ]);

  return {
    breakfast,
    lunch,
    dinner,
  };
}

function getMealSlotTextFromTitles(label: string, titles: string[]) {
  if (titles.length === 0) {
    return `${label}: None`;
  }

  return `${label}: ${titles.join(", ")}`;
}

function buildMealPlanNotificationBodyFromDetails(
  details: NotificationMealDetails
) {
  return [
    getMealSlotTextFromTitles("Breakfast", details.breakfast),
    getMealSlotTextFromTitles("Lunch", details.lunch),
    getMealSlotTextFromTitles("Dinner", details.dinner),
  ].join("\n");
}

function getReminderDateForDay(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);

  const reminderDate = new Date(year, month - 1, day);

  // Night before the meal plan day
  reminderDate.setDate(reminderDate.getDate() - 1);

  // Set meal plan reminder time here.
  reminderDate.setHours(14, 14, 0, 0);
  return reminderDate;
}

async function cancelMealPlanNotifications() {
  const savedNotificationIds = await AsyncStorage.getItem(
    MEAL_PLAN_NOTIFICATION_IDS_KEY
  );

  if (!savedNotificationIds) return;

  const notificationIds: string[] = JSON.parse(savedNotificationIds);

  for (const notificationId of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  await AsyncStorage.removeItem(MEAL_PLAN_NOTIFICATION_IDS_KEY);
}

async function scheduleMealPlanNotifications(mealPlans: MealPlanItem[]) {
  await cancelMealPlanNotifications();

  const scheduledNotificationIds: string[] = [];

  for (const plan of mealPlans) {
    if (!plan.start_date || !plan.end_date) continue;

    const dayKeys = localDateKeysInclusive(plan.start_date, plan.end_date);

    const mealDetails = await getMealPlanNotificationDetails(plan);
    const notificationBody =
      buildMealPlanNotificationBodyFromDetails(mealDetails);

    for (const dayKey of dayKeys) {
      const reminderDate = getReminderDateForDay(dayKey);

      if (reminderDate <= new Date()) continue;

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Tomorrow's Meal Plan",
          body: notificationBody,
          sound: true,
          data: {
            type: "meal_plan",
            mealPlanId: plan.id,
            mealPlanDate: dayKey,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
          channelId: "default",
        },
      });

      scheduledNotificationIds.push(notificationId);
    }
  }

  await AsyncStorage.setItem(
    MEAL_PLAN_NOTIFICATION_IDS_KEY,
    JSON.stringify(scheduledNotificationIds)
  );

  return scheduledNotificationIds;
}

function getPantryItemName(item: PantryItem) {
  return (
    item.name ||
    item.itemName ||
    item.foodName ||
    item.title ||
    "Pantry item"
  );
}

function getPantryExpirationDate(item: PantryItem) {
  return (
    item.expirationDate ||
    item.expiration_date ||
    item.expiryDate ||
    item.expiresAt ||
    null
  );
}

function getPantryReminderDate(expirationDate: string) {
  let expiration: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(expirationDate)) {
    const [year, month, day] = expirationDate.split("-").map(Number);
    expiration = new Date(year, month - 1, day);
  } else {
    expiration = new Date(expirationDate);
  }

  if (Number.isNaN(expiration.getTime())) {
    return null;
  }

  const reminderDate = new Date(
    expiration.getFullYear(),
    expiration.getMonth(),
    expiration.getDate()
  );

  // 1 day before expiration
  reminderDate.setDate(reminderDate.getDate() - 1);
  // Set pantry reminder time here.
  reminderDate.setHours(14, 14, 0, 0);

  return reminderDate;
}

async function cancelPantryNotifications() {
  const savedNotificationIds = await AsyncStorage.getItem(
    PANTRY_NOTIFICATION_IDS_KEY
  );

  if (!savedNotificationIds) return;

  const notificationIds: string[] = JSON.parse(savedNotificationIds);

  for (const notificationId of notificationIds) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  await AsyncStorage.removeItem(PANTRY_NOTIFICATION_IDS_KEY);
}

async function fetchPantryItems() {
  const idToken = await AsyncStorage.getItem("idToken");

  if (!idToken) {
    throw new Error("No ID token found. Please log in again.");
  }

  const response = await fetch(`${SERVER_URL}/api/pantry`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error || "Could not fetch pantry items.");
  }

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.pantryItems)) return data.pantryItems;
  if (Array.isArray(data.data)) return data.data;

  return [];
}

async function schedulePantryNotifications() {
  await cancelPantryNotifications();

  const pantryItems: PantryItem[] = await fetchPantryItems();
  const scheduledNotificationIds: string[] = [];

  for (const item of pantryItems) {
    const expirationDate = getPantryExpirationDate(item);

    if (!expirationDate) continue;

    const reminderDate = getPantryReminderDate(expirationDate);

    if (!reminderDate) continue;

    if (reminderDate <= new Date()) continue;

    const itemName = getPantryItemName(item);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Food Expiring Soon",
        body: `${itemName} expires tomorrow.`,
        sound: true,
        data: {
          type: "pantry_expiration",
          pantryItemId: item.id,
          itemName,
          expirationDate,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        channelId: "default",
      },
    });

    scheduledNotificationIds.push(notificationId);
  }

  await AsyncStorage.setItem(
    PANTRY_NOTIFICATION_IDS_KEY,
    JSON.stringify(scheduledNotificationIds)
  );

  return scheduledNotificationIds;
}

export default function NotificationsPage() {
  const { mealPlans } = useMealPlans();

  const [mealPlanNotifications, setMealPlanNotifications] = useState(false);
  const [pantryNotifications, setPantryNotifications] = useState(false);

  useEffect(() => {
    loadNotificationSettings();
  }, []);

  async function loadNotificationSettings() {
    try {
      const savedMealPlanSetting = await AsyncStorage.getItem(
        MEAL_PLAN_NOTIFICATIONS_KEY
      );

      const savedPantrySetting = await AsyncStorage.getItem(
        PANTRY_NOTIFICATIONS_KEY
      );

      setMealPlanNotifications(savedMealPlanSetting === "true");
      setPantryNotifications(savedPantrySetting === "true");
    } catch (error) {
      console.log("Error loading notification settings:", error);
    }
  }

  async function handleMealPlanToggle(value: boolean) {
    try {
      if (value) {
        const hasPermission = await requestNotificationPermission();

        if (!hasPermission) {
          Alert.alert(
            "Notifications Disabled",
            "Please enable notifications in your device settings."
          );
          return;
        }

        await setupAndroidNotificationChannel();

        const scheduledIds = await scheduleMealPlanNotifications(mealPlans ?? []);

        setMealPlanNotifications(true);
        await AsyncStorage.setItem(MEAL_PLAN_NOTIFICATIONS_KEY, "true");

        Alert.alert(
          "Meal Plan Notifications Enabled",
          `${scheduledIds.length} meal plan reminder(s) scheduled.`
        );
      } else {
        await cancelMealPlanNotifications();

        setMealPlanNotifications(false);
        await AsyncStorage.setItem(MEAL_PLAN_NOTIFICATIONS_KEY, "false");
      }
    } catch (error) {
      console.log("Error toggling meal plan notifications:", error);
      Alert.alert("Error", "Could not update meal plan notifications.");
    }
  }

  async function handlePantryToggle(value: boolean) {
    try {
      if (value) {
        const hasPermission = await requestNotificationPermission();

        if (!hasPermission) {
          Alert.alert(
            "Notifications Disabled",
            "Please enable notifications in your device settings."
          );
          return;
        }

        await setupAndroidNotificationChannel();

        const scheduledIds = await schedulePantryNotifications();

        setPantryNotifications(true);
        await AsyncStorage.setItem(PANTRY_NOTIFICATIONS_KEY, "true");

        Alert.alert(
          "Pantry Notifications Enabled",
          `${scheduledIds.length} pantry expiration reminder(s) scheduled.`
        );
      } else {
        await cancelPantryNotifications();

        setPantryNotifications(false);
        await AsyncStorage.setItem(PANTRY_NOTIFICATIONS_KEY, "false");
      }
    } catch (error) {
      console.log("Error toggling pantry notifications:", error);
      Alert.alert("Error", "Could not update pantry notifications.");
    }
  }

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <AccountWebColumn className="flex-1">
        <AccountSubpageBody>
          <View className="gap-4">
            <NotificationRow
              title="Meal Plan Notifications"
              subtitle="Get tomorrow's breakfast, lunch, and dinner reminder at 8 PM."
              value={mealPlanNotifications}
              onValueChange={handleMealPlanToggle}
            />

            <NotificationRow
              title="Pantry Expiration Notifications"
              subtitle="Get reminders 1 day before pantry items expire at 12 PM."
              value={pantryNotifications}
              onValueChange={handlePantryToggle}
            />
          </View>
        </AccountSubpageBody>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}