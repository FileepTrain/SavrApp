import { View, Text, TouchableOpacity } from 'react-native'
import React from 'react'
import { IconSymbol } from '@/components/ui/icon-symbol'
import { Ingredient } from '@/types/ingredient'

type SubstitutionEntry = {
  originalIngredient: { name: string; amount: number; unit: string; spoonacularId?: number };
  substituteIngredients: { name: string; amount: number; unit: string }[];
};

interface IngredientsListProps {
  list: Ingredient[];
  onRemove?: (index: number) => void;
  onSelectIngredient?: (ingredient: Ingredient) => void;
  substitutions?: SubstitutionEntry[];
}

function findSubstitution(item: Ingredient, substitutions: SubstitutionEntry[]): SubstitutionEntry | undefined {
  return substitutions.find((sub) => {
    if (item.spoonacularId != null && sub.originalIngredient.spoonacularId != null) {
      return item.spoonacularId === sub.originalIngredient.spoonacularId;
    }
    return item.name.toLowerCase() === sub.originalIngredient.name.toLowerCase();
  });
}

export function IngredientsList({ list, onRemove, onSelectIngredient, substitutions }: IngredientsListProps) {
  return (
    <View className="gap-1">
      {list.map((item: Ingredient, index: number) => {
        const substitution = substitutions ? findSubstitution(item, substitutions) : undefined;
        const substituteLabel = substitution
          ? substitution.substituteIngredients.map((p) => `${p.amount} ${p.unit} of ${p.name}`).join(' + ')
          : undefined;

        const row = (
          <View
            className={`flex-row items-center justify-between p-2${onSelectIngredient ? ' rounded-xl bg-muted-background' : ''}`}
          >
            <View className="flex-1 flex-row gap-2 items-start">
              <Text className="text-red-primary font-extrabold text-2xl leading-none">{'\u2022'}</Text>
              <View className="flex-1 gap-0.5">
                <Text
                  className="text-foreground font-medium"
                  style={substitution ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}
                >
                  {item.amount} {item.unit} of {item.name}
                </Text>
                {substituteLabel && (
                  <Text className="text-red-primary font-medium text-sm">
                    {substituteLabel}
                  </Text>
                )}
              </View>
            </View>
            {onRemove && (
              <TouchableOpacity onPress={() => onRemove?.(index)}>
                <IconSymbol name="close" size={20} color="--color-red-primary" />
              </TouchableOpacity>
            )}
            {onSelectIngredient && (
              <IconSymbol name="chevron-right" size={18} color="--color-muted-foreground" />
            )}
          </View>
        );

        if (onSelectIngredient) {
          return (
            <TouchableOpacity key={index} onPress={() => onSelectIngredient(item)} activeOpacity={0.7}>
              {row}
            </TouchableOpacity>
          );
        }
        return <View key={index}>{row}</View>;
      })}
    </View>
  )
}