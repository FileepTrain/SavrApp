// components/account/account-profile-card.tsx
import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Image, Pressable, Text, View } from "react-native";

type Props = {
  name: string;
  email: string;
  /** Signed profile photo URL from API (optional). */
  photoUrl?: string | null;
  onPress?: () => void;
};

export function AccountProfileCard({ name, email, photoUrl, onPress }: Props) {
  const showPhoto = typeof photoUrl === "string" && photoUrl.trim().length > 0;

  const avatar = showPhoto ? (
    <Image
      source={{ uri: photoUrl!.trim() }}
      style={{ width: 60, height: 60, borderRadius: 30 }}
      resizeMode="cover"
    />
  ) : (
    <View className="w-[60px] h-[60px] rounded-full bg-red-secondary items-center justify-center">
      <IconSymbol name="account-outline" size={32} color="--color-background" />
    </View>
  );

  const inner = (
    <>
      {avatar}
      <View className="ml-4 flex-1">
        <Text className="text-[18px] font-bold tracking-[0.5px] text-foreground">
          {name}
        </Text>
        <Text className="text-[14px] text-muted-foreground tracking-[0.5px]">
          {email}
        </Text>
      </View>
    </>
  );

  const shellClass =
    "mt-6 mx-4 flex-row items-center bg-background rounded-xl px-4 py-4 shadow-sm";

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={shellClass}
        accessibilityRole="button"
        accessibilityLabel="View your creator profile and recipes"
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        {inner}
      </Pressable>
    );
  }

  return <View className={shellClass}>{inner}</View>;
}
