import { useRecipeWebColumnWidth } from "@/hooks/use-recipe-web-column-width";
import React, { useMemo } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";

/** Readable max width for email/password forms on wide web (below recipe column cap). */
const AUTH_FORM_MAX_WIDTH = 420;

function useAuthFormMaxWidth(): number | undefined {
  const column = useRecipeWebColumnWidth();
  return useMemo(() => {
    if (column == null) return undefined;
    return Math.min(column, AUTH_FORM_MAX_WIDTH);
  }, [column]);
}

type AuthFormScrollProps = {
  children: React.ReactNode;
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
};

/**
 * Centers auth content horizontally and caps form width on desktop web so inputs
 * do not span the full viewport.
 */
export function AuthFormScroll({
  children,
  keyboardShouldPersistTaps = "handled",
}: AuthFormScrollProps) {
  const maxWidth = useAuthFormMaxWidth();

  return (
    <ScrollView
      className="w-full flex-1"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 32,
      }}
    >
      <View
        className="w-full items-center"
        style={maxWidth != null ? { maxWidth } : undefined}
      >
        {children}
      </View>
    </ScrollView>
  );
}
