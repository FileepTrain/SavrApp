import { PropsWithChildren, createContext, useContext, useMemo } from "react";
import { View, ViewProps } from "react-native";
import { useColorScheme } from "nativewind";

import { ThemeName, themes, palettes } from "@/theme";

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

  // Get the raw CSS values (--color-*) for the current theme
  const palette = useMemo(
    () => palettes[name][colorScheme],
    [colorScheme, name]
  );
  // Get the CSS variables (vars(--color-*)) for the current theme
  const theme = useMemo(() => themes[name][colorScheme], [colorScheme, name]);

  return (
    <ThemePaletteContext.Provider value={palette}>
      {/* Provide the CSS variables for the current theme for all child components to use */}
      <View style={[theme, style]} {...rest}>
        {children}
      </View>
    </ThemePaletteContext.Provider>
  );
}
