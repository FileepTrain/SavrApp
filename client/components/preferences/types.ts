export interface UserPreferencesDraft {
  cookware: string[];
  diets: string[];
  allergies: string[];
  budget: number;
  accessibility: {
    themePreference: "light" | "dark" | "system";
    textSize: number;
  };
  nutrientDisplay: string[];
  shareLocation: boolean;
}
