import { z } from "zod";
import { IngredientSchema } from "./ingredient";

export const RecipeSchema = z.object({
  name: z.string().min(1, "Recipe name is required"),
  description: z.string().optional().default(""),
  imageUri: z.string().nullable(),
  prepTime: z.number().min(0, "Prep time must not be negative"),
  cookTime: z.number().min(0, "Cook time must not be negative"),
  servings: z.number().min(1, "Total servings must be at least 1"),
  ingredients: z.array(IngredientSchema).min(1, "At least one ingredient is required"),
  instructions: z.string().min(1, "Instructions are required"),
});

// Inferred TypeScript type from Zod schema
export type Recipe = z.infer<typeof RecipeSchema>;

// Validation helper that returns formatted errors
export const validateRecipe = (input: Recipe): { success: true; data: Recipe } | { success: false; errors: string[] } => {
  const result = RecipeSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => err.message);
  return { success: false, errors };
};
