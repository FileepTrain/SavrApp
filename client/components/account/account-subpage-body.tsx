import React from "react";
import { Platform, View } from "react-native";
import { twMerge } from "tailwind-merge";

type AccountSubpageBodyProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Horizontal inset (`mx-4`) + flex shell so sub-pages line up with the account home
 * profile card and menu list (`AccountProfileCard` / `AccountMenuItem` use `mx-4`).
 */
export function AccountSubpageBody({ children, className }: AccountSubpageBodyProps) {
  const base = Platform.OS === "web" ? "mx-4 flex-1 min-h-0" : "flex-1 min-h-0";
  return <View className={twMerge(base, className)}>{children}</View>;
}

/** Total horizontal shrink from `AccountSubpageBody` (`mx-4` × 2). */
export const ACCOUNT_SUBPAGE_BODY_H_INSET = 32;

/** Section headings (e.g. Settings groups) — matches `AccountMenuItem` subtitle scale. */
export const accountSectionLabelClassName = Platform.OS === "web"
  ? "text-[12px] font-medium tracking-[0.5px] text-muted-foreground"
  : "text-base font-medium text-muted-foreground";

/** Empty / helper copy on account list screens. */
export const accountEmptyStateClassName = Platform.OS === "web"
  ? "text-center text-[14px] text-muted-foreground tracking-[0.5px]"
  : "text-center text-muted-foreground";

/** Primary list-page CTA — matches `AccountMenuItem` title weight. */
export const accountPrimaryCtaTextClassName = Platform.OS === "web"
  ? "text-[16px] font-medium tracking-[0.5px] text-red-primary"
  : "text-lg font-medium text-red-primary";

/** Same shell as account home menu / profile: `rounded-xl shadow-sm bg-background`. */
export const accountCardShellClassName = "rounded-xl shadow-sm overflow-hidden bg-background";
