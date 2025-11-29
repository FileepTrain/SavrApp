import {
  Text,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from "react-native";
import React from "react";
import { IconSymbol, type MaterialIconName } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";

const variants = {
  default: { background: "bg-red-secondary", text: "text-foreground" },
  muted: { background: "bg-muted-background", text: "text-muted-foreground" },
};

const sizes = {
  default: "h-12 px-4 py-2",
  lg: "h-14 px-4 py-3",
  sm: "h-10 px-2 py-1",
};

interface ButtonProps extends Omit<TouchableOpacityProps, "style"> {
  className?: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  children?: React.ReactNode;
  iconName?: MaterialIconName;
  iconPosition?: "left" | "right";
  iconSize?: number;
}
const Button = ({
  className,
  variant = "default",
  size = "default",
  children,
  iconName,
  iconPosition = "left",
  ...touchableProps
}: ButtonProps) => {
  const theme = useThemePalette();

  return (
    <TouchableOpacity
      className={`rounded-full justify-center items-center ${variants[variant].background} ${sizes[size]} ${className ?? ""}`}
      {...touchableProps}
    >
      <View
        className={`items-center ${iconPosition === "left" ? "flex-row-reverse" : "flex-row"} ${iconName ? "" : "gap-2"}`}
      >
        <Text className={variants[variant].text}>{children}</Text>
        {iconName && (
          <IconSymbol name={iconName} size={20} color={theme["--color-icon"]} />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default Button;
