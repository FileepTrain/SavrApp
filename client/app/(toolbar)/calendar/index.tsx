// app/(toolbar)/calendar/index.tsx
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Calendar } from "react-native-calendars";
import type { DateData } from "react-native-calendars";
import Button from "@/components/ui/button";
import { useMealPlans } from "@/contexts/meal-plans-context";
import { SwipeableMealPlanCard } from "@/components/swipeable-mealplan-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { generateICS } from "@/services/calendarExport";
import { Alert } from "react-native";
import { SERVER_URL } from '@/utils/server-url';

const dateOnlyFromISO = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Builds and returns the date as a Date object
const toLocalDate = (
  dateOnlyOrYear: string | number,
  month1to12?: number,
  day1to31: number = 1
): Date => {
  if (typeof dateOnlyOrYear === "string") {
    const [y, m, d] = dateOnlyOrYear.split("-").map((x) => Number(x));
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }
  return new Date(dateOnlyOrYear, (month1to12 ?? 1) - 1, day1to31);
}

export default function CalendarPage() {
  const { mealPlans, loading, error, refetch } = useMealPlans();
  const [calendarOwnerUid, setCalendarOwnerUid] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => dateOnlyFromISO(new Date().toISOString()));
  const [visibleMonth, setVisibleMonth] = useState(() =>
    toLocalDate(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  );
  const theme = useThemePalette();

  useEffect(() => {
    void AsyncStorage.getItem("uid").then(setCalendarOwnerUid);
  }, []);

  const handleExportCalendar = async () => {
  try {
    console.log("mealPlans FULL:", mealPlans);
    if (!mealPlans || mealPlans.length === 0) {
      Alert.alert("No Data", "No meal plans available to export.");
      return;
    }

    // Build ICS-friendly data
    const days: {
      date: Date;
      breakfast: { title: string }[];
      lunch: { title: string }[];
      dinner: { title: string }[];
    }[] = [];

    mealPlans.forEach((plan) => {
      if (!plan.start_date || !plan.end_date) return;

      const start = new Date(plan.start_date);
      const end = new Date(plan.end_date);

      const current = new Date(start);

      while (current <= end) {
        let breakfastArr: { title: string }[] = [];
        let lunchArr: { title: string }[] = [];
        let dinnerArr: { title: string }[] = [];

        try {
          const parsedBreakfast = plan.breakfast ? JSON.parse(plan.breakfast) : [];
          const parsedLunch = plan.lunch ? JSON.parse(plan.lunch) : [];
          const parsedDinner = plan.dinner ? JSON.parse(plan.dinner) : [];

          breakfastArr = parsedBreakfast.map((r: any) => ({
            title: r.title || "Unknown Recipe",
          }));

          lunchArr = parsedLunch.map((r: any) => ({
            title: r.title || "Unknown Recipe",
          }));

          dinnerArr = parsedDinner.map((r: any) => ({
            title: r.title || "Unknown Recipe",
          }));
        } catch (e) {
          console.error("JSON parse error:", e);
        }

        days.push({
          date: new Date(current),
          breakfast: breakfastArr,
          lunch: lunchArr,
          dinner: dinnerArr,
        });

        current.setDate(current.getDate() + 1);
  }
    });

    if (days.length === 0) {
      Alert.alert("No Data", "No valid meal plans to export.");
      return;
    }

    const ics = await generateICS(days);

    const token = await AsyncStorage.getItem("idToken");

    if (!token) {
      Alert.alert("Error", "You are not authenticated.");
      return;
    }

    const res = await fetch(`${SERVER_URL}/api/auth/send-calendar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ icsContent: ics }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to send email");
    }

    Alert.alert("Success", "Calendar sent to your email!");
  } catch (err: any) {
    console.error("Export error:", err);
    Alert.alert("Error", err.message || "Export failed");
  }
};

  const mealPlansForSelectedDay = useMemo(() => {
    const d = selectedDate;
    return (mealPlans ?? []).filter((p) => {
      if (!p.start_date || !p.end_date) return false;
      const start = dateOnlyFromISO(p.start_date);
      const end = dateOnlyFromISO(p.end_date);
      return start <= d && d <= end;
    });
  }, [mealPlans, selectedDate]);

  const markedDates = useMemo(() => {
    // Colors for breakfast / lunch / dinner periods
    const breakfastColor = "#f0bb29";
    const lunchColor = "#4fa34b";
    const dinnerColor = "#bd9b64";

    // Initialize the marks object to store all marking info
    const marks: Record<string, any> = {};
    type MealSlot = "breakfast" | "lunch" | "dinner";

    for (const plan of mealPlans ?? []) {
      if (!plan.start_date || !plan.end_date) continue;

      const start = dateOnlyFromISO(plan.start_date);
      const end = dateOnlyFromISO(plan.end_date);
      if (!start || !end) continue;

      // Convert start and end dates to UTC milliseconds to calculate the difference
      const [startYear, startMonth, startDay] = start.split("-").map((x) => Number(x));
      const [endYear, endMonth, endDay] = end.split("-").map((x) => Number(x));
      if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) continue;

      const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
      const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
      if (Number.isNaN(startUtc) || Number.isNaN(endUtc) || endUtc < startUtc) continue;

      // Convert milliseconds to days
      const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));

      // Walk through each day in the range
      for (let offset = 0; offset <= diffDays; offset++) {
        const dt = new Date(startUtc);
        dt.setUTCDate(dt.getUTCDate() + offset);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
        const d = String(dt.getUTCDate()).padStart(2, "0");
        const dayKey = `${y}-${m}-${d}`;
        // Max 3 markings per day (Breakfast/Lunch/Dinner), even if multiple meal plans overlap on the same date
        const entry = (marks[dayKey] ??= { periodsByMeal: {} as Partial<Record<MealSlot, any>> });
        const periodsByMeal: Partial<Record<MealSlot, any>> = entry.periodsByMeal;

        const isStart = dayKey === start;
        const isEnd = dayKey === end;

        // Build the periods array for the day, containing each meal type (breakfast, lunch, dinner)
        if (plan.breakfast) {
          const prev = periodsByMeal.breakfast;
          periodsByMeal.breakfast = {
            color: breakfastColor,
            startingDay: !!prev?.startingDay || isStart,
            endingDay: !!prev?.endingDay || isEnd,
          };
        }
        if (plan.lunch) {
          const prev = periodsByMeal.lunch;
          periodsByMeal.lunch = {
            color: lunchColor,
            startingDay: !!prev?.startingDay || isStart,
            endingDay: !!prev?.endingDay || isEnd,
          };
        }
        if (plan.dinner) {
          const prev = periodsByMeal.dinner;
          periodsByMeal.dinner = {
            color: dinnerColor,
            startingDay: !!prev?.startingDay || isStart,
            endingDay: !!prev?.endingDay || isEnd,
          };
        }

      }
    }

    // Convert our de-duped per-day structure into the `markedDates[dayKey].periods`
    // format expected by the calendar + our custom `dayComponent`.
    const mealOrder: MealSlot[] = ["breakfast", "lunch", "dinner"];
    for (const dayKey of Object.keys(marks)) {
      const entry = marks[dayKey];
      if (!entry?.periodsByMeal) continue;

      entry.periods = mealOrder
        .map((meal) => entry.periodsByMeal?.[meal])
        .filter(Boolean);
    }

    // Ensure the currently selected date is visually highlighted as well
    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: theme["--color-red-secondary"],
    };

    return marks;
  }, [mealPlans, selectedDate, theme]);

  return (
    <ThemedSafeView className="flex-1 bg-app-background">
      <AccountWebColumn className="flex-1 min-h-0">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="px-4 pt-2">
            <Text className="text-foreground text-2xl font-semibold">Calendar</Text>
          </View>

          <View className="gap-4 flex-1 px-4 pb-4">
          {/* Wider than body text: breakout uses the horizontal padding band so only the month grid grows. */}
          <View className="-mx-4">
            <View className="bg-background rounded-xl shadow-sm p-1">
            <Calendar
              key={theme["--color-foreground"] || selectedDate}
              enableSwipeMonths
              onMonthChange={(m) => {
                if (!m?.year || !m?.month) return;
                setVisibleMonth(toLocalDate(m.year, m.month, 1));
              }}
              markingType="multi-period"
              markedDates={markedDates}
              customHeaderTitle={<Text className="text-foreground text-xl font-semibold">{visibleMonth.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
              })}</Text>}
              renderArrow={(direction) => {
                return (
                  <View className="p-2 bg-muted-background rounded-full">
                    <IconSymbol name={direction === "left" ? "chevron-left" : "chevron-right"} size={20} color="--color-foreground" />
                  </View>
                );
              }}
              dayComponent={({ date, state, marking }: { date?: DateData; state?: string; marking?: { periods?: { color: string }[], cook?: boolean, shop?: boolean } }) => {
                if (!date) return null;

                // Compute today's key in local time
                const today = new Date();
                const todayKey = `${today.getFullYear()}-${String(
                  today.getMonth() + 1
                ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                const isSelected = date.dateString === selectedDate;
                const isToday = date.dateString === todayKey;

                const bgClass = isSelected ? "bg-red-secondary" : "bg-transparent";
                const textClass = isSelected
                  ? "text-background font-medium"
                  : isToday
                    ? "text-red-primary font-medium"
                    : state === "disabled"
                      ? "text-muted-foreground font-normal"
                      : "text-foreground font-medium";

                return (
                  <Pressable
                    className={`relative rounded-xl w-full ${bgClass}`}
                    style={{ aspectRatio: 1 }}
                    onPress={() => setSelectedDate(date.dateString)}
                  >
                    <Text className={`${textClass} mt-1.5 ml-2`} style={{ zIndex: 1 }}>
                      {date.day}
                    </Text>

                    {marking && marking.periods && marking.periods.length > 0 && (
                      <View
                        className="absolute w-full flex-col gap-0.5 justify-center px-1"
                        style={{ top: 0, bottom: 0, left: 0 }}
                        pointerEvents="none"
                      >
                        {marking.periods.map(
                          (
                            p: { color: string; startingDay?: boolean; endingDay?: boolean },
                            idx: number
                          ) => {
                            const radius = 2;
                            // Determine whether the period is the start or end of the marking to style the corners
                            const isStart = !!p.startingDay;
                            const isEnd = !!p.endingDay;
                            // Pull bars slightly past the cell edge on continuation days so multi-day strips read as one line across columns (calendar has a small gap between cells).
                            const bridge = 3;

                            return (
                              <View
                                key={idx}
                                className="h-1.5"
                                style={{
                                  backgroundColor: p.color,
                                  borderTopLeftRadius: isStart ? radius : 0,
                                  borderBottomLeftRadius: isStart ? radius : 0,
                                  borderTopRightRadius: isEnd ? radius : 0,
                                  borderBottomRightRadius: isEnd ? radius : 0,
                                  marginLeft: isStart ? 4 : -bridge,
                                  marginRight: isEnd ? 4 : -bridge,
                                }}
                              />
                            );
                          }
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              }}
              theme={{
                calendarBackground: "transparent",
                textSectionTitleColor: theme["--color-muted-foreground"],
                // Let custom `dayComponent` control proportions: stretch cell so `aspectRatio: 1` on the inner Pressable can drive row height.
                "stylesheet.day.basic": {
                  base: {
                    width: "100%",
                    height: "100%",
                    alignItems: "stretch",
                    justifyContent: "stretch",
                  },
                },
              }}
            />
            </View>
          </View>

          <View className="flex-1">
            <Text className="text-foreground text-xl font-semibold">
              {toLocalDate(selectedDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>

            <View className="py-3">
              <Button
                variant="primary"
                icon={{
                  name: "plus-circle-outline",
                  position: "left",
                  size: 20,
                  color: "--color-red-primary",
                }}
                className="h-20"
                textClassName="text-lg font-bold text-red-primary"
                onPress={() =>
                  router.push({ pathname: "/calendar/meal-plan", params: { date: selectedDate } })
                }
              >
                Create Meal Plan
              </Button>
            </View>
            <View className="py-3">
              <Button
                variant="outline"
                className="h-16"
                textClassName="text-lg font-semibold"
                onPress={handleExportCalendar}
              >
                Export Calendar
              </Button>
            </View>
            {
              loading ? (
                <ActivityIndicator size="large" color="red" />
              ) : error ? (
                <View className="flex-1 items-center justify-center px-6">
                  <Text className="text-center opacity-70 mb-3">Error: {String(error)}</Text>
                  <Button variant="default" onPress={() => refetch?.()}>
                    Reload
                  </Button>
                </View>
              ) : (
                <FlatList
                  data={mealPlansForSelectedDay}
                  keyExtractor={(item) => String(item.id)}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <View className="flex-1 items-center justify-center">
                      <Text className="opacity-60">No meal plans for this day.</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <View className="mb-3 w-full">
                      <SwipeableMealPlanCard
                        id={item.id}
                        startDateLabel={item.start_date ? new Date(item.start_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }) : "—"}
                        endDateLabel={item.end_date ? new Date(item.end_date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        }) : "—"}
                        breakfastId={item.breakfast}
                        lunchId={item.lunch}
                        dinnerId={item.dinner}
                        onMealPlanDeleted={refetch}
                        shareTargets={
                          calendarOwnerUid
                            ? { profileUserId: calendarOwnerUid, mealPlanId: item.id }
                            : undefined
                        }
                      />
                    </View>
                  )}
                />
              )
            }
          </View>
          </View>
        </ScrollView>
      </AccountWebColumn>
    </ThemedSafeView>
  );
}