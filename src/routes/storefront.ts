import express from "express";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
  CompletedAction,
} from "@solana/actions";
import { getActionsArr } from "../services/clickcrateApiService";
import {
  ActionParameterSelectable,
  ActionParameterType,
  FieldMapping,
} from "../models/schemas";
import {
  createTransaction,
  relayPaymentTransaction,
} from "../services/solanaService";
import { getParameters } from "../utils/conversions";

const router = express.Router();
const blinkCorsMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  res.set(ACTIONS_CORS_HEADERS_MIDDLEWARE);
  if (req.method === "OPTIONS") {
    return res.status(200).json({
      body: "OK",
    });
  }
  next();
};
router.use(blinkCorsMiddleware);

import { ActionGetResponse, LinkedAction } from "@solana/actions";

router.get("/", async (req, res) => {
  const posArr = Object.keys(req.query)
    .filter((key) => key.startsWith("pos"))
    .sort()
    .map((key) => req.query[key])
    .filter((pos): pos is string => typeof pos === "string");

  if (posArr.length > 6) {
    return res
      .status(400)
      .json({ error: "Too many POS values. Maximum allowed is 6." });
  }

  try {
    const actionsArr = await getActionsArr(posArr);

    const payload: ActionGetResponse = {
      icon: "https://shdw-drive.genesysgo.net/3CjrSiTMjg73qjNb9Phpd54sT2ZNXM6YmUudRHvwwppx/clickcrate_storefront.svg",
      label: "Choose a product",
      title: "ClickCrate Storefront",
      description:
        "Collection of physical ClickCrate products for sale! Select a product to purchase below:",
      links: {
        actions: actionsArr.map((action) => ({
          ...action,
          type: "transaction",
        })) as LinkedAction[],
      },
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error("Error fetching actions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/input/:productId", async (req, res) => {
  try {
    const { clickcrateId, ...restQueryParams } = req.query;
    const account = req.body.account;
    const transaction = await relayPaymentTransaction(
      0.001,
      new PublicKey(account),
      "mainnet"
    );
    const fieldMapping: FieldMapping = {
      buyerName: "Name & Last Name",
      shippingEmail: "Email",
      shippingAddress: "Address (Including Apt, Suite etc)",
      shippingCity: "City",
      shippingStateProvince: "State/Province",
      shippingCountryRegion: "Country/Region",
      shippingZipCode: "Zip Code",
    };
    const parameters: ActionParameterSelectable<ActionParameterType>[] =
      getParameters(restQueryParams, fieldMapping);

    const payload: ActionPostResponse = {
      type: "transaction",
      transaction: Buffer.from(transaction.serialize()).toString("base64"),
      message: "This blink allows you to purchase",
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: "https://example.com/verify-icon.png",
            label: "Buy product",
            title: "Buy the specific product",
            description: "Buy the product from this blink",
            links: {
              actions: [
                {
                  type: "post",
                  href: `/storefront/purchase/${clickcrateId}`,
                  label: "Place order",
                  parameters: parameters,
                } as LinkedAction,
              ],
            },
          },
        },
      },
    };

    res.json(payload);
  } catch (error) {
    console.error("Error Buying the product:", error);
    res.status(400).json({ error: "Invalid data" });
  }
});

router.post("/purchase/:clickcrateId", async (req, res) => {
  try {
    const clickcrateId = req.params.clickcrateId;
    const account = req.body.account;
    const {
      buyerName,
      shippingEmail,
      shippingAddress,
      shippingCity,
      shippingCountryRegion,
      shippingZipCode,
      shippingStateProvince,
    } = req.body.data;
    const reqBody = {
      account,
      clickcrateId,
      buyerName,
      shippingEmail,
      shippingAddress,
      shippingCity,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
    };
    const config = {
      headers: {
        Authorization: `Bearer ${process.env.CLICKCRATE_API_KEY}`,
      },
    };
    const response = await axios.post(
      `${process.env.CLICKCRATE_API_URL}/blink/purchase?clickcrateId=${clickcrateId}&buyerName=${buyerName}&shippingEmail=${shippingEmail}&shippingAddress=${shippingAddress}&shippingCity=${shippingCity}&shippingStateProvince=${shippingStateProvince}&shippingCountryRegion=${shippingCountryRegion}&shippingZipCode=${shippingZipCode}`,
      reqBody,
      config
    );

    const completedAction: CompletedAction = {
      type: "completed",
      icon: "https://example.com/purchase-complete-icon.png",
      label: "Purchase Complete",
      title: "Thank you for your purchase!",
      description: "Your order has been successfully placed.",
    };

    const payload: ActionPostResponse = {
      type: "transaction",
      transaction: response?.data?.transaction,
      message: response?.data?.message,
      links: {
        next: {
          type: "inline",
          action: completedAction,
        },
      },
    };

    res.json(payload);
  } catch (error) {
    console.error("Error processing purchase:", error);
    res.status(400).json({ error: "Failed to process purchase" });
  }
});

export default router;
