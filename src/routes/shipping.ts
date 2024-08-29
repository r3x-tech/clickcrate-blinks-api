import express from "express";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import {
  ProductInfoSchema,
  ProductTypeSchema,
  ProductTypes,
  ShippingDetailsSchema
} from "../models/schemas";
import { ActionGetResponse, ActionPostResponse } from "@solana/actions";
import { 
    validateShippingName, 
    validateShippingEmail, 
    validateShippingPhone, 
    validateShippingAddress,
    validateShippingCity,
    validateShippingCountryRegion,
    validateShippingStateProvince,
    validateShippingZipCode 
} from "../utils/helpers";
import * as MetaplexService from "../services/metaplexService";
import { encryptShippingInfo } from "../utils/helpers";

const router = express.Router();
const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

router.get("/", (req, res) => {
    try {
      const responseBody: ActionGetResponse = {
        icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
        label: "Shipping address",
        type: "action",
        title: "Enter your shipping address",
        description:
          "Create and mint an NFT that has your shipping info tied to it. This NFT can later be used to auto-fill your shipping info ",
        links: {
          actions: [
            {
              href: `/shipping/create-shipping-info-nft`,
              label: "Shipping address",
              parameters: [
                {
                  name: "shippingName",
                  label: "Full name",
                  required: true,
                  type: "text",
                },
                {
                   name: "shippingEmail",
                   label: "Email",
                   required: true,
                   type: "email",
                },
                {
                    name: "shippingPhone",
                    label: "Phone number",
                    required: true,
                    type: "text",
                 },
                 {
                    name: "shippingAddress",
                    label: "Address",
                    required: true,
                    type: "text",
                 },
                 {
                    name: "shippingCity",
                    label: "City",
                    required: true,
                    type: "text",
                 },
                 {
                    name: "shippingStateProvince",
                    label: "State/Province",
                    required: true,
                    type: "text",
                 },
                 {
                    name: "shippingCountryRegion",
                    label: "Country",
                    required: true,
                    type: "text",
                 },
                 {
                    name: "shippingZipCode",
                    label: "Zip/Postal Code",
                    required: true,
                    type: "text",
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

  router.post("/create-shipping-info-nft", async (req, res) => {
    try {
      const publicKey = new PublicKey(req.body.account);
      const shippingInfo = ShippingDetailsSchema.parse(req.body.data);
      const {
        shippingName,
        shippingEmail,
        shippingPhone,
        shippingAddress,
        shippingCity,
        shippingCountryRegion,
        shippingStateProvince,
        shippingZipCode,
      } = shippingInfo;
      if (
        validateShippingName(shippingName) && 
        validateShippingEmail(shippingEmail) && 
        validateShippingPhone(shippingPhone!) && 
        validateShippingAddress(shippingAddress) &&
        validateShippingCity(shippingCity) && 
        validateShippingCountryRegion(shippingCountryRegion) && 
        validateShippingStateProvince(shippingStateProvince) &&
        validateShippingZipCode(shippingZipCode)
    ) {
        const encryptedInfo = encryptShippingInfo(publicKey, shippingInfo);
        console.log(encryptedInfo, " HI I AM ENCRYPTED INFO")
    } else {
        res.status(400).json({ error: "Bad request" });
    }
    //   const productType = ProductTypes.find((pt) => pt.label === type);
    //   if (!productType) {
    //     return res.status(400).json({ error: "Invalid product type" });
    //   }
  
    //   // Create ClickCrate POS Collection NFT
    //   const posCollectionNft = await MetaplexService.createMetaplexCollectionNft(
    //     `${name} ClickCrate POS`,
    //     "CPOS",
    //     `ClickCrate POS for ${name}`,
    //     imageUri,
    //     "",
    //     "",
    //     "",
    //     [],
    //     [],
    //     "devnet",
    //     new PublicKey(account)
    //   );
  
    //   // Create Product Listing Collection NFT
    //   const listingCollectionNft =
    //     await MetaplexService.createMetaplexCollectionNft(
    //       `${name} Product Listing`,
    //       "PLST",
    //       `Product Listing for ${name}`,
    //       imageUri,
    //       "",
    //       "",
    //       "",
    //       [],
    //       [],
    //       "devnet",
    //       new PublicKey(account)
    //     );
  
    //   // Create Product NFTs
    //   const productNfts = [];
    //   for (let i = 0; i < quantity; i++) {
    //     const productNft = await MetaplexService.createMetaplexNft(
    //       `${name} #${i + 1}`,
    //       "PNFT",
    //       `Product NFT for ${name}`,
    //       imageUri,
    //       "",
    //       "",
    //       "",
    //       [],
    //       [],
    //       // listingCollectionNft.publicKey,
    //       new PublicKey(account), // need ro remove and get actual listingCollectionNft.publicKey,
    //       "devnet",
    //       new PublicKey(account)
    //     );
    //     productNfts.push(productNft);
    //   }
  
    //   // Initiate verification
    //   await axios.post(`${CLICKCRATE_API_URL}/initiate-verification`, { email });
  
    //   const responseBody: ActionPostResponse = {
    //     transaction: Buffer.from(posCollectionNft.serialize()).toString("base64"),
    //     message:
    //       "NFTs created. Please check your email for the verification code.",
    //     links: {
    //       next: {
    //         type: "inline",
    //         action: {
    //           type: "action",
    //           icon: "https://example.com/verify-icon.png",
    //           label: "Verify Email",
    //           title: "Enter Verification Code",
    //           description: "Please enter the 6-digit code sent to your email.",
    //           links: {
    //             actions: [
    //               {
    //                 // href: `/creator/verify-and-place?pos=${posCollectionNft.publicKey.toString()}&listing=${listingCollectionNft.publicKey.toString()}&products=${productNfts.map(nft => nft.publicKey.toString()).join(',')}&price=${unitPrice}&account=${account}`,
    //                 href: `/creator/verify-and-place?pos=${posCollectionNft.toString()}&listing=${listingCollectionNft.toString()}&products=${productNfts
    //                   .map((nft) => nft.toString())
    //                   .join(",")}&price=${unitPrice}&account=${account}`,
  
    //                 label: "Verify and Place Product",
    //                 parameters: [
    //                   {
    //                     name: "code",
    //                     label: "6-digit Verification Code",
    //                     type: "text",
    //                     required: true,
    //                   },
    //                   {
    //                     name: "email",
    //                     label: "Email",
    //                     type: "email",
    //                     required: true,
    //                   },
    //                 ],
    //               },
    //             ],
    //           },
    //         },
    //       },
    //     },
    //   };
      res.status(200).json("success");
    } catch (error) {
      console.error("Error in POST /create-shipping-info-nft:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  export default router;