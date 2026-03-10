import { PropsWithChildren, createContext, useContext, useMemo } from "react";
import { View, ViewProps } from "react-native";
import { useColorScheme, vars } from "nativewind";

import { ThemeName, themes, palettes } from "@/theme";
import { useAppPreferences } from "../contexts/app-preferences-context";

type ThemeProviderProps = PropsWithChildren<
  ViewProps & {
    name?: ThemeName;
  }
>;

type Palette = (typeof palettes)[ThemeName]["light"];

const ThemePaletteContext = createContext<Palette>(palettes.brand.light);

export function useThemePalette() {
  // Get the raw CSS values (--color-*) for the current theme
  return useContext(ThemePaletteContext);
}

export function ThemeProvider({
  name = "brand",
  style,
  children,
  ...rest
}: ThemeProviderProps) {
  const { colorScheme = "light" } = useColorScheme(); // Get the current theme from the system
  const { textSize } = useAppPreferences();

  const fontScale = useMemo(() => {
    switch (textSize) {
      case 1:
        return -2;
      case 2:
        return -1;
      case 3:
        return 0;
      case 4:
        return 1;
      case 5:
        return 2;
      default:
        return 0;
    }
  }, [textSize]);

  // Get the raw CSS values (--color-*) for the current theme
  const palette = useMemo(
    () => palettes[name][colorScheme],
    [colorScheme, name]
  );
  // Get the CSS variables (vars(--color-*)) for the current theme
  const theme = useMemo(() => themes[name][colorScheme], [colorScheme, name]);

  const fontVars = useMemo(
    () =>
      vars({
        "--font-size-xs": `${12 + fontScale}px`,
        "--font-size-sm": `${14 + fontScale}px`,
        "--font-size-base": `${16 + fontScale}px`,
        "--font-size-lg": `${18 + fontScale}px`,
        "--font-size-xl": `${22 + fontScale}px`,
        "--font-size-2xl": `${26 + fontScale}px`,
      }),
    [fontScale]
  );

  return (
    <ThemePaletteContext.Provider value={palette}>
      {/* Provide the CSS variables for the current theme for all child components to use */}
      <View style={[theme, fontVars, style]} {...rest}>
        {children}
      </View>
    </ThemePaletteContext.Provider>
  );
}
