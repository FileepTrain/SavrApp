// app/(toolbar)/calendar/index.tsx
import { ThemedSafeView } from "@/components/themed-safe-view";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { Calendar } from "react-native-calendars";
import type { DateData } from "react-native-calendars";
import Button from "@/components/ui/button";
import { useMealPlans } from "@/contexts/meal-plans-context";
import { SwipeableMealPlanCard } from "@/components/swipeable-mealplan-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";

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
  const [selectedDate, setSelectedDate] = useState(() => dateOnlyFromISO(new Date().toISOString()));
  const [visibleMonth, setVisibleMonth] = useState(() =>
    toLocalDate(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  );
  const theme = useThemePalette();

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
    const breakfastColor = "#6082b6";
    const lunchColor = "#da627d";
    const dinnerColor = "#77c199";

    // Initialize the marks object to store all marking info
    const marks: Record<string, any> = {};

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
        const entry = (marks[dayKey] ??= { periods: [] });
        const periods: any[] = entry.periods; // Contains period marking info for a date

        const isStart = dayKey === start;
        const isEnd = dayKey === end;

        // Build the periods array for the day, containing each meal type (breakfast, lunch, dinner)
        if (plan.breakfast) {
          periods.push({
            startingDay: isStart,
            endingDay: isEnd,
            color: breakfastColor,
          });
        }
        if (plan.lunch) {
          periods.push({
            startingDay: isStart,
            endingDay: isEnd,
            color: lunchColor,
          });
        }
        if (plan.dinner) {
          periods.push({
            startingDay: isStart,
            endingDay: isEnd,
            color: dinnerColor,
          });
        }

      }
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
    <ThemedSafeView>
      <ScrollView>

        <View className="gap-4 flex-1">
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
              style={{ minHeight: 380 }}
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
                    className={`rounded-xl w-full h-14 py-0.5 gap-1 ${bgClass}`}
                    onPress={() => setSelectedDate(date.dateString)}
                  >
                    <Text className={textClass + " ml-1"}>{date.day}</Text>

                    {marking && marking.periods && marking.periods.length > 0 && (
                      <View className="flex-col gap-0.5">
                        {marking.periods.map(
                          (
                            p: { color: string; startingDay?: boolean; endingDay?: boolean },
                            idx: number
                          ) => {
                            const radius = 2;
                            // Determine whether the period is the start or end of the marking to style the corners
                            const isStart = !!p.startingDay;
                            const isEnd = !!p.endingDay;

                            return (
                              <View
                                key={idx}
                                className="h-1"
                                style={{
                                  backgroundColor: p.color,
                                  borderTopLeftRadius: isStart ? radius : 0,
                                  borderBottomLeftRadius: isStart ? radius : 0,
                                  borderTopRightRadius: isEnd ? radius : 0,
                                  borderBottomRightRadius: isEnd ? radius : 0,
                                  marginLeft: isStart ? 4 : 0,
                                  marginRight: isEnd ? 4 : 0,
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
              theme={
                {
                  calendarBackground: "transparent",
                  textSectionTitleColor: theme["--color-muted-foreground"],
                  // todayTextColor: theme["--color-red-primary"],
                  // textSectionTitleColor: theme["--color-foreground"],
                  // textDisabledColor: theme["--color-muted-foreground"],
                  // dayTextColor: theme["--color-foreground"],
                  // disabledTextColor: theme["--color-muted-foreground"],
                  // // Target class names for advanced styling
                  // "stylesheet.day.basic": {
                  //   base: {
                  //     width: 48,
                  //     height: 48,
                  //     borderRadius: 12,
                  //   },
                  //   today: {
                  //     borderRadius: 12,
                  //   },
                  //   selected: {
                  //     borderRadius: 12,
                  //   },
                  //   text: {
                  //     textAlign: "center",
                  //     color: theme["--color-foreground"],
                  //   },
                  // },
                }
              }
            />
          </View>

          <View className="flex-1 px-4">
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
                      />
                    </View>
                  )}
                />
              )
            }
          </View >
        </View >
      </ScrollView>
    </ThemedSafeView >
  );
}