import AsyncStorage from "@react-native-async-storage/async-storage";

const COOKWARE_STORAGE_KEY = "USER_COOKWARE";

/** All cookware options (same list as cookware-settings); use ALL_COOKWARE_SORTED for display */
export const ALL_COOKWARE = [
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

/** Sorted alphabetically for display */
export const ALL_COOKWARE_SORTED = [...ALL_COOKWARE].sort((a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" }),
);
const SERVER_URL = "http://10.0.2.2:3000"; // Adjust if needed

/**
 * Load user's cookware preferences from server (with AsyncStorage fallback)
 */
export async function loadUserCookware(): Promise<Set<string>> {
  try {
    const idToken = await AsyncStorage.getItem("idToken");

    // Try to fetch from server first if user is logged in
    if (idToken) {
      try {
        const response = await fetch(
          `${SERVER_URL}/api/auth/get-preferences?fields=cookware`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.cookware)) {
            const cookwareSet = new Set(data.cookware) as Set<string>;
            // Also cache locally
            await AsyncStorage.setItem(
              COOKWARE_STORAGE_KEY,
              JSON.stringify(data.cookware),
            );
            return cookwareSet;
          }
        }
      } catch (serverError) {
        console.warn(
          "Failed to fetch cookware from server, using local cache:",
          serverError,
        );
      }
    }

    // Fallback to local storage
    const stored = await AsyncStorage.getItem(COOKWARE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(Array.isArray(parsed) ? parsed : []);
    }
  } catch (error) {
    console.error("Error loading cookware:", error);
  }
  return new Set();
}

/**
 * Save user's cookware preferences to server and AsyncStorage
 */
export async function saveUserCookware(cookware: Set<string>): Promise<void> {
  const cookwareArray = Array.from(cookware);

  // Save to local storage immediately for offline support
  try {
    await AsyncStorage.setItem(
      COOKWARE_STORAGE_KEY,
      JSON.stringify(cookwareArray),
    );
  } catch (error) {
    console.error("Error saving cookware to local storage:", error);
  }

  // Sync to server if user is logged in
  try {
    const idToken = await AsyncStorage.getItem("idToken");
    if (idToken) {
      const response = await fetch(
        `${SERVER_URL}/api/auth/update-preferences`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cookware: cookwareArray }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to sync cookware to server:", errorData);
        // Don't throw - local save succeeded
      }
    }
  } catch (error) {
    console.error("Error syncing cookware to server:", error);
    // Don't throw - local save succeeded
  }
}

/**
 * Check if user has all required cookware for a recipe
 */
export async function hasRequiredCookware(
  requiredCookware: Array<{ name: string }>,
): Promise<boolean> {
  const userCookware = await loadUserCookware();
  if (userCookware.size === 0) {
    // If user hasn't set up cookware, assume they have everything
    return true;
  }
  return requiredCookware.every((item) =>
    userCookware.has(item.name.toLowerCase()),
  );
}
