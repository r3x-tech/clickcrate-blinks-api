import { z } from "zod";

export type Attribute = {
  trait_type: string;
  value: string;
};

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
  // type: z.enum(["tshirt", "hoodie", "hat"]),
  type: z.enum(["hat"]),
  imageUri: z.string().url(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  quantity: z.union([
    z.number().int().min(1).max(3),
    z
      .string()
      .regex(/^[1-3]$/)
      .transform(Number),
  ]),
  unitPrice: z.union([
    z.number().positive(),
    z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .transform(Number),
  ]),
  email: z.string().email(),
  account: z.string(),
});

export const ShippingDetailsSchema = z.object({
  shippingName: z.string(),
  shippingEmail: z.string().email(),
  shippingPhone: z.string().nullable().optional(),
  shippingAddress: z.string(),
  shippingCity: z.string(),
  shippingStateProvince: z.string(),
  shippingCountryRegion: z.string(),
  shippingZipCode: z.string(),
});

export const ProductLabelSchema = z.object({
  label: z.string(),
});

export const fieldMappingSchema = z.object({
  buyerName: z.string(),
  shippingEmail: z.string(),
  shippingAddress: z.string(),
  shippingCity: z.string(),
  shippingStateProvince: z.string(),
  shippingCountryRegion: z.string(),
  shippingZipCode: z.string(),
});

export const ActionParameterTypeSchema = z.enum([
  "text",
  "email",
  "url",
  "number",
  "date",
  "datetime-local",
  "textarea",
]);

const ActionParameterSelectableBaseSchema = z.object({
  name: z.string(),
  label: z.string(),
  required: z.boolean(),
});

export const ActionParameterSelectableSchema = <
  T extends ActionParameterType
>() =>
  ActionParameterSelectableBaseSchema.extend({
    type: ActionParameterTypeSchema.refine((type) => type as T),
  });

export type ProductType = z.infer<typeof ProductTypeSchema>;
export type ProductInfo = z.infer<typeof ProductInfoSchema>;
export type ShippingInfo = z.infer<typeof ShippingDetailsSchema>;
export type LabelType = z.infer<typeof ProductLabelSchema>;
export type FieldMapping = z.infer<typeof fieldMappingSchema>;
export type ActionParameterType = z.infer<typeof ActionParameterTypeSchema>;
export type ActionParameterSelectable<T extends ActionParameterType> = z.infer<
  ReturnType<typeof ActionParameterSelectableSchema<T>>
>;
export type MetaplexAttribute = {
  trait_type?: string;
  value?: string;
  [key: string]: unknown;
};
