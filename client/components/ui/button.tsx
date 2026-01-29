/* 
 * Basic button UI component with customizable styles and icons.
 * For advanced button styling, use the native components.
*/

import {
  Text,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from "react-native";
import React from "react";
import { IconSymbol, type MaterialIconName } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { twMerge } from "tailwind-merge";

const variants = {
  // Red theme
  default: { background: "bg-red-secondary", text: "text-foreground" },
  // Neutral theme
  primary: { background: "bg-background", text: "text-foreground" },
  // Muted theme
  muted: { background: "bg-muted-background", text: "text-muted-foreground" },
};

const sizes = {
  default: "h-12 px-4 py-2",
  lg: "h-14 px-4 py-3",
  sm: "h-10 px-2 py-1",
};

interface ButtonProps extends Omit<TouchableOpacityProps, "style"> {
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
  ...touchableProps // onPress, onLongPress, etc.
}: ButtonProps) => {
  const theme = useThemePalette();

  return (
    <TouchableOpacity
      className={twMerge(
        "rounded-full justify-center items-center",
        variants[variant].background,
        sizes[size],
        className
      )}
      {...touchableProps}
    >
      <View
        className={twMerge(
          "items-center",
          icon?.position === "left" ? "flex-row-reverse gap-2" : icon?.position === "right" ? "flex-row gap-2" : "flex-row"
        )}
      >
        <Text className={twMerge(variants[variant].text, textClassName)}>{children}</Text>
        {icon && (
          <IconSymbol name={icon.name} size={icon.size ?? 20} color={theme[icon.color as keyof typeof theme]} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default Button;
