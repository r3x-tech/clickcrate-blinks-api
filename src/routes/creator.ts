import express from "express";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import {
  ProductInfoSchema,
  ProductTypeSchema,
  ProductTypes,
} from "../models/schemas";
import {
  ActionError,
  ActionGetResponse,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
} from "@solana/actions";
import * as MetaplexService from "../services/metaplexService";
import {
  createProducts,
  relayPaymentTransaction,
} from "../services/solanaService";
import { z } from "zod";

const router = express.Router();
// const blinkCorsMiddleware = (
//   req: express.Request,
//   res: express.Response,
//   next: express.NextFunction
// ) => {
//   res.set(ACTIONS_CORS_HEADERS_MIDDLEWARE);
//   if (req.method === "OPTIONS") {
//     return res.status(200).json({
//       body: "OK",
//     });
//   }
//   next();
// };
// router.use(blinkCorsMiddleware);

const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

// Step 1: Choose product type and provide product info (GET)
router.get("/", (req, res) => {
  try {
    const responseBody: ActionGetResponse = {
      icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
      label: "CREATE",
      type: "action",
      title: "ClickCrate Merch Creator",
      description:
        "Start selling your own branded merch directly on Twitter in just a few clicks using blinks! To get started simply select a product to create below:",
      links: {
        actions: [
          {
            href: `/creator/create-product`,
            label: "CREATE",
            parameters: [
              {
                name: "type",
                label: "Select a product",
                required: true,
                type: "select",
                options: ProductTypes.map(
                  (type: { label: any; value: any }) => ({
                    label: type.label,
                    value: type.value,
                  })
                ),
              },
              {
                name: "imageUri",
                label: "Product Image URL",
                required: true,
                type: "url",
              },
              {
                name: "name",
                label: "Product Name",
                required: true,
                type: "text",
              },
              {
                name: "description",
                label: "Product Description",
                required: true,
                type: "textarea",
              },
              {
                name: "quantity",
                label: "Quantity (1-3)",
                required: true,
                type: "select",
                options: [
                  { label: "1", value: "1" },
                  { label: "2", value: "2" },
                  { label: "3", value: "3" },
                ],
              },
              {
                name: "unitPrice",
                label: "Unit Price (in SOL)",
                required: true,
                type: "number",
              },
              { name: "email", label: "Email", required: true, type: "email" },
            ],
          },
        ],
      },
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in GET /:", error);
    const errorResponse: ActionError = {
      message: "Internal server error",
    };
    res.status(500).json(errorResponse);
  }
});

// Step 2: Create NFTs and initiate verification (POST)
router.post("/create-product", async (req, res) => {
  try {
    console.log("Received data:", req.body);
    const publicKey = new PublicKey(req.body.account);

    // Extract the data from the nested structure
    const productData = {
      ...req.body.data,
      account: req.body.account,
    };

    const productInfo = ProductInfoSchema.parse({
      ...productData,
      quantity: parseInt(productData.quantity, 10),
      unitPrice: parseFloat(productData.unitPrice),
    });

    const {
      type,
      account,
      imageUri,
      name,
      description,
      quantity,
      unitPrice,
      email,
    } = productInfo;

    const productType = ProductTypes.find((pt) => pt.value === type);
    if (!productType) {
      return res.status(400).json({ error: "Invalid product type" });
    }

    // Use productType.label when you need the full product type name
    const fullProductTypeName = productType.label;

    const {
      totalCost,
      posTxSignature,
      listingTxSignature,
      productNfts,
      listingCollectionNftAddress,
    } = await createProducts(productInfo, publicKey, "devnet");

    console.log("Relaying tx");

    const relayTx = await relayPaymentTransaction(
      totalCost,
      publicKey,
      "mainnet"
    );

    console.log("Initiating verficiation");

    await axios.post(`${CLICKCRATE_API_URL}/initiate-verification`, { email });

    console.log("Responding");

    const responseBody: ActionPostResponse = {
      transaction: Buffer.from(relayTx.serialize()).toString("base64"),
      // transaction: relayTx.serialize().toString(),
      message:
        "Products created. Please check your email for the verification code.",
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
            label: "Verify Email",
            title: "Enter Verification Code",
            description: `Please enter the 6-digit code sent to: ${email}`,
            links: {
              actions: [
                {
                  href: `/creator/verify-and-place?pos=${posTxSignature}&listing=${listingTxSignature}&products=${productNfts.join(
                    ","
                  )}&price=${unitPrice}&account=${account}&listingNft=${listingCollectionNftAddress}&email=${email}`,
                  label: "Verify and Place Product",
                  parameters: [
                    {
                      name: "code",
                      label: "6-digit Verification Code",
                      type: "text",
                      required: true,
                    },
                    // {
                    //   name: "email",
                    //   label: "Email",
                    //   type: "email",
                    //   required: true,
                    // },
                  ],
                },
              ],
            },
          },
        },
      },
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in POST /create-product:", error);
    if (error instanceof z.ZodError) {
      const errorResponse: ActionError = {
        message: "Invalid input data",
      };
      res.status(400).json(errorResponse);
    } else {
      const errorResponse: ActionError = {
        message: "Internal server error",
      };
      res.status(500).json(errorResponse);
    }
  }
});

