import { vars } from "nativewind";

// tailwind.config.js references the palette's CSS variables for semantic class names
const lightPalette = {
  "--color-background": "#ffffff",
  "--color-foreground": "#11181c",
  "--color-app-background": "#f5e7e8",
  "--color-accent": "#0a7ea4",
  "--color-icon": "#687076",
  "--color-muted-background": "#e0e0e0",
  "--color-muted-foreground": "#49454f",
  "--color-red-primary": "#eb2d2d",
  "--color-red-secondary": "#ffb1b2",
};

const darkPalette = {
  "--color-background": "#383333",
  "--color-foreground": "#ecedee",
  // "--color-app-background": "#875457",
  "--color-app-background": "#6B3C3C",
  "--color-accent": "#ffffff",
  "--color-icon": "#9ba1a6",
  "--color-muted-background": "#7A6E6E",
  "--color-muted-foreground": "#b5b3b3",
  "--color-red-primary": "#CC4141",
  "--color-red-secondary": "#c7797a",
};

export const palettes = {
  brand: {
    light: lightPalette,
    dark: darkPalette,
  },
} as const;

export const themes = {
  brand: {
    light: vars(lightPalette),
    dark: vars(darkPalette),
  },
} as const;

export type ThemeName = keyof typeof palettes;
