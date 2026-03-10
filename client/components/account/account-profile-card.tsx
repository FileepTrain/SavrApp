// components/account/account-profile-card.tsx
import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Text, View } from "react-native";

type Props = {
  name: string;
  email: string;
};

export function AccountProfileCard({ name, email }: Props) {
  return (
    <View className="mt-6 mx-4 flex-row items-center bg-background rounded-xl px-4 py-4 shadow-sm">
      <View className="w-[60px] h-[60px] rounded-full bg-red-secondary items-center justify-center">
        <IconSymbol name="account-outline" size={32} color="--color-background" />
      </View>

      <View className="ml-4">
        <Text className="text-[18px] font-bold tracking-[0.5px] text-foreground">
          {name}
        </Text>
        <Text className="text-[14px] text-muted-foreground tracking-[0.5px]">
          {email}
        </Text>
      </View>
    </View>
  );
}
