import express from "express";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionResponse,
} from "@solana/web3.js";
import { Attribute, MetaplexAttribute } from "../models/schemas";
import {
  ActionError,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
  CompletedAction,
  LinkedAction,
  NextActionLink,
} from "@solana/actions";
import {
  fetchRegisteredProductListing,
  fetchRegisteredClickcrate,
  initiatePurchase,
  completePurchase,
  makeBlinkPurchase,
} from "../services/clickcrateApiService";
import { fetchDasCoreCollection } from "../services/metaplexService";
import { parseSizes } from "../utils/conversions";
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

router.get("/quiz", async (req, res, next) => {
  try {
    const responseBody: ActionGetResponse = {
      icon: `https://shdw-drive.genesysgo.net/B9pU9YFo1JFGS7HY1jFi2Fq3yQgnFXodDV1ZJkBQRZ4H/flower_select.svg`,
      label: `1, 2, or 3`,
      title: `Which flower are you attracted to?`,
      description: `Choose the flower you're most drawn to. Find out what it means about you right now.`,
      links: {
        actions: [
          // {
          //   type: "external-link",
          //   href: `https://www.lotuswei.com/`,
          //   label: "LOTUSWEI WEBSITE",
          // } as LinkedAction,
          {
            type: "message",
            href: `/lotus/quiz-product-type?selectedFlower=1`,
            label: `1`,
          } as LinkedAction,
          {
            type: "message",
            href: `/lotus/quiz-product-type?selectedFlower=2`,
            label: `2`,
          } as LinkedAction,
          {
            type: "message",
            href: `/lotus/quiz-product-type?selectedFlower=3`,
            label: `3`,
          } as LinkedAction,
        ],
      },
      error: {
        message: "Failed to get merch blink",
      },
    };
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in GET merch blink /:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to get merch blink" });
  }
});

router.post("/quiz-product-type", async (req, res, next) => {
  try {
    const { selectedFlower } = req.query;
    console.log("req.query: ", req.query);
    if (!selectedFlower) {
      console.error("Missing query parameters from flower selection!!!");
      throw Error("Missing required parameters");
    }

    let actionIcon = `https://shdw-drive.genesysgo.net/B9pU9YFo1JFGS7HY1jFi2Fq3yQgnFXodDV1ZJkBQRZ4H/sacred_heart_elixir_or_mist.svg`;
    if (selectedFlower == "2") {
      actionIcon = `https://shdw-drive.genesysgo.net/B9pU9YFo1JFGS7HY1jFi2Fq3yQgnFXodDV1ZJkBQRZ4H/sacred_awareness_elixir_or_mist.svg`;
    } else if (selectedFlower == "3") {
      actionIcon = `https://shdw-drive.genesysgo.net/B9pU9YFo1JFGS7HY1jFi2Fq3yQgnFXodDV1ZJkBQRZ4H/sacred_body_elixir_or_mist.svg`;
    }

    const payload: ActionPostResponse = {
      type: "post",
      message: `Selected Flower: ${selectedFlower}`,
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
            icon: `${actionIcon}`,
            title: `Which one will you use 5x a day?`,
            description: `Both are quick, easy and equally effective. Feel stabilized immediately ~ notice an exponential impact over time.`,
            label: "Select a product type",
            links: {
              actions: [
                {
                  type: "message",
                  href: `/lotus/quiz-purchase?selectedFlower=${selectedFlower}&selectedProductType=elixir`,
                  label: `Elixir`,
                } as LinkedAction,
                {
                  type: "message",
                  href: `/lotus/quiz-purchase?selectedFlower=${selectedFlower}&selectedProductType=mist`,
                  label: `Mist`,
                } as LinkedAction,
              ],
            },
            error: {
              message: "Failed to select product type",
            },
          },
        },
      },
    };
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /purchase:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to select product type" });
  }
});

