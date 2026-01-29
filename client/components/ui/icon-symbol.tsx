import { MaterialCommunityIcons } from "@expo/vector-icons/";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";
import { useThemePalette } from "@/components/theme-provider";
import { useTheme } from "@react-navigation/native";

export type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * An icon component that uses Material Icons across all platforms.
 * - see Material Community Icons in the [Icons Directory](https://icons.expo.fyi).
 */

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: MaterialIconName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useThemePalette();

  return <MaterialCommunityIcons color={theme[color as keyof typeof theme] || color} size={size} name={name} style={style} />;
}
