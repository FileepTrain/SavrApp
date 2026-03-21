import React, { useState } from "react";
import { Switch, Text, View } from "react-native";
import { ThemedSafeView } from "@/components/themed-safe-view";

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
    <View className="bg-background rounded-xl shadow-lg px-4 py-5 flex-row items-center justify-between">
      <View className="flex-1 pr-4">
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground mt-1">{subtitle}</Text>
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

/* Notifications Page */
export default function NotificationsPage() {
  const [mealPlanNotifications, setMealPlanNotifications] = useState(false);
  const [calendarNotifications, setCalendarNotifications] = useState(false);

  return (
    <ThemedSafeView className="flex-1 pt-safe-or-20">
      <View className="gap-4">
        <NotificationRow
          title="Meal Plan Notifications"
          subtitle="Get reminders for upcoming planned meals."
          value={mealPlanNotifications}
          onValueChange={setMealPlanNotifications}
        />

        <NotificationRow
          title="Calendar Notifications"
          subtitle="Receive reminders tied to your calendar schedule."
          value={calendarNotifications}
          onValueChange={setCalendarNotifications}
        />
      </View>
    </ThemedSafeView>
  );
}