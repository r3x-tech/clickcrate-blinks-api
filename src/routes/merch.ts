import express from "express";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Attribute } from "../models/schemas";
import { ActionGetResponse } from "@solana/actions";
import {
  fetchRegisteredProductListing,
  fetchRegisteredClickcrate,
} from "../services/clickcrateApiService";
import { fetchDasCoreCollection } from "../services/metaplexService";
import { isAttribute, parseSizes } from "../utils/conversions";
import { relayPaymentTransaction } from "../services/solanaService";

const router = express.Router();

router.get(
  "/:clickcrateId",
  async (req: express.Request, res: express.Response) => {
    try {
      const { clickcrateId } = req.params;
      if (!clickcrateId || clickcrateId === "") {
        return res.status(400).json({ message: "ClickCrate not found" });
      }

      const clickcrateAsset = await fetchRegisteredClickcrate(clickcrateId);
      console.log("fetched ClickCrate: ", clickcrateAsset);
      if (!clickcrateAsset.product) {
        return res
          .status(404)
          .json({ message: "Product not found in ClickCrate" });
      }

      const productListingAsset = await fetchDasCoreCollection(
        clickcrateAsset.product.toBase58(),
        "devnet"
      );
      console.log("fetched productListingAsset: ", productListingAsset);

      const productListing = await fetchRegisteredProductListing(
        clickcrateAsset.product
      );
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
      if (productSizeAttr && productSizeAttr.value.includes(",")) {
        productSizes = parseSizes(productSizeAttr.value);
      }

      const disable = productListing.inStock.lt(1);
      console.log("blink disabled? ", disable);

      const buttonText = disable
        ? "SOLD OUT"
        : `Buy for ${productListing.price / LAMPORTS_PER_SOL} SOL`;
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
              href: `/purchase?clickcrateId=${clickcrateId}size={size}&buyerName={buyerName}&shippingEmail={shippingEmail}&shippingAddress={shippingAddress}&shippingCity={shippingCity}&shippingStateProvince={shippingStateProvince}&shippingCountryRegion={shippingCountryRegion}&shippingZipCode={shippingZipCode}`,
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
    const publicKey = new PublicKey(req.body.account);
    const {
      clickcrateId,
      size,
      buyerName,
      shippingEmail,
      shippingAddress,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
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
      message: "Product creation completed successfully!",
      links: {
        next: {
          type: "inline",
          action: {
            type: "completed",
            icon: `https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/horizontalmerchcreatoricon.png`,
            label: "Created!",
            title: "ClickCrate Merch Creator",
            description: `Purchase successful! Order confirmation emailed to: ${shippingEmail}`,
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
