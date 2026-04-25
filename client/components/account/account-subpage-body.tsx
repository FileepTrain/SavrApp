import React from "react";
import { View } from "react-native";
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
  return <View className={twMerge("mx-4 flex-1 min-h-0", className)}>{children}</View>;
}

/** Total horizontal shrink from `AccountSubpageBody` (`mx-4` × 2). */
export const ACCOUNT_SUBPAGE_BODY_H_INSET = 32;

/** Section headings (e.g. Settings groups) — matches `AccountMenuItem` subtitle scale. */
export const accountSectionLabelClassName =
  "text-[12px] font-medium tracking-[0.5px] text-muted-foreground";

/** Empty / helper copy on account list screens. */
export const accountEmptyStateClassName =
  "text-center text-[14px] text-muted-foreground tracking-[0.5px]";

/** Primary list-page CTA — matches `AccountMenuItem` title weight. */
export const accountPrimaryCtaTextClassName =
  "text-[16px] font-medium tracking-[0.5px] text-red-primary";

/** Same shell as account home menu / profile: `rounded-xl shadow-sm bg-background`. */
export const accountCardShellClassName = "rounded-xl shadow-sm overflow-hidden bg-background";
