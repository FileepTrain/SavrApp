/* 
 * Basic button UI component with customizable styles and icons.
 * For advanced button styling, use the native components.
*/

import {
  Text,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import React from "react";
import { IconSymbol, type MaterialIconName } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { twMerge } from "tailwind-merge";

const variants = {
  // Light red theme
  default: { background: "bg-red-secondary", text: "text-foreground" },
  // Destructive red theme
  destructive: { background: "bg-red-primary", text: "text-white" },
  // Neutral theme
  primary: { background: "bg-background", text: "text-foreground" },
  // Muted theme
  muted: { background: "bg-muted-background", text: "text-muted-foreground" },
  // Outline theme
  outline: { background: "bg-background border border-muted-background", text: "text-foreground" },
  // Outline destructive theme
  "outline-destructive": {
    background: "bg-white border border-red-secondary",
    text: "text-red-secondary",
  },
};

const sizes = {
  default: "h-12 px-4 py-2",
  lg: "h-14 px-4 py-3",
  sm: "h-10 px-2 py-1",
};

interface ButtonProps extends Omit<PressableProps, "style"> {
  className?: string;
  textClassName?: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** When true, fills label and surface colors from the theme palette so the button reads correctly inside a RN Modal on web. */
  portalSafe?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  icon?: {
    name: MaterialIconName;
    position?: "left" | "right";
    size?: number;
    color?: string;
  };
}

function portalSurfaceStyle(
  variant: keyof typeof variants,
  theme: ReturnType<typeof useThemePalette>,
): StyleProp<ViewStyle> {
  switch (variant) {
    case "default":
      return { backgroundColor: theme["--color-red-secondary"] };
    case "destructive":
      return { backgroundColor: theme["--color-red-primary"] };
    case "primary":
      return { backgroundColor: theme["--color-background"] };
    case "muted":
      return { backgroundColor: theme["--color-muted-background"] };
    case "outline":
      return {
        backgroundColor: theme["--color-background"],
        borderWidth: 1,
        borderColor: theme["--color-muted-background"],
      };
    case "outline-destructive":
      return {
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: theme["--color-red-secondary"],
      };
    default:
      return undefined;
  }
}

function portalLabelColor(
  variant: keyof typeof variants,
  theme: ReturnType<typeof useThemePalette>,
): string | undefined {
  switch (variant) {
    case "default":
      return theme["--color-foreground"];
    case "destructive":
      return "#ffffff";
    case "primary":
      return theme["--color-foreground"];
    case "muted":
      return theme["--color-muted-foreground"];
    case "outline":
      return theme["--color-foreground"];
    case "outline-destructive":
      return theme["--color-red-secondary"];
    default:
      return undefined;
  }
}
const Button = ({
  className,
  textClassName,
  variant = "default",
  size = "default",
  portalSafe = false,
  children,
  icon, // Icon props
  style,
  ...pressableProps // onPress, onLongPress, etc.
}: ButtonProps) => {
  const theme = useThemePalette();
  const labelColor = portalSafe ? portalLabelColor(variant, theme) : undefined;
  const surfaceStyle = portalSafe ? portalSurfaceStyle(variant, theme) : undefined;

  const labelText =
    typeof children === "string" || typeof children === "number" ? (
      <Text
        className={twMerge(variants[variant].text, textClassName)}
        style={labelColor ? { color: labelColor } : undefined}
      >
        {children}
      </Text>
    ) : (
      children
    );

  const rowClass = icon
    ? icon.position === "left"
      ? "flex-row-reverse gap-2"
      : icon.position === "right"
        ? "flex-row gap-2"
        : "flex-row"
    : "flex-row items-center justify-center";

  return (
    <Pressable
      className={twMerge(
        "rounded-xl justify-center items-center overflow-hidden",
        variants[variant].background,
        sizes[size],
        className
      )}
      style={[surfaceStyle, style]}
      {...pressableProps}
    >
      <View className={twMerge("items-center justify-center", rowClass)}>
        {labelText}
        {icon ? (
          <IconSymbol
            name={icon.name}
            size={icon.size ?? 20}
            color={
              icon.color
                ? theme[icon.color as keyof typeof theme] ?? icon.color
                : theme["--color-foreground"]
            }
          />
        ) : null}
      </View>
    </Pressable>
  );
};

export default Button;
