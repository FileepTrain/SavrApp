/* 
 * Basic button UI component with customizable styles and icons.
 * For advanced button styling, use the native components.
*/

import {
  Text,
  Pressable,
  View,
  type PressableProps,
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
  children?: React.ReactNode;
  icon?: {
    name: MaterialIconName;
    position?: "left" | "right";
    size?: number;
    color?: string;
  };
}
const Button = ({
  className,
  textClassName,
  variant = "default",
  size = "default",
  children,
  icon, // Icon props
  ...pressableProps // onPress, onLongPress, etc.
}: ButtonProps) => {
  const theme = useThemePalette();

  return (
    <Pressable
      className={twMerge(
        "rounded-xl justify-center items-center",
        variants[variant].background,
        sizes[size],
        className
      )}
      {...pressableProps}
    >
      <View
        className={twMerge(
          "items-center",
          icon?.position === "left" ? "flex-row-reverse gap-2" : icon?.position === "right" ? "flex-row gap-2" : "flex-row"
        )}
      >
        <Text className={twMerge(variants[variant].text, textClassName)}>{children}</Text>
        {icon && (
          <IconSymbol name={icon.name} size={icon.size ?? 20}
            color={
              icon.color
                ? theme[icon.color as keyof typeof theme] ?? icon.color
                : theme["--color-foreground"]
            }
          />
        )}
      </View>
    </Pressable>
  );
};

export default Button;