router.post("/quiz-purchase", async (req, res, next) => {
  try {
    const { selectedFlower, selectedProductType } = req.query;
    console.log("req.query: ", req.query);

    if (!selectedFlower) {
      console.error("Missing query parameters from flower selection!!!");
      throw Error("Missing required parameters");
    }
    if (!selectedProductType) {
      console.error("Missing query parameters from product type!!!");
      throw Error("Missing required parameters");
    }

    let clickcrateId = ``;
    if (selectedFlower == "1" && selectedProductType == "elixir") {
      clickcrateId = `46tdrYMQyvwWCcNePL8F6dm3siit7ttW7V2m1bDnPTZP`;
    } else if (selectedFlower == "1" && selectedProductType == "mist") {
      clickcrateId = `46tdrYMQyvwWCcNePL8F6dm3siit7ttW7V2m1bDnPTZP`;
    } else if (selectedFlower == "2" && selectedProductType == "elixir") {
      clickcrateId = `46tdrYMQyvwWCcNePL8F6dm3siit7ttW7V2m1bDnPTZP`;
    } else if (selectedFlower == "2" && selectedProductType == "mist") {
      clickcrateId = `46tdrYMQyvwWCcNePL8F6dm3siit7ttW7V2m1bDnPTZP`;
    } else if (selectedFlower == "3" && selectedProductType == "elixir") {
      clickcrateId = `46tdrYMQyvwWCcNePL8F6dm3siit7ttW7V2m1bDnPTZP`;
    } else if (selectedFlower == "3" && selectedProductType == "mist") {
      clickcrateId = `46tdrYMQyvwWCcNePL8F6dm3siit7ttW7V2m1bDnPTZP`;
    }

    if (clickcrateId === ``) {
      return res.status(400).json({ message: "ClickCrate not found" });
    }

    const clickcrateAssetResponse = await fetchRegisteredClickcrate(
      clickcrateId
    );
    const clickcrateAsset = clickcrateAssetResponse.data;
    if (!clickcrateAsset.product) {
      return res
        .status(404)
        .json({ message: "Product not found in ClickCrate" });
    }

    const currentNetwork = process.env.CURRENT_NETWORK as "devnet" | "mainnet";
    if (!currentNetwork) {
      return res.status(404).json({ message: "Network not found" });
    }
    const productListingAsset = await fetchDasCoreCollection(
      clickcrateAsset.product,
      currentNetwork
    );

    const productListingResponse = await fetchRegisteredProductListing(
      clickcrateAsset.product
    );
    const productListing = productListingResponse.data;
    if (!productListingAsset || !productListing) {
      return res.status(404).json({ message: "Product info not found" });
    }

    const response = await fetch(productListingAsset.uri);
    const jsonImageData = await response.json();
    const icon =
      jsonImageData.image ||
      "https://shdw-drive.genesysgo.net/3CjrSiTMjg73qjNb9Phpd54sT2ZNXM6YmUudRHvwwppx/clickcrate%20pos%20placeholder.svg";

    let productSizeAttr: MetaplexAttribute | undefined;
    productSizeAttr = productListingAsset.content.metadata.attributes?.find(
      (attr: MetaplexAttribute) => attr.trait_type === "Size(s)"
    );
    if (!productSizeAttr && productListingAsset.attributes) {
      productSizeAttr = productListingAsset.attributes.attributeList.find(
        (attr: any) => attr.key === "Size(s)"
      );
    }

    let productSizes: { label: string; value: string }[] = [];
    if (productSizeAttr && productSizeAttr.value !== undefined) {
      if (
        typeof productSizeAttr.value === "string" &&
        productSizeAttr.value.includes(",")
      ) {
        productSizes = parseSizes(productSizeAttr.value);
      } else {
        productSizes = [
          {
            label: String(productSizeAttr.value),
            value: String(productSizeAttr.value),
          },
        ];
      }
    }

    const inStock = parseInt(productListing.inStock, 10);
    const disable = inStock < 1 || isNaN(inStock);
    const salePrice = productListing.price / LAMPORTS_PER_SOL;
    const buttonText = disable ? "SOLD OUT" : `Buy for ${salePrice} SOL`;

    const payload: ActionPostResponse = {
      type: "post",
      message: `Selected Flower: ${selectedFlower}`,
      links: {
        next: {
          type: "inline",
          action: {
            type: "action",
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
                  type: "transaction",
                  href: `/merch/purchase?clickcrateId=${clickcrateId}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
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
                {
                  type: "external-link",
                  href: `https://www.lotuswei.com/`,
                  label: "LOTUSWEI WEBSITE",
                } as LinkedAction,
              ],
            },
          },
        },
      },
    };
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /purchase:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to purchase" });
  }
});

