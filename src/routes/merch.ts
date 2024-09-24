import express from "express";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Attribute } from "../models/schemas";
import {
  ActionGetResponse,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
} from "@solana/actions";
import {
  fetchRegisteredProductListing,
  fetchRegisteredClickcrate,
} from "../services/clickcrateApiService";
import { fetchDasCoreCollection } from "../services/metaplexService";
import { isAttribute, parseSizes } from "../utils/conversions";
import { relayPaymentTransaction } from "../services/solanaService";

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

router.get(
  "/:clickcrateId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { clickcrateId } = req.params;
      if (!clickcrateId || clickcrateId === "") {
        return res.status(400).json({ message: "ClickCrate not found" });
      }

      const clickcrateAssetResponse = await fetchRegisteredClickcrate(
        clickcrateId
      );
      console.log("fetched ClickCrate response: ", clickcrateAssetResponse);

      const clickcrateAsset = clickcrateAssetResponse.data;
      console.log("fetched ClickCrate: ", clickcrateAsset);

      if (!clickcrateAsset.product) {
        return res
          .status(404)
          .json({ message: "Product not found in ClickCrate" });
      }

      const productListingAsset = await fetchDasCoreCollection(
        clickcrateAsset.product,
        "devnet"
      );
      console.log("fetched productListingAsset: ", productListingAsset);

      const productListingResponse = await fetchRegisteredProductListing(
        clickcrateAsset.product
      );
      console.log("fetched productListing response: ", productListingResponse);

      const productListing = productListingResponse.data;
      console.log("fetched productListing: ", productListing);

      if (!productListingAsset || !productListing) {
        return res.status(404).json({ message: "Product info not found" });
      }

      const response = await fetch(productListingAsset.uri);
      const jsonImageData = await response.json();
      const icon =
        jsonImageData.image ||
        "https://shdw-drive.genesysgo.net/3CjrSiTMjg73qjNb9Phpd54sT2ZNXM6YmUudRHvwwppx/clickcrate%20pos%20placeholder.svg";
      const productSizeAttr =
        productListingAsset.content.metadata.attributes?.find(
          (attr): attr is Attribute =>
            isAttribute(attr) && attr.trait_type === "Size(s)"
        );

      let productSizes: { label: string; value: string }[] = [];

      if (productSizeAttr && productSizeAttr.value) {
        if (productSizeAttr.value.includes(",")) {
          productSizes = parseSizes(productSizeAttr.value);
        } else {
          productSizes = [
            { label: productSizeAttr.value, value: productSizeAttr.value },
          ];
        }
      }
      const inStock = parseInt(productListing.inStock, 10);

      const disable = inStock < 1 || isNaN(inStock);
      console.log("blink disabled? ", disable);

      const salePrice = productListing.price / LAMPORTS_PER_SOL;

      const buttonText = disable ? "SOLD OUT" : `Buy for ${salePrice} SOL`;
      console.log("buttonText: ", buttonText);

      const responseBody: ActionGetResponse = {
        icon,
        label: `Purchase ${productListingAsset.content.metadata.name}`,
        title: `${productListingAsset.content.metadata.name}`,
        description: `IN STOCK: ${productListing.inStock} | SIZE: ${
          productSizeAttr?.value || "N/A"
        } | DELIVERY: ~2 weeks 
        \n${productListingAsset.content.metadata.description}
        \nOrder confirmations and updates will be sent to your provided email address. To avoid delays ensure all information is correct.
        \nNeed help? Send us a DM @click_crate on Twitter or email us at support@clickcrate.xyz`,
        disabled: disable,
        links: {
          actions: [
            {
              href: `/purchase?clickcrateId=${clickcrateId}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
              label: `${buttonText}`,
              parameters: [
                {
                  name: "size",
                  label: "Select a size",
                  required: true,
                  type: "select",
                  options: productSizes,
                },
                {
                  name: "buyerName",
                  label: "First & Last name",
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
                  name: "shippingAddress",
                  label: "Address (including Apt., Suite, etc.)",
                  required: true,
                  type: "text",
                },
                { name: "shippingCity", label: "City", required: true },
                {
                  name: "shippingStateProvince",
                  label: "State/Province",
                  required: true,
                  type: "text",
                },
                {
                  name: "shippingCountryRegion",
                  label: "Country/Region",
                  required: true,
                  type: "text",
                },
                {
                  name: "shippingZipCode",
                  label: "ZIP code",
                  required: true,
                  type: "text",
                },
              ],
            },
          ],
        },
      };

      console.log("blink response: ", responseBody);

      res.status(200).json(responseBody);
    } catch (error) {
      console.error("Error in GET merch blink /:", error);
      res.status(400).json({ message: "Bad Request" });
    }
  }
);

router.post("/purchase", async (req, res, next) => {
  try {
    console.log("req.body is: ", req.body);

    const {
      account,
      size,
      buyerName,
      shippingEmail,
      shippingAddress,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
    } = req.body;
    const publicKey = new PublicKey(account);

    const {
      clickcrateId,
      productName,
      productSizes,
      productDescription,
      productIcon,
    } = req.query;
    console.log("req.query: ", req.query);

    if (
      !clickcrateId ||
      !size ||
      !buyerName ||
      !shippingEmail ||
      !shippingAddress ||
      !shippingStateProvince ||
      !shippingCountryRegion ||
      !shippingZipCode
    ) {
      console.error("Missing required parameters in verify-and-place!!!");
      throw Error("Missing required parameters");
    }

    const relayTx = await relayPaymentTransaction(0.001, publicKey, "mainnet");
    console.log("Initiating verification");

    const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
    console.log("Responding with this paymentTx: ", paymentTx);

    const payload = {
      transaction: paymentTx,
      message: `Purchase successful! Order confirmation emailed to: ${shippingEmail}`,
      links: {
        next: {
          type: "inline",
          action: {
            type: "completed",
            icon: `${productIcon}`,
            label: "Purchased successful!",
            title: `${productName}`,
            description: `${productDescription}`,
          },
        },
      },
    };
    console.log("Sending response:", JSON.stringify(payload, null, 2));
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /verify-and-place:", error);
    next(error);
  }
});

export default router;
