// app/(toolbar)/calendar/index.tsx
import { AccountWebColumn } from "@/components/account/account-web-column";
import { ThemedSafeView } from "@/components/themed-safe-view";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Calendar } from "react-native-calendars";
import type { DateData } from "react-native-calendars";
import Button from "@/components/ui/button";
import { useMealPlans, type MealPlanItem } from "@/contexts/meal-plans-context";
import { SwipeableMealPlanCard } from "@/components/swipeable-mealplan-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { generateICS } from "@/services/calendarExport";
import { Alert } from "react-native";
import { SERVER_URL } from "@/utils/server-url";
import { localDateKeysInclusive, planCoversCalendarDateLocal } from "@/utils/meal-plan-habit-days";
import { DEFAULT_MEAL_SLOT_COLORS } from "@/utils/meal-plan-slot-colors";

const dateOnlyFromISO = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Builds and returns the date as a Date object
function localTodayYMD(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function selectedDaySlotStored(recipeId: string | null): string | null {
  if (!recipeId) return null;
  return JSON.stringify([
    { id: recipeId, baseServings: 1, targetServings: 1, batchMultiplier: 1 },
  ]);
}

/** Past calendar days only: green if followedPlan, red if not (any overlapping plan marks miss). */
function pastHabitBorderByDate(mealPlans: MealPlanItem[], todayKey: string): Record<string, "ok" | "miss"> {
  const out: Record<string, "ok" | "miss"> = {};
  for (const plan of mealPlans ?? []) {
    const rows = plan.habitDays;
    if (!rows?.length) continue;
    for (const row of rows) {
      const d = row.date;
      if (!d || d >= todayKey) continue;
      if (!row.followedPlan) out[d] = "miss";
      else if (out[d] !== "miss") out[d] = "ok";
    }
  }
  return out;
}

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
  const isWebDesktopCalendar = Platform.OS === "web";
  const { mealPlans, loading, error, refetch, toggleHabitsForCalendarDate } = useMealPlans();
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
    return (mealPlans ?? []).filter((p) => planCoversCalendarDateLocal(p.start_date, p.end_date, d));
  }, [mealPlans, selectedDate]);

  const selectedDayEntries = useMemo(
    () =>
      mealPlansForSelectedDay.map((p) => {
        const day = p.habitDays?.find((h) => h.date === selectedDate);
        return {
          planId: p.id,
          breakfastId: day?.breakfast?.id ?? null,
          lunchId: day?.lunch?.id ?? null,
          dinnerId: day?.dinner?.id ?? null,
          slotColors: {
            breakfast: p.breakfastColor ?? DEFAULT_MEAL_SLOT_COLORS.breakfast,
            lunch: p.lunchColor ?? DEFAULT_MEAL_SLOT_COLORS.lunch,
            dinner: p.dinnerColor ?? DEFAULT_MEAL_SLOT_COLORS.dinner,
          },
        };
      }),
    [mealPlansForSelectedDay, selectedDate],
  );

  const todayKeyForHabit = useMemo(() => localTodayYMD(), [mealPlans, visibleMonth, selectedDate]);

  const habitBorderByDate = useMemo(
    () => pastHabitBorderByDate(mealPlans ?? [], todayKeyForHabit),
    [mealPlans, todayKeyForHabit],
  );

  const onCalendarDayLongPress = useCallback(
    (dateString: string) => {
      void (async () => {
        try {
          await toggleHabitsForCalendarDate(dateString);
        } catch (e) {
          Alert.alert(
            "Could not update",
            e instanceof Error ? e.message : "Try again when online.",
          );
        }
      })();
    },
    [toggleHabitsForCalendarDate],
  );

  const markedDates = useMemo(() => {
    // Initialize the marks object to store all marking info
    const marks: Record<string, any> = {};
    type MealSlot = "breakfast" | "lunch" | "dinner";

    for (const plan of mealPlans ?? []) {
      if (!plan.start_date || !plan.end_date) continue;

      const breakfastBar = plan.breakfastColor ?? DEFAULT_MEAL_SLOT_COLORS.breakfast;
      const lunchBar = plan.lunchColor ?? DEFAULT_MEAL_SLOT_COLORS.lunch;
      const dinnerBar = plan.dinnerColor ?? DEFAULT_MEAL_SLOT_COLORS.dinner;

      const dayKeys = localDateKeysInclusive(plan.start_date, plan.end_date);
      if (!dayKeys.length) continue;
      const rangeStart = dayKeys[0];
      const rangeEnd = dayKeys[dayKeys.length - 1];

      for (const dayKey of dayKeys) {
        const dayIdx = dayKeys.indexOf(dayKey);
        // Max 3 markings per day (Breakfast/Lunch/Dinner), even if multiple meal plans overlap on the same date
        const entry = (marks[dayKey] ??= { periodsByMeal: {} as Partial<Record<MealSlot, any>> });
        const periodsByMeal: Partial<Record<MealSlot, any>> = entry.periodsByMeal;

        const dayHabit = plan.habitDays?.find((h) => h.date === dayKey);
        const breakfastRecipeId = dayHabit?.breakfast?.id ?? null;
        const lunchRecipeId = dayHabit?.lunch?.id ?? null;
        const dinnerRecipeId = dayHabit?.dinner?.id ?? null;

        const prevDayHabit =
          dayIdx > 0 ? plan.habitDays?.find((h) => h.date === dayKeys[dayIdx - 1]) : null;
        const nextDayHabit =
          dayIdx < dayKeys.length - 1
            ? plan.habitDays?.find((h) => h.date === dayKeys[dayIdx + 1])
            : null;

        const breakfastPrevId = prevDayHabit?.breakfast?.id ?? null;
        const breakfastNextId = nextDayHabit?.breakfast?.id ?? null;
        const lunchPrevId = prevDayHabit?.lunch?.id ?? null;
        const lunchNextId = nextDayHabit?.lunch?.id ?? null;
        const dinnerPrevId = prevDayHabit?.dinner?.id ?? null;
        const dinnerNextId = nextDayHabit?.dinner?.id ?? null;

        if (breakfastRecipeId || plan.breakfast) {
          const prev = periodsByMeal.breakfast;
          periodsByMeal.breakfast = {
            color: breakfastBar,
            startingDay:
              !!prev?.startingDay ||
              (breakfastRecipeId
                ? breakfastPrevId !== breakfastRecipeId
                : dayKey === rangeStart),
            endingDay:
              !!prev?.endingDay ||
              (breakfastRecipeId
                ? breakfastNextId !== breakfastRecipeId
                : dayKey === rangeEnd),
          };
        }
        if (lunchRecipeId || plan.lunch) {
          const prev = periodsByMeal.lunch;
          periodsByMeal.lunch = {
            color: lunchBar,
            startingDay:
              !!prev?.startingDay ||
              (lunchRecipeId ? lunchPrevId !== lunchRecipeId : dayKey === rangeStart),
            endingDay:
              !!prev?.endingDay ||
              (lunchRecipeId ? lunchNextId !== lunchRecipeId : dayKey === rangeEnd),
          };
        }
        if (dinnerRecipeId || plan.dinner) {
          const prev = periodsByMeal.dinner;
          periodsByMeal.dinner = {
            color: dinnerBar,
            startingDay:
              !!prev?.startingDay ||
              (dinnerRecipeId ? dinnerPrevId !== dinnerRecipeId : dayKey === rangeStart),
            endingDay:
              !!prev?.endingDay ||
              (dinnerRecipeId ? dinnerNextId !== dinnerRecipeId : dayKey === rangeEnd),
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

    for (const [dayKey, habitState] of Object.entries(habitBorderByDate)) {
      marks[dayKey] = {
        ...(marks[dayKey] ?? {}),
        habitState,
      };
    }

    return marks;
  }, [mealPlans, selectedDate, theme, habitBorderByDate]);

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
              dayComponent={({ date, state, marking }: { date?: DateData; state?: string; marking?: { periods?: { color: string }[], habitState?: "ok" | "miss", cook?: boolean, shop?: boolean } }) => {
                if (!date) return null;
                const isMobileCalendar = Platform.OS !== "web";

                // Compute today's key in local time
                const today = new Date();
                const todayKey = `${today.getFullYear()}-${String(
                  today.getMonth() + 1
                ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

                const isSelected = date.dateString === selectedDate;
                const isToday = date.dateString === todayKey;
                const habitState = marking?.habitState;
                const showHabitBadge = date.dateString < todayKey && (habitState === "ok" || habitState === "miss");

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
                    onLongPress={() => onCalendarDayLongPress(date.dateString)}
                    delayLongPress={350}
                    accessibilityHint="Press and hold to toggle whether you followed your meal plan that day."
                  >
                    <View className="flex-row items-center mt-1.5 ml-2" style={{ zIndex: 2 }}>
                      <Text
                        className={textClass}
                        style={{ fontSize: isWebDesktopCalendar ? 18 : 14 }}
                      >
                        {date.day}
                      </Text>
                      {showHabitBadge ? (
                        <Text
                          className="font-extrabold ml-1"
                          style={{
                            color: habitState === "ok" ? "#22c55e" : "#ef4444",
                            fontSize: isWebDesktopCalendar ? 20 : 16,
                            lineHeight: isWebDesktopCalendar ? 20 : 16,
                          }}
                        >
                          {habitState === "ok" ? "✓" : "✕"}
                        </Text>
                      ) : null}
                    </View>

                    {marking && marking.periods && marking.periods.length > 0 && (
                      <View
                        className="absolute w-full flex-col gap-0.5 justify-center px-1"
                        style={{ top: isMobileCalendar ? 12 : 0, bottom: 0, left: 0 }}
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
                                className={isMobileCalendar ? "h-1" : "h-1.5"}
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
                textDayHeaderFontSize: isWebDesktopCalendar ? 16 : 13,
                textDayHeaderFontWeight: "700",
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
                  data={selectedDayEntries}
                  keyExtractor={(item) => String(item.planId)}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <View className="flex-1 items-center justify-center">
                      <Text className="opacity-60">No meal plans for this day.</Text>
                    </View>
                  }
                  renderItem={({ item }) => (
                    <View className="mb-3 w-full">
                      <SwipeableMealPlanCard
                        id={item.planId}
                        startDateLabel={toLocalDate(selectedDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        endDateLabel={toLocalDate(selectedDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        breakfastId={selectedDaySlotStored(item.breakfastId)}
                        lunchId={selectedDaySlotStored(item.lunchId)}
                        dinnerId={selectedDaySlotStored(item.dinnerId)}
                        mealDotColors={{
                          breakfast: item.breakfastId ? item.slotColors.breakfast : undefined,
                          lunch: item.lunchId ? item.slotColors.lunch : undefined,
                          dinner: item.dinnerId ? item.slotColors.dinner : undefined,
                        }}
                        recipeReturnTo="/calendar"
                        readOnly={false}
                        onMealPlanDeleted={refetch}
                        onViewFullPlanPress={() => {
                          if (!calendarOwnerUid) return;
                          router.push({
                            pathname: "/profile/[userId]",
                            params: {
                              userId: calendarOwnerUid,
                              tab: "plans",
                              mealPlanId: item.planId,
                              returnTo: "/calendar",
                            },
                          });
                        }}
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