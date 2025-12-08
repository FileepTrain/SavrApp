// components/account/account-menu-item.tsx
import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Pressable, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle: string;
  iconName: string;
  onPress?: () => void;
  isLast?: boolean;
};

export function AccountMenuItem({
  title,
  subtitle,
  iconName,
  onPress,
  isLast,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 h-[77px] bg-white ${
        isLast ? "" : "border-b border-[#F2F2F2]"
      }`}
    >
      {/* left side */}
      <View className="flex-row items-center gap-4">
        <View className="w-10 h-10 rounded-[10px] bg-[#F2F2F2] items-center justify-center">
          <IconSymbol name={iconName as any} size={20} color="#666666" />
        </View>

        <View className="gap-0.5">
          <Text className="text-[16px] font-medium tracking-[0.5px] text-black">
            {title}
          </Text>
          <Text className="text-[12px] text-[#666666] tracking-[0.5px]">
            {subtitle}
          </Text>
        </View>
      </View>

      {/* right chevron */}
      <IconSymbol name="chevron-right" size={20} color="#666666" />
    </Pressable>
  );
}
