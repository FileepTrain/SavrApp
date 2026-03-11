import { View, Text, Pressable } from 'react-native'
import React from 'react'
import { twMerge } from 'tailwind-merge'

const RadioButton = ({ label, selected, onPress, layout = "row" }: { label: string, selected: boolean, onPress: () => void, layout?: "row" | "column" }) => {
  return (
    <Pressable
      onPress={onPress}
      className={twMerge("items-center gap-2", layout === "row" ? "flex-row" : "flex-col")}
    >
      {selected ? (
        <View className="w-6 h-6 rounded-full border-2 border-red-secondary p-px">
          <View className="w-full h-full rounded-full bg-red-secondary" />
        </View>
      ) : (
        <View className="w-6 h-6 rounded-full border-2 border-muted-background" />
      )}
      <Text className="text-lg font-medium text-foreground">{label}</Text>
    </Pressable>
  )
}

export default RadioButton