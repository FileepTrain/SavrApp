import { useAccountWebColumnWidth } from "@/hooks/use-account-web-column-width";
import { useWebDesktopLayout } from "@/hooks/use-web-desktop-layout";
import React, { useMemo } from "react";
import { View } from "react-native";

type AccountWebColumnProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * Desktop web only: use this as the max column width instead of the default (~768).
   * Still never wider than the toolbar content area.
   */
  desktopMaxWidth?: number;
};

/** Centers and caps width on desktop web; no-op on native / narrow web. */
export function AccountWebColumn({ children, className, desktopMaxWidth }: AccountWebColumnProps) {
  const { isWebDesktop, contentWidth } = useWebDesktopLayout();
  const defaultMax = useAccountWebColumnWidth();
  const maxW = useMemo(() => {
    if (!isWebDesktop) return undefined;
    const upper = Math.max(280, contentWidth - 48);
    if (desktopMaxWidth != null) {
      return Math.min(desktopMaxWidth, upper);
    }
    return defaultMax;
  }, [isWebDesktop, contentWidth, desktopMaxWidth, defaultMax]);

  return (
    <View
      className={`w-full self-center ${className ?? ""}`}
      style={{ maxWidth: maxW ?? undefined }}
    >
      {children}
    </View>
  );
}
