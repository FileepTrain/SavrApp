import { vars } from "nativewind";

// tailwind.config.js references the palette's CSS variables for semantic class names
const lightPalette = {
  "--color-background": "#ffffff",
  "--color-foreground": "#11181c",
  "--color-app-background": "#f5e7e8",
  "--color-accent": "#0a7ea4",
  "--color-icon": "#687076",
  "--color-muted-background": "#f2f2f2",
  "--color-muted-foreground": "#49454f",
  "--color-red-primary": "#ff0000",
  "--color-red-secondary": "#ffb1b2",
};

const darkPalette = {
  "--color-background": "#151718",
  "--color-foreground": "#ecedee",
  "--color-app-background": "#875457",
  "--color-accent": "#ffffff",
  "--color-icon": "#9ba1a6",
  "--color-muted-background": "#f2f2f2",
  "--color-muted-foreground": "#312e36",
  "--color-red-primary": "#ab2222",
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
