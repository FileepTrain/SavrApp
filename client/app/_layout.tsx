import { Stack } from "expo-router";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import "@/global.css";

import { ThemeProvider } from "@/components/theme-provider";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const [fontsLoaded, error] = useFonts({
    Roboto: require("@/assets/fonts/Roboto-Regular.ttf"),
    "Roboto-Medium": require("@/assets/fonts/Roboto-Medium.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) return null;

  return (
    <ThemeProvider className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(toolbar)" />
        <Stack.Screen name="(auth)" />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "auto"} />
    </ThemeProvider>
  );
}
