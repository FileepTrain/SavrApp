import { z } from "zod";

export const IngredientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  quantity: z.coerce.number().min(1, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
});

// Inferred TypeScript type from Zod schema
export type Ingredient = z.infer<typeof IngredientSchema>;

export const validateIngredient = (input: Ingredient): { success: true; data: Ingredient } | { success: false; errors: string[] } => {
  const result = IngredientSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.errors.map((err) => err.message);
  return { success: false, errors };
}
