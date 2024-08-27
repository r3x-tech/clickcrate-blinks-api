import express from "express";
import { z } from "zod";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import {
  ProductInfoSchema,
  ProductTypeSchema,
  TempProductInfoSchema,
  tempProductInfoStore,
} from "../models/schemas";
import { sendVerificationEmail } from "../services/emailService";
import { sendResponse, sendErrorResponse } from "../utils/responseHelper";

const router = express.Router();
const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

// Step 1: Choose product type (GET)
router.get("/", (req, res) => {
  try {
    const responseBody = {
      icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
      label: "Create Product",
      title: "Choose Product Type",
      description: "Select the type of product you want to create",
      links: {
        actions: [
          {
            href: `/api/creator/create-product`,
            label: "Start Creating",
            parameters: [
              {
                name: "type",
                label: "Product Type",
                required: true,
                type: "select",
                options: ProductTypeSchema.options.map((type) => ({
                  label: type,
                  value: type,
                })),
              },
            ],
          },
        ],
      },
    };
    sendResponse(res, 200, responseBody);
  } catch (error) {
    console.error("Error in GET /:", error);
    sendErrorResponse(res, 500, "Internal server error");
  }
});

// Step 2: Enter product information (POST)
router.post("/create-product", async (req, res) => {
  try {
    const { type, account } = req.body;
    if (!ProductTypeSchema.safeParse(type).success) {
      return sendErrorResponse(res, 400, "Invalid product type");
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

    const responseBody = {
      transaction: "dummy_transaction_base64", // TODO: Replace with actual transaction
      message: "Please provide product information",
      links: {
        next: {
          type: "inline",
          action: {
            icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
            label: `Create ${type}`,
            title: "Enter Product Information",
            description: `Please provide the following information for your ${type}`,
            links: {
              actions: [
                {
                  href: `/api/creator/submit-product-info`,
                  label: "Submit Product Info",
                  parameters: fields,
                },
              ],
            },
          },
        },
      },
    };
    sendResponse(res, 200, responseBody);
  } catch (error) {
    console.error("Error in POST /create-product:", error);
    sendErrorResponse(res, 500, "Internal server error");
  }
});

// Step 3: Submit product info and send verification email
router.post("/submit-product-info", async (req, res) => {
  try {
    const productInfo = ProductInfoSchema.parse(req.body);

    // Generate verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    // Store product info and verification code
    const tempInfo = TempProductInfoSchema.parse({
      ...productInfo,
      verificationCode,
    });

    const tempId = Math.random().toString(36).substring(7);
    tempProductInfoStore[tempId] = tempInfo;

    // Send verification email
    await sendVerificationEmail(productInfo.contact, verificationCode);

    const responseBody = {
      transaction: "dummy_transaction_base64", // TODO: Replace with actual transaction
      message: "Verification code sent to your email.",
      links: {
        next: {
          type: "inline",
          action: {
            icon: "https://example.com/verify-icon.png",
            label: "Verify Email",
            title: "Enter Verification Code",
            description: "Please enter the 6-digit code sent to your email.",
            links: {
              actions: [
                {
                  href: `/api/creator/verify-product/${tempId}`,
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
    };
    sendResponse(res, 200, responseBody);
  } catch (error) {
    console.error("Error in POST /submit-product-info:", error);
    sendErrorResponse(res, 400, "Invalid product information or API error");
  }
});

// Step 4: Verify code and finalize product creation
router.post("/verify-product/:tempId", async (req, res) => {
  try {
    const { tempId } = req.params;
    const { code } = req.body;
    const tempInfo = tempProductInfoStore[tempId];

    if (!tempInfo || code !== tempInfo.verificationCode) {
      return sendErrorResponse(res, 400, "Invalid verification code");
    }

    // Call ClickCrate API to register product listing
    const registerResponse = await axios.post(
      `${CLICKCRATE_API_URL}/v1/product-listing/register`,
      tempInfo
    );

    const clickcrateId = registerResponse.data.productListingId;

    // Activate the product listing
    await axios.post(`${CLICKCRATE_API_URL}/v1/product-listing/activate`, {
      productListingId: clickcrateId,
    });

    // Generate Blink URL
    const blinkUrl = `${CLICKCRATE_API_URL}/blink/${clickcrateId}`;

    // Clear temporary storage
    delete tempProductInfoStore[tempId];

    const responseBody = {
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
    };
    sendResponse(res, 200, responseBody);
  } catch (error) {
    console.error("Error in POST /verify-product/:tempId:", error);
    sendErrorResponse(res, 400, "Verification failed or API error");
  }
});

export default router;