router.post("/purchase", async (req, res, next) => {
  try {
    const { account } = req.body;
    const {
      size,
      buyerName,
      shippingEmail,
      shippingAddress,
      shippingCity,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
    } = req.body.data;
    const {
      clickcrateId,
      productName,
      productSizes,
      productDescription,
      productIcon,
    } = req.query;
    console.log("req.query: ", req.query);

    if (!account) {
      console.error("Missing account: ", account);
      throw Error("Missing required parameters");
    }

    if (
      !clickcrateId ||
      !productName ||
      !productSizes ||
      !productDescription ||
      !productIcon
    ) {
      console.error("Missing query parameters in purchase!!!");
      throw Error("Missing required parameters");
    }

    if (
      !size ||
      !buyerName ||
      !shippingEmail ||
      !shippingAddress ||
      !shippingCity ||
      !shippingStateProvince ||
      !shippingCountryRegion ||
      !shippingZipCode
    ) {
      console.error("Missing body parameters in purchase!!!");
      throw Error("Missing required parameters");
    }

    const publicKey = new PublicKey(account);
    const purchaseData = {
      clickcrateId: clickcrateId as string,
      size,
      quantity: 1,
      buyer: publicKey.toString(),
      payer: publicKey.toString(),
      paymentProcessor: "solana" as "solana" | "stripe",
      shippingName: buyerName,
      shippingEmail,
      shippingAddress,
      shippingCity,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
    };

    const result = await makeBlinkPurchase(purchaseData);
    if (result.status !== 200) {
      throw new Error(`Purchase initiation failed: ${result.data.message}`);
    }

    const paymentTx = result.data.transaction;
    const payload: ActionPostResponse = {
      type: "transaction",
      transaction: paymentTx,
      message: `Your purchase of ${productName} is confirmed. Order confirmation emailed to: ${shippingEmail}`,
      links: {
        next: {
          type: "inline",
          action: {
            type: "completed",
            icon: `${productIcon}`,
            title: `Order Confirmed`,
            description: `Your purchase of ${productName} is confirmed! An order confirmation has been emailed to: ${shippingEmail}`,
            label: `Purchase Complete`,
          },
        },
      },
    };
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /purchase:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to purchase" });
  }
});

router.get("/:clickcrateId", async (req, res, next) => {
  try {
    const { clickcrateId } = req.params;
    if (!clickcrateId || clickcrateId === "") {
      return res.status(400).json({ message: "ClickCrate not found" });
    }

    const clickcrateAssetResponse = await fetchRegisteredClickcrate(
      clickcrateId
    );
    const clickcrateAsset = clickcrateAssetResponse.data;
    if (!clickcrateAsset.product) {
      return res
        .status(404)
        .json({ message: "Product not found in ClickCrate" });
    }

    const productListingAsset = await fetchDasCoreCollection(
      clickcrateAsset.product,
      "devnet"
    );
    const productListingResponse = await fetchRegisteredProductListing(
      clickcrateAsset.product
    );
    const productListing = productListingResponse.data;
    if (!productListingAsset || !productListing) {
      return res.status(404).json({ message: "Product info not found" });
    }

    const response = await fetch(productListingAsset.uri);
    const jsonImageData = await response.json();
    const icon =
      jsonImageData.image ||
      "https://shdw-drive.genesysgo.net/3CjrSiTMjg73qjNb9Phpd54sT2ZNXM6YmUudRHvwwppx/clickcrate%20pos%20placeholder.svg";

    let productSizeAttr: MetaplexAttribute | undefined;
    productSizeAttr = productListingAsset.content.metadata.attributes?.find(
      (attr: MetaplexAttribute) => attr.trait_type === "Size(s)"
    );
    if (!productSizeAttr && productListingAsset.attributes) {
      productSizeAttr = productListingAsset.attributes.attributeList.find(
        (attr: any) => attr.key === "Size(s)"
      );
    }

    let productSizes: { label: string; value: string }[] = [];
    if (productSizeAttr && productSizeAttr.value !== undefined) {
      if (
        typeof productSizeAttr.value === "string" &&
        productSizeAttr.value.includes(",")
      ) {
        productSizes = parseSizes(productSizeAttr.value);
      } else {
        productSizes = [
          {
            label: String(productSizeAttr.value),
            value: String(productSizeAttr.value),
          },
        ];
      }
    }

    const inStock = parseInt(productListing.inStock, 10);
    const disable = inStock < 1 || isNaN(inStock);
    const salePrice = productListing.price / LAMPORTS_PER_SOL;
    const buttonText = disable ? "SOLD OUT" : `Buy for ${salePrice} SOL`;

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
          // {
          //   type: "external-link",
          //   href: `/merch/orders?clickcrateId=${clickcrateId}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
          //   label: "My Orders",
          // } as LinkedAction,
          {
            type: "transaction",
            href: `/merch/purchase?clickcrateId=${clickcrateId}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
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
    res.status(200).json(responseBody);
  } catch (error) {
    console.error("Error in GET merch blink /:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to get merch blink" });
  }
});

export default router;
