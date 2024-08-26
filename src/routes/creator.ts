import express from "express";
import { z } from "zod";
import axios from "axios";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { ACTIONS_CORS_HEADERS_MIDDLEWARE } from "@solana/actions";
import { ProductInfoSchema, ProductTypeSchema } from "../schemas/creator";
import { sendVerificationEmail } from "../services/emailService";

const router = express.Router();
const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

// Use Zod to create a schema for temporary product info storage
const TempProductInfoSchema = ProductInfoSchema.extend({
  clickcrateId: z.string(),
  verificationCode: z.string(),
});

type TempProductInfo = z.infer<typeof TempProductInfoSchema>;

// In-memory store for temporary product info (replace with a database in production)
const tempProductInfoStore: { [key: string]: TempProductInfo } = {};

// Step 1: Choose product type
router.get("/:clickcrateId", (req, res) => {
  const { clickcrateId } = req.params;

  res.json({
    icon: "https://example.com/product-creator-icon.png",
    label: "Create Product",
    title: "Choose Product Type",
    description: "Select the type of product you want to create",
    links: {
      actions: ProductTypeSchema.options.map((type) => ({
        href: `/api/creator/product-info/${clickcrateId}/${type}`,
        label: type,
      })),
    },
  });
});

// Step 2: Enter product information
router.get("/product-info/:clickcrateId/:type", (req, res) => {
  const { clickcrateId, type } = req.params;
  if (!ProductTypeSchema.safeParse(type).success) {
    return res.status(400).json({ error: "Invalid product type" });
  }

  const commonFields = [
    { name: "imageUri", label: "Product Image URL" },
    { name: "name", label: "Product Name" },
    { name: "description", label: "Product Description" },
    { name: "quantity", label: "Quantity (1-3)" },
    { name: "salePrice", label: "Sale Price" },
    { name: "contact", label: "Contact Email" },
  ];

  const sizeField = { name: "size", label: "Size (S/M/L/XL)" };

  const fields =
    type === "T-Shirt" || type === "Hoodie"
      ? [...commonFields, sizeField]
      : commonFields;

  res.json({
    icon: "https://example.com/product-info-icon.png",
    label: `Create ${type}`,
    title: "Enter Product Information",
    description: `Please provide the following information for your ${type}`,
    links: {
      actions: [
        {
          href: `/api/creator/create-product/${clickcrateId}/{${fields
            .map((f) => f.name)
            .join("}/{")}}`,
          label: "Create Product",
          parameters: fields,
        },
      ],
    },
  });
});

// Step 3: Create product and send verification email
router.post("/create-product/:clickcrateId", async (req, res) => {
  try {
    const { clickcrateId } = req.params;
    const productInfo = ProductInfoSchema.parse(req.body);

    // Generate verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Store product info and verification code
    const tempInfo = TempProductInfoSchema.parse({
      ...productInfo,
      clickcrateId,
      verificationCode,
    });

    const tempId = Math.random().toString(36).substring(7);
    tempProductInfoStore[tempId] = tempInfo;

    // Send verification email
    await sendVerificationEmail(productInfo.contact, verificationCode);

    res.json({
      transaction: "dummy_transaction_base64", // TODO: Replace with actual transaction
      message: "Verification code sent to your email.",
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: "https://example.com/verify-icon.png",
            label: "Verify Email",
            title: "Enter Verification Code",
            description: "Please enter the 6-digit code sent to your email.",
            links: {
              actions: [
                {
                  href: `/api/creator/verify-product/${tempId}/{code}`,
                  label: "Verify",
                  parameters: [
                    { name: "code", label: "6-digit Verification Code" },
                  ],
                },
              ],
            },
          },
        },
      },
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ error: "Invalid product information or API error" });
  }
});

// Step 4: Verify code and finalize product creation
router.post("/verify-product/:tempId", async (req, res) => {
  try {
    const { tempId } = req.params;
    const { code } = req.body;
    const tempInfo = tempProductInfoStore[tempId];

    if (!tempInfo || code !== tempInfo.verificationCode) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Call ClickCrate API to register product listing
    const registerResponse = await axios.post(
      `${CLICKCRATE_API_URL}/v1/product-listing/register`,
      {
        productListingId: tempInfo.clickcrateId,
        ...tempInfo,
      }
    );

    // Activate the product listing
    await axios.post(`${CLICKCRATE_API_URL}/v1/product-listing/activate`, {
      productListingId: tempInfo.clickcrateId,
    });

    // Generate Blink URL
    const blinkUrl = `${CLICKCRATE_API_URL}/blink/${tempInfo.clickcrateId}`;

    // Clear temporary storage
    delete tempProductInfoStore[tempId];

    res.json({
      transaction: "dummy_transaction_base64", // Replace with actual transaction if needed
      message: "Product created successfully!",
      links: {
        next: {
          type: "inline",
          action: {
            type: "completed",
            icon: "https://example.com/success-icon.png",
            label: "Product Created",
            title: "Product Successfully Created",
            description: `Your product has been created and is ready for sale. Share this Blink URL on Twitter to start selling: ${blinkUrl}`,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error verifying and creating product:", error);
    res.status(400).json({ error: "Verification failed or API error" });
  }
});

export default router;
