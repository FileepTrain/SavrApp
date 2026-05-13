import { logToolbarNavFlow, useToolbarPrimaryTabDoublePress } from "@/contexts/toolbar-history-context";
import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import React, { useCallback } from "react";
import type { GestureResponderEvent } from "react-native";

const PRIMARY_TAB_NAMES = new Set(["home", "calendar", "grocery-list", "account"]);

/** Tab bar buttons: history-aware press handling lives in `useToolbarPrimaryTabDoublePress` (toolbar-history-context). */
export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPress, onPressIn, ...rest } = props;
  const { handlePrimaryTabDoublePress } = useToolbarPrimaryTabDoublePress();

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      const name = props.route?.name;
      logToolbarNavFlow({
        kind: "haptic_tab",
        phase: "handlePress",
        routeName: name ?? null,
        isPrimaryTab: !!(name && PRIMARY_TAB_NAMES.has(name)),
        tabSelected: props.accessibilityState?.selected ?? null,
      });
      if (name && PRIMARY_TAB_NAMES.has(name)) {
        const isSelected = props.accessibilityState?.selected === true;
        logToolbarNavFlow({
          kind: "haptic_tab",
          phase: "invoke_handlePrimaryTabDoublePress",
          tab: name,
          isSelected,
        });
        handlePrimaryTabDoublePress(
          name as "home" | "calendar" | "grocery-list" | "account",
          isSelected,
          () => onPress?.(e),
        );
        logToolbarNavFlow({
          kind: "haptic_tab",
          phase: "returned_from_handlePrimaryTabDoublePress",
          tab: name,
        });
        return;
      }
      logToolbarNavFlow({
        kind: "haptic_tab",
        phase: "non_primary_pass_through",
        routeName: name ?? null,
      });
      onPress?.(e);
    },
    [
      handlePrimaryTabDoublePress,
      onPress,
      props.accessibilityState?.selected,
      props.route?.name,
    ],
  );

  return (
    <PlatformPressable
      {...rest}
      onPress={handlePress}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
    />
  );
}
