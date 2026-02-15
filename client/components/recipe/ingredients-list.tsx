import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Ingredient } from '@/types/ingredient'

export function IngredientsList({ list, onRemove }: { list: Ingredient[], onRemove?: (index: number) => void }) {
  return (
    <View className="gap-1">
      {list.map((item: Ingredient, index: number) => (
        <View
          key={index}
          className="flex-row items-center justify-between p-2"
        >
          <View className="flex-1 flex-row gap-2 items-center">
            <Text className="text-red-primary font-extrabold text-2xl leading-none">{'\u2022'}</Text>
            <Text className="text-foreground font-medium">{item.amount} {item.unit} of {item.name}</Text>
          </View>
          {onRemove && (
            <TouchableOpacity onPress={() => onRemove?.(index)}>
              <IconSymbol name="close" size={20} color="--color-red-primary" />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  )
}