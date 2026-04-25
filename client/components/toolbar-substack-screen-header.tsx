import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAccountWebColumnWidth } from "@/hooks/use-account-web-column-width";
import { useRecipeWebColumnWidth } from "@/hooks/use-recipe-web-column-width";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Matches `ThemedSafeView` default horizontal padding (`px-6`). */
const TOOLBAR_SUBSTACK_OUTER_PAD = 24;
/** Matches account home title wrapper / `AccountSubpageBody` horizontal inset (`px-4` / `mx-4`). */
const TOOLBAR_SUBSTACK_INNER_PAD = 16;

export type ToolbarSubstackColumnVariant = "account" | "recipe";

export type ToolbarSubstackScreenHeaderProps = NativeStackHeaderProps & {
  /** When set, used instead of `navigation.goBack()` (e.g. account stack profile routing). */
  onPressBack?: () => void;
  /**
   * `account`: same max width as `AccountWebColumn` + inner inset for subpages.
   * `recipe`: same max width as recipe nutrition/reviews (`useRecipeWebColumnWidth`), flush inner title.
   */
  columnVariant?: ToolbarSubstackColumnVariant;
};

/**
 * Header for nested stacks (toolbar tabs, recipe, profile, etc.).
 * Do not add sidebar width here — tab content already sits to the right of `ToolbarWebSidebar`.
 */
export function ToolbarSubstackScreenHeader({
  navigation,
  options,
  onPressBack,
  columnVariant = "account",
}: ToolbarSubstackScreenHeaderProps) {
  const { isWebDesktop } = useWebDesktopLayout();
  const accountColumnMax = useAccountWebColumnWidth();
  const recipeColumnMax = useRecipeWebColumnWidth();
  const maxColumn = columnVariant === "recipe" ? recipeColumnMax : accountColumnMax;
  const innerHorizontalPad = columnVariant === "recipe" ? 0 : TOOLBAR_SUBSTACK_INNER_PAD;

  const handleBack = onPressBack ?? (() => navigation.goBack());

  return (
    <SafeAreaView
      className="bg-app-background pt-7"
      style={{
        width: "100%",
        paddingHorizontal: TOOLBAR_SUBSTACK_OUTER_PAD,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: maxColumn ?? undefined,
          alignSelf: maxColumn != null ? "center" : undefined,
        }}
      >
        <View
          className="flex-row items-center min-h-[52px]"
          style={{ paddingHorizontal: innerHorizontalPad }}
        >
          {!isWebDesktop ? (
            <TouchableOpacity onPress={handleBack} className="mr-3">
              <IconSymbol name="chevron-left" size={30} color="--color-foreground" />
            </TouchableOpacity>
          ) : null}
          <Text className="flex-1 text-2xl font-semibold text-foreground" numberOfLines={1}>
            {options.title ?? ""}
          </Text>
          <View className="flex-row items-center justify-end min-w-10">
            {typeof options.headerRight === "function"
              ? options.headerRight({
                  tintColor: undefined,
                  canGoBack: navigation.canGoBack(),
                })
              : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
