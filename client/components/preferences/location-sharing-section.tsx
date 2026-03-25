import React from "react";
import { Switch, Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface LocationSharingSectionProps {
  value: boolean;
  onChange: (next: boolean) => void;
}

export function LocationSharingSection({ value, onChange }: LocationSharingSectionProps) {
  return (
    <View className="gap-4 mt-2">
      <View className="rounded-xl shadow-sm overflow-hidden flex-row items-center justify-between px-4 h-[77px] bg-background">
        <View className="flex-row items-center gap-4">
          <View className="w-10 h-10 rounded-xl bg-muted-background items-center justify-center">
            <IconSymbol name="map-marker-outline" size={20} color="--color-foreground" />
          </View>
          <View className="gap-0.5">
            <Text className="text-[16px] font-medium tracking-[0.5px] text-foreground">
              Share Your Location
            </Text>
            <Text className="text-[12px] text-muted-foreground tracking-[0.5px]">
              Sharing is {value ? "enabled" : "disabled"}
            </Text>
          </View>
        </View>
        <Switch
          style={{ transform: [{ scaleX: 1.3 }, { scaleY: 1.3 }] }}
          trackColor={{ false: "#9c989e", true: "#2adb47" }}
          thumbColor="#ffffff"
          value={value}
          onValueChange={onChange}
        />
      </View>
    </View>
  );
}
