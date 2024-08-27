import { z } from "zod";

export const ProductTypeSchema = z.enum(["T-Shirt", "Hoodie", "Hat"]);

export const ProductTypes = [
  {
    value: "tshirt",
    label: "Heavyweight Premium T-Shirt (Screen Print)",
  },
  { value: "hoodie", label: "Premium Pullover Hoodie (Screen Print)" },
  { value: "hat", label: "Embroidered Dad Hat" },
] as const;

export const ProductInfoSchema = z.object({
  imageUri: z.string().url(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  quantity: z.number().int().min(1).max(3),
  salePrice: z.number().positive(),
  contact: z.string().email(),
});

// Schema for temporary product info storage
export const TempProductInfoSchema = ProductInfoSchema.extend({
  clickcrateId: z.string(),
  verificationCode: z.string(),
});

export type ProductType = z.infer<typeof ProductTypeSchema>;
export type ProductInfo = z.infer<typeof ProductInfoSchema>;
export type TempProductInfo = z.infer<typeof TempProductInfoSchema>;

// In-memory store for temporary product info (possibly replace with a database in production)
export const tempProductInfoStore: { [key: string]: TempProductInfo } = {};
