import { Text, View } from "react-native";
import { Switch } from "react-native";
import { useColorScheme } from "nativewind";
import { ThemedSafeView } from "@/components/themed-safe-view";
import Button from "@/components/ui/button";
import { router } from "expo-router";

export default function AccountPage() {
  const { colorScheme, setColorScheme } = useColorScheme();

  return (
    <ThemedSafeView>
      <Text className="text-foreground text-2xl font-semibold">Account</Text>

      <View className="flex-row items-center">
        <View className="flex-1">
          <Text className="text-foreground font-medium">toggle theme</Text>
        </View>

        <Switch
          value={colorScheme === "dark"}
          onValueChange={() =>
            setColorScheme(colorScheme === "dark" ? "light" : "dark")
          }
        />
      </View>
      <Text className="text-foreground text-xl font-semibold">
        {`Using ${colorScheme} mode`}
      </Text>

      <Button onPress={() => router.push("/sign-up")}>
        visit the sign up page for now
      </Button>
    </ThemedSafeView>
  );
}
