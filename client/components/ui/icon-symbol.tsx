import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

/**
 * An icon component that uses Material Icons across all platforms.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
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
  return <MaterialIcons color={color} size={size} name={name} style={style} />;
}
