import { PropsWithChildren, useState } from "react";
import { StyleSheet, TouchableOpacity, View, Text } from "react-native";
import { useThemePalette } from "@/components/theme-provider";
//import { ThemedText } from "@/components/themed-text";
//import { ThemedView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
//import { Colors } from "@/constants/theme";
//import { useColorScheme } from "@/hooks/use-color-scheme";


export function Collapsible({
  children,
  title,
}: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  //const theme = useColorScheme() ?? "light";
  const palette = useThemePalette();

  return (
    <View>
      <TouchableOpacity
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        activeOpacity={0.8}
        className="bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm mb-2"
      >
        <View className="flex-row items-center gap-2">
          <IconSymbol
            name="chevron-right"
            size={18}
            weight="medium"
            color="--color-icon"
            style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }}
          />
          <Text className="text-[16px] font-semibold text-black">
            {title}
          </Text>
        </View>
      </TouchableOpacity>

      {isOpen && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
});