// Step 3: Verify email, register, activate, and place product (POST)
router.post("/verify-and-place", async (req, res) => {
  try {
    const { code } = req.body;
    console.log("req.body is: ", req.body);

    const { pos, listing, products, price, account, listingNft, email } =
      req.query;
    console.log("req.query: ", req.query);

    if (!email || !pos || !listing || !products || !price || !account) {
      console.error("Missing required parameters!!! in verify-place");
      const errorResponse: ActionError = {
        message: "Missing required parameters",
      };
      return res.status(400).json(errorResponse);
    }

    // Verify code using ClickCrate API
    const verificationResponse = await axios.post(
      `${CLICKCRATE_API_URL}/verify-code`,
      {
        email,
        code,
      }
    );
    console.log("verificationResponse is: ", verificationResponse.data);

    if (!verificationResponse.data.verified) {
      console.log("Invalid verification code!");
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Register ClickCrate POS
    const registerPosResponse = await axios.post(
      `${CLICKCRATE_API_URL}/api/clickcrates/register`,
      {
        clickcrateId: pos,
        eligiblePlacementType: "Twitter",
        eligibleProductCategory: "Merch",
        manager: account,
      }
    );

    // Activate ClickCrate POS
    const activatePosResponse = await axios.post(
      `${CLICKCRATE_API_URL}/api/clickcrates/activate`,
      {
        clickcrateId: pos,
      }
    );

    // Register Product Listing
    const registerListingResponse = await axios.post(
      `${CLICKCRATE_API_URL}/api/product-listings/register`,
      {
        productListingId: listing,
        origin: "ClickCrate",
        eligiblePlacementType: "Twitter",
        eligibleProductCategory: "Merch",
        manager: account,
        price: price,
        orderManager: "clickcrate",
      }
    );

    // Activate Product Listing
    const activateListingResponse = await axios.post(
      `${CLICKCRATE_API_URL}/api/product-listings/activate`,
      {
        productListingId: listing,
      }
    );

    // Place Product Listing in ClickCrate POS
    const placeProductResponse = await axios.post(
      `${CLICKCRATE_API_URL}/api/product-listings/place`,
      {
        productListingId: listing,
        clickcrateId: pos,
        price: price,
      }
    );

    const clickcrateId = pos;
    const blinkUrl = `${CLICKCRATE_API_URL}/blink/${clickcrateId}`;

    const responseBody: ActionPostResponse = {
      transaction: placeProductResponse.data.transaction,
      message: `Your product is ready for sale!. Share this Blink URL on Twitter to start selling: ${blinkUrl}`,
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in POST /verify-and-place:", error);
    const errorResponse: ActionError = {
      message: "Internal server error",
    };
    res.status(500).json(errorResponse);
  }
});

export default router;
