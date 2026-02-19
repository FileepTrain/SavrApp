import AsyncStorage from "@react-native-async-storage/async-storage";

const COOKWARE_STORAGE_KEY = "USER_COOKWARE";
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
        const response = await fetch(`${SERVER_URL}/api/auth/get-cookware`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.cookware)) {
            const cookwareSet = new Set(data.cookware);
            // Also cache locally
            await AsyncStorage.setItem(
              COOKWARE_STORAGE_KEY,
              JSON.stringify(data.cookware)
            );
            return cookwareSet;
          }
        }
      } catch (serverError) {
        console.warn("Failed to fetch cookware from server, using local cache:", serverError);
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
      JSON.stringify(cookwareArray)
    );
  } catch (error) {
    console.error("Error saving cookware to local storage:", error);
  }

  // Sync to server if user is logged in
  try {
    const idToken = await AsyncStorage.getItem("idToken");
    if (idToken) {
      const response = await fetch(`${SERVER_URL}/api/auth/update-cookware`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cookware: cookwareArray }),
      });

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
  requiredCookware: Array<{ name: string }>
): Promise<boolean> {
  const userCookware = await loadUserCookware();
  if (userCookware.size === 0) {
    // If user hasn't set up cookware, assume they have everything
    return true;
  }
  return requiredCookware.every((item) =>
    userCookware.has(item.name.toLowerCase())
  );
}
