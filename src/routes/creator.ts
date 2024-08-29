import express from "express";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import {
  ProductInfoSchema,
  ProductTypeSchema,
  ProductTypes,
} from "../models/schemas";
import { ActionGetResponse, ActionPostResponse } from "@solana/actions";
import * as MetaplexService from "../services/metaplexService";

const router = express.Router();
const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

// Step 1: Choose product type and provide product info (GET)
router.get("/", (req, res) => {
  try {
    const responseBody: ActionGetResponse = {
      icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
      label: "START CREATING",
      type: "action",
      title: "ClickCrate Merch Creator",
      description:
        "Start selling your own branded merch directly on Twitter in just a few clicks using blinks! To get started simply select a product to create below:",
      links: {
        actions: [
          {
            href: `/creator/create-product`,
            label: "START CREATING",
            parameters: [
              {
                name: "type",
                label: "Select a product",
                required: true,
                type: "select",
                options: ProductTypes.map((type) => ({
                  label: type.label,
                  value: type.value,
                })),
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// Step 2: Create NFTs and initiate verification (POST)
router.post("/create-product", async (req, res) => {
  try {
    const publicKey = new PublicKey(req.body.account);
    const productInfo = ProductInfoSchema.parse(req.body);

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

    const productType = ProductTypes.find((pt) => pt.label === type);
    if (!productType) {
      return res.status(400).json({ error: "Invalid product type" });
    }

    // Create ClickCrate POS Collection NFT
    const posCollectionNft = await MetaplexService.createMetaplexCollectionNft(
      `${name} ClickCrate POS`,
      "CPOS",
      `${name} ClickCrate POS`,
      imageUri,
      ``,
      `https://www.clickcrate.xyz/`,
      `https://www.clickcrate.xyz/`,
      [
        {
          key: "Type",
          value: "ClickCrate",
        },
        {
          key: "Placement Type",
          value: "Related Purchase",
        },
        {
          key: "Additional Placement Requirements",
          value: "None",
        },
        {
          key: "Placement Fee (USDC)",
          value: "0",
        },
        {
          key: "User Profile Uri",
          value: "None",
        },
      ],
      [],
      new PublicKey(account),
      new PublicKey(account)
    );

    // Create Product Listing Collection NFT
    const listingCollectionNft =
      await MetaplexService.createMetaplexCollectionNft(
        `${name}`,
        "PLCC",
        `${description}`,
        imageUri,
        ``,
        `https://www.clickcrate.xyz/`,
        `https://www.clickcrate.xyz/`,
        [
          {
            key: "Type",
            value: "Product Listing",
          },
          {
            key: "Product Category",
            value: "Clothing",
          },
          {
            key: "Brand",
            value: "ClickCrate",
          },
          {
            key: "Size(s)",
            value: "Unisex",
          },
          {
            key: "Placement Type",
            value: "Related Purchase",
          },
          {
            key: "Additional Placement Requirements",
            value: "None",
          },
          {
            key: "Discount",
            value: "None",
          },
          {
            key: "Customer Profile Uri",
            value: "None",
          },
        ],
        [],
        new PublicKey(account),
        publicKey
      );

    // Create Product NFTs
    const productNfts = [];
    for (let i = 0; i < quantity; i++) {
      const productNft = await MetaplexService.createMetaplexNftInCollection(
        `${name} #${i + 1}`,
        `PCC${i}`,
        `${description}`,
        imageUri,
        "",
        `https://www.clickcrate.xyz/`,
        `https://www.clickcrate.xyz/`,
        [
          {
            key: "Type",
            value: "Product",
          },
          {
            key: "Product Category",
            value: "Clothing",
          },
          {
            key: "Brand",
            value: "ClickCrate",
          },
          {
            key: "Size",
            value: "Unisex",
          },
        ],
        [],
        // listingCollectionNft.publicKey,
        new PublicKey(account), // need to remove and get actual listingCollectionNft.publicKey,
        new PublicKey(account),
        publicKey,
      );
      productNfts.push(productNft);
    }

    // Initiate verification
    await axios.post(`${CLICKCRATE_API_URL}/initiate-verification`, { email });

    const responseBody: ActionPostResponse = {
      transaction: Buffer.from(posCollectionNft.serialize()).toString("base64"),
      message:
        "NFTs created. Please check your email for the verification code.",
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
                  // href: `/creator/verify-and-place?pos=${posCollectionNft.publicKey.toString()}&listing=${listingCollectionNft.publicKey.toString()}&products=${productNfts.map(nft => nft.publicKey.toString()).join(',')}&price=${unitPrice}&account=${account}`,
                  href: `/creator/verify-and-place?pos=${posCollectionNft.toString()}&listing=${listingCollectionNft.toString()}&products=${productNfts
                    .map((nft) => nft.toString())
                    .join(",")}&price=${unitPrice}&account=${account}`,

                  label: "Verify and Place Product",
                  parameters: [
                    {
                      name: "code",
                      label: "6-digit Verification Code",
                      type: "text",
                      required: true,
                    },
                    {
                      name: "email",
                      label: "Email",
                      type: "email",
                      required: true,
                    },
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
    res.status(500).json({ error: "Internal server error" });
  }
});

// Step 3: Verify email, register, activate, and place product (POST)
router.post("/verify-and-place", async (req, res) => {
  try {
    const { code, email, pos, listing, products, price, account } = req.body;

    // Verify code using ClickCrate API
    const verificationResponse = await axios.post(
      `${CLICKCRATE_API_URL}/verify-code`,
      {
        email,
        code,
      }
    );

    if (!verificationResponse.data.verified) {
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
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/singleinputblink", (req, res) => {
  try {
    const responseBody: ActionGetResponse = {
      icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
      label: "START CREATING",
      type: "action",
      title: "ClickCrate Merch Creator",
      description:
        "Start selling your own branded merch directly on Twitter in just a few clicks using blinks! To get started simply select a product to create below:",
      links: {
        actions: [
          {
            href: `/creator/create-product`,
            label: "START CREATING",
            parameters: [
              {
                name: "type",
                label: "Select a product",
                required: true,
                type: "select",
                options: ProductTypes.map((type) => ({
                  label: type.label,
                  value: type.value,
                })),
              },
            ],
          },
        ],
      },
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in GET /:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
