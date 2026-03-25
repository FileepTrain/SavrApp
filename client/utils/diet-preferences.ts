import AsyncStorage from "@react-native-async-storage/async-storage";

const SERVER_URL = "http://10.0.2.2:3000";

export const allergies = [
  "Gluten",
  "Egg",
  "Seafood",
  "Peanut",
  "Tree Nut",
  "Soy",
  "Sesame",
  "Wheat",
  "Grain",
  "Shellfish",
  "Dairy",
];

export const diets = [
  "Ketogenic",
  "Vegan",
  "Vegetarian",
  "Paleo",
  "Primal",
  "Low FODMAP",
  "Whole30",
  "Pescatarian",
  "Gluten Free",
];

export async function loadDiets(): Promise<Set<string>> {
  const idToken = await AsyncStorage.getItem("idToken");

  if (!idToken) return new Set();
  
  try {
    const response = await fetch(
      `${SERVER_URL}/api/auth/get-preferences?fields=diets`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn("Failed to load diets", await response.json());
    }
    
    const data = await response.json();
    if (data.success && Array.isArray(data.diets)) {
      const dietSet = new Set<string>(data.diets);
      await AsyncStorage.setItem(
        "diets",
        JSON.stringify(data.diets)
      );
      return dietSet;
    }
    
  } catch (e) {
    console.warn("Failed to load dietary preferences", e);
  }
  return new Set();
}
    
export async function loadAllergies(): Promise<Set<string>> {
  const idToken = await AsyncStorage.getItem("idToken");

  if (!idToken) return new Set();
  try {
    const response = await fetch(
      `${SERVER_URL}/api/auth/get-preferences?fields=allergies`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn("Failed to load allergies", await response.json());
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.allergies)) {
      const allergySet = new Set<string>(data.allergies);
      await AsyncStorage.setItem(
        "allergies",
        JSON.stringify(data.allergies)
      );
      return allergySet;
    }
    
  } catch (e) {
    console.warn("Failed to load allergies", e);
  }
  return new Set();
}

export async function saveDiets(diets: Set<string>): Promise<void> {
  const dietsArray = Array.from(diets);
  try {
    const idToken = await AsyncStorage.getItem("idToken");
    if (idToken) {
      const res = await fetch(`${SERVER_URL}/api/auth/update-preferences`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ diets: dietsArray }),
      });
      if (!res.ok) console.warn("Failed to save diets", await res.json());
    }
  } catch (e) {
    console.warn("Failed to save diets", e);
  }
}

export async function saveAllergies(allergies: Set<string>): Promise<void> {
    const allergiesArray = Array.from(allergies);
    try {
      const idToken = await AsyncStorage.getItem("idToken");
      if (idToken) {
        const res = await fetch(`${SERVER_URL}/api/auth/update-preferences`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ allergies: allergiesArray }),
        });
        if (!res.ok) console.warn("Failed to save allergies", await res.json());
      }
    } catch (e) {
      console.warn("Failed to save allergies", e);
    }
}