import { ThemedSafeView } from "@/components/themed-safe-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { loadUserCookware, saveUserCookware } from "@/utils/cookware";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from "react-native";

const ALL_COOKWARE = [
  "skimmer",
  "pie form",
  "glass baking pan",
  "garlic press",
  "meat grinder",
  "tongs",
  "bread knife",
  "tajine pot",
  "wire rack",
  "mincing knife",
  "cherry pitter",
  "wooden skewers",
  "kitchen scissors",
  "blow torch",
  "broiler pan",
  "heart shaped silicone form",
  "grill",
  "immersion blender",
  "baking sheet",
  "oven mitt",
  "pastry bag",
  "palette knife",
  "pizza cutter",
  "bottle opener",
  "bowl",
  "pizza pan",
  "candy thermometer",
  "rolling pin",
  "frying pan",
  "casserole dish",
  "plastic wrap",
  "salad spinner",
  "broiler",
  "silicone muffin tray",
  "meat tenderizer",
  "edible cake image",
  "measuring spoon",
  "kitchen thermometer",
  "sifter",
  "muffin tray",
  "chocolate mold",
  "kitchen towels",
  "potato ricer",
  "silicone kugelhopf pan",
  "offset spatula",
  "cheesecloth",
  "lemon squeezer",
  "cake form",
  "mini muffin tray",
  "carving fork",
  "egg slicer",
  "ice cube tray",
  "corkscrew",
  "ice cream machine",
  "sieve",
  "kugelhopf pan",
  "pastry brush",
  "popsicle sticks",
  "spatula",
  "cake server",
  "poultry shears",
  "box grater",
  "cupcake toppers",
  "funnel",
  "drinking straws",
  "slotted spoon",
  "ceramic pie form",
  "pepper grinder",
  "mortar and pestle",
  "baster",
  "melon baller",
  "zester",
  "pastry cutter",
  "ziploc bags",
  "aluminum foil",
  "toothpicks",
  "pot",
  "baking pan",
  "ladle",
  "apple cutter",
  "fillet knife",
  "toaster",
  "heart shaped cake form",
  "grill pan",
  "wooden spoon",
  "paper towels",
  "cookie cutter",
  "tart form",
  "pizza board",
  "glass casserole dish",
  "madeleine form",
  "metal skewers",
  "microplane",
  "stand mixer",
  "whisk",
  "mixing bowl",
  "deep fryer",
  "canning jar",
  "cheese knife",
  "hand mixer",
  "butter curler",
  "food processor",
  "wax paper",
  "grater",
  "gravy boat",
  "muffin liners",
  "butter knife",
  "waffle iron",
  "double boiler",
  "can opener",
  "mandoline",
  "kitchen twine",
  "juicer",
  "wok",
  "measuring cup",
  "ramekin",
  "airfryer",
  "instant pot",
  "spoon",
  "dough scraper",
  "microwave",
  "roasting pan",
  "pressure cooker",
  "dehydrator",
  "baking paper",
  "silicone muffin liners",
  "loaf pan",
  "cake topper",
  "dutch oven",
  "baking spatula",
  "popsicle molds",
  "teapot",
  "cocktail sticks",
  "cleaver",
  "rice cooker",
  "bread machine",
  "fork",
  "ice cream scoop",
  "slow cooker",
  "knife",
  "kitchen scale",
  "griddle",
  "frosting cake topper",
  "cutting board",
  "cake pop mold",
  "oven",
  "colander",
  "kitchen timer",
  "panini press",
  "pasta machine",
  "popcorn maker",
  "lollipop sticks",
  "steamer basket",
  "chopsticks",
  "chefs knife",
  "blender",
  "pizza stone",
  "skewers",
  "sauce pan",
  "peeler",
  "stove",
  "pot holder",
  "springform pan",
  "apple corer",
  "potato masher",
  "serrated knife",
];

export default function CookwareSettingsPage() {
  const [selectedCookware, setSelectedCookware] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const saved = await loadUserCookware();
      setSelectedCookware(saved);
      setIsLoading(false);
    };
    load();
  }, []);

  const toggleCookware = async (item: string) => {
    const updated = new Set(selectedCookware);
    if (updated.has(item)) {
      updated.delete(item);
    } else {
      updated.add(item);
    }
    setSelectedCookware(updated);
    await saveUserCookware(updated);
  };

  const filteredCookware = ALL_COOKWARE.filter((item) =>
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ThemedSafeView className="flex-1 bg-[#F5E7E8]">
      {/* Search Bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="bg-white rounded-[12px] flex-row items-center px-4 h-12 shadow-sm">
          <IconSymbol name="magnify" size={20} color="#666666" />
          <TextInput
            className="flex-1 ml-3 text-[16px] text-black"
            placeholder="Search cookware..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <IconSymbol name="close" size={18} color="#666666" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats */}
      <View className="px-4 pb-3">
        <Text className="text-[14px] text-[#666666]">
          {selectedCookware.size} of {ALL_COOKWARE.length} cookware selected
        </Text>
      </View>

      {/* Cookware List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-[16px] text-[#666666]">Loading...</Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <View className="gap-2 pb-4">
            {filteredCookware.map((item) => {
              const isSelected = selectedCookware.has(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleCookware(item)}
                  className="bg-white rounded-[12px] flex-row items-center justify-between px-4 h-[56px] shadow-sm"
                >
                  <Text className="text-[16px] font-medium text-black flex-1">
                    {item}
                  </Text>
                  <View
                    className={`w-6 h-6 rounded-[6px] border-2 items-center justify-center ${
                      isSelected
                        ? "bg-red-primary border-red-primary"
                        : "border-[#CCCCCC] bg-white"
                    }`}
                  >
                    {isSelected && (
                      <Text className="text-white text-xs font-bold">✓</Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Quick Actions */}
      <View className="px-4 pb-4 pt-2 border-t border-[#E0E0E0]">
        <View className="flex-row gap-3">
          <Pressable
            onPress={async () => {
              const all = new Set(ALL_COOKWARE);
              setSelectedCookware(all);
              await saveUserCookware(all);
            }}
            className="flex-1 bg-white rounded-[12px] h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-[14px] font-medium text-black">
              Select All
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              const none = new Set<string>();
              setSelectedCookware(none);
              await saveUserCookware(none);
            }}
            className="flex-1 bg-white rounded-[12px] h-12 items-center justify-center shadow-sm"
          >
            <Text className="text-[14px] font-medium text-black">
              Clear All
            </Text>
          </Pressable>
        </View>
      </View>
    </ThemedSafeView>
  );
}
