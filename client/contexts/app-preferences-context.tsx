import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";

type ThemePreference = "light" | "dark" | "system";

type AppPreferences = {
  themePreference: ThemePreference;
  textSize: number;
};

type AppPreferencesContextValue = AppPreferences & {
  setThemePreference: (value: ThemePreference) => void;
  setTextSize: (value: number) => void;
};

const STORAGE_KEY = "APP_PREFERENCES";

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(
  undefined
);

export const AppPreferencesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { setColorScheme } = useColorScheme();
  const [preferences, setPreferences] = useState<AppPreferences>({
    themePreference: "system",
    textSize: 3,
  });

  const applyThemePreference = (value: ThemePreference) => {
    if (value === "system") {
      // Let NativeWind follow the system theme
      setColorScheme("system" as any);
    } else {
      setColorScheme(value);
    }
  };

  const applyPreferences = (next: AppPreferences) => {
    setPreferences(next);
    applyThemePreference(next.themePreference);
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        // Load preferences from AsyncStorage
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<AppPreferences>;
          const theme =
            parsed.themePreference === "light" ||
              parsed.themePreference === "dark" ||
              parsed.themePreference === "system"
              ? parsed.themePreference
              : "system";
          const textSize =
            typeof parsed.textSize === "number" && !Number.isNaN(parsed.textSize)
              ? parsed.textSize
              : 3;

          const next: AppPreferences = { themePreference: theme, textSize };
          applyPreferences(next);
          return;
        }
      } catch {
        // Default values if no preferences are found
        applyPreferences({ themePreference: "system", textSize: 3 });
      }
    };

    loadPreferences();
  }, []);

  const persistPreferences = async (next: AppPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors for now
    }
  };

  const setThemePreference = (value: ThemePreference) => {
    const next: AppPreferences = { ...preferences, themePreference: value };
    applyPreferences(next);
    void persistPreferences(next);
  };

  const setTextSize = (value: number) => {
    const next: AppPreferences = { ...preferences, textSize: value };
    setPreferences(next);
    void persistPreferences(next);
  };

  return (
    <AppPreferencesContext.Provider
      value={{
        themePreference: preferences.themePreference,
        textSize: preferences.textSize,
        setThemePreference,
        setTextSize,
      }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
};

export const useAppPreferences = () => {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error("useAppPreferences must be used within an AppPreferencesProvider");
  }
  return ctx;
};

