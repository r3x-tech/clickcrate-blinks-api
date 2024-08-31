import { z } from "zod";

export const ProductTypeSchema = z.enum([
  // "Heavyweight Premium T-Shirt (Screen Print)",
  // "Premium Pullover Hoodie (Screen Print)",
  "Embroidered Dad Hat",
]);

export const ProductTypes = [
  // {
  //   value: "tshirt",
  //   label: "Heavyweight Premium T-Shirt (Screen Print)" as const,
  // },
  // {
  //   value: "hoodie",
  //   label: "Premium Pullover Hoodie (Screen Print)" as const,
  // },
  {
    value: "hat",
    label: "Embroidered Dad Hat" as const,
  },
] as const;

export const ProductInfoSchema = z.object({
  type: ProductTypeSchema,
  imageUri: z.string().url(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  quantity: z.number().int().min(1).max(3),
  unitPrice: z.number().positive(),
  email: z.string().email(),
  account: z.string(),
});

export type ProductType = z.infer<typeof ProductTypeSchema>;
export type ProductInfo = z.infer<typeof ProductInfoSchema>;
