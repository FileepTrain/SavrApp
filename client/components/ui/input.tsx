import {
  View,
  Text,
  TextInput,
  KeyboardTypeOptions,
  TextInputProps,
  Image,
} from "react-native";
import React, { useState } from "react";
import { TouchableOpacity } from "react-native";
import { IconSymbol, type MaterialIconName } from "@/components/ui/icon-symbol";
import { useThemePalette } from "@/components/theme-provider";
import { twMerge } from "tailwind-merge";

/**
 * Input component enables the user to input any form of text
 * @param className - Addtional classes for the container
 * @param inputClassName - Addtional classes for the input text
 * @param placeholder - The placeholder text for the input
 * @param inputType - The type of input - default (text, password, search), email-address, numeric, phone-pad, url, decimal-pad
 * @param label - The label text for the input, which is placed above the input container
 * @param error - The error text for the input
 * @param secureTextEntry - Inputs for password type will be hidden if true
 * @param iconName - The name of the optional icon to display inside the input container
 * @param touchableIcon - Makes the icon interactable, and should be paired with onPressIcon
 * @param onPressIcon - The handler function that is called when the icon is pressed
 */
interface InputProps extends Omit<TextInputProps, "keyboardType"> {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  inputType?: KeyboardTypeOptions | "password";
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  iconName?: MaterialIconName;
  touchableIcon?: boolean;
  onPressIcon?: () => void;
}

const Input = React.forwardRef<TextInput, InputProps>(
  (
    {
      className,
      inputClassName,
      placeholder,
      inputType = "text",
      label,
      error,
      iconName,
      touchableIcon = false,
      onPressIcon,
      ...inputProps
    },
    ref
  ) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const theme = useThemePalette();

    return (
      <View className={`${label ? "gap-2" : "gap-0"} ${className ?? ""}`}>
        <View className="flex-row justify-between">
          {label && (
            <Text className="text-foreground text-sm font-medium">{label}</Text>
          )}
          {error && <Text className="text-red-primary text-sm">{error}</Text>}
        </View>
        <View className="relative justify-center">
          <TextInput
            ref={ref}
            className={twMerge(
              "rounded-full px-5 text-foreground bg-muted-background",
              error && "border border-red-primary box-border",
              (inputType === "password" || iconName) && "pr-16",
              inputClassName
            )}
            placeholder={placeholder}
            placeholderTextColor="#9BA1A6"
            keyboardType={
              inputType === "password"
                ? "default"
                : (inputType as KeyboardTypeOptions)
            }
            secureTextEntry={inputType === "password" && !isPasswordVisible}
            {...inputProps}
          />

          {inputType === "password" ? (
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              className="absolute right-5 justify-center"
            >
              <IconSymbol
                size={20}
                name={isPasswordVisible ? "eye-outline" : "eye-off-outline"}
                color={theme["--color-icon"]}
              />
            </TouchableOpacity>
          ) : iconName && touchableIcon ? (
            <TouchableOpacity
              onPress={onPressIcon}
              className="absolute right-5 justify-center"
            >
              <IconSymbol
                size={20}
                name={iconName as MaterialIconName}
                color={theme["--color-icon"]}
              />
            </TouchableOpacity>
          ) : (
            iconName && (
              <View className="absolute right-5 justify-center">
                <IconSymbol
                  size={20}
                  name={iconName as MaterialIconName}
                  color={theme["--color-icon"]}
                />
              </View>
            )
          )}
        </View>
      </View>
    );
  }
);

Input.displayName = "Input";

export default Input;
