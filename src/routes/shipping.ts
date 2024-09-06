import express from "express";
import { PublicKey } from "@solana/web3.js";
import { ShippingDetailsSchema } from "../models/schemas";
import { ActionGetResponse, ActionPostResponse } from "@solana/actions";
import {
  validateShippingName,
  validateShippingEmail,
  validateShippingPhone,
  validateShippingAddress,
  validateShippingCity,
  validateShippingCountryRegion,
  validateShippingStateProvince,
  validateShippingZipCode,
} from "../utils/helpers";
import * as MetaplexService from "../services/metaplexService";
import { encryptShippingInfo } from "../utils/helpers";

const router = express.Router();
const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

router.get("/", (req, res) => {
  try {
    const responseBody: ActionGetResponse = {
      icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/autofill_checkout_button_bottom.png",
      label: "Shipping address",
      type: "action",
      title: "Enter your shipping address",
      description:
        "Create and mint an NFT that has your shipping info tied to it. This NFT can later be used to auto-fill your shipping info ",
      links: {
        actions: [
          {
            href: `/shipping/create-shipping-info-nft`,
            label: "Mint",
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
      const encryptedShippingInfo = encryptShippingInfo(
        publicKey,
        shippingInfo
      );
      const shippingInfoNftTransaction =
        await MetaplexService.createMetaplexNft(
          "ClickCrate NFT",
          "PNFT",
          `Shipping NFT`,
          "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png",
          "",
          "",
          "",
          [{ trait_type: "shippingInfo", value: encryptedShippingInfo }],
          [{ type: "FreezeDelegate", data: { frozen: true } }],
          publicKey
        );

      const responseBody: ActionPostResponse = {
        transaction: Buffer.from(shippingInfoNftTransaction).toString("base64"),
        message:
          "NFTs created. Please check your email for the verification code.",
      };
      res.status(200).json(responseBody);
    } else {
      res.status(400).json({ error: "Bad request" });
    }
  } catch (error) {
    console.error("Error in POST /create-shipping-info-nft:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
