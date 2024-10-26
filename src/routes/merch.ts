import express from "express";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionResponse,
} from "@solana/web3.js";
import { Attribute, MetaplexAttribute } from "../models/schemas";
import {
  ActionGetResponse,
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
import {
  getCoinGeckoSolUsdPrice,
  relayPaymentTransaction,
} from "../services/solanaService";

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

router.get("/:clickcrateId", async (req, res, next) => {
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

    let productSizeAttr: MetaplexAttribute | undefined;

    productSizeAttr = productListingAsset.content.metadata.attributes?.find(
      (attr: MetaplexAttribute) => attr.trait_type === "Size(s)"
    );

    if (!productSizeAttr && productListingAsset.attributes) {
      productSizeAttr = productListingAsset.attributes.attributeList.find(
        (attr: any) => attr.key === "Size(s)"
      );
    }

    console.log("Found productSizeAttr:", productSizeAttr);

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
    console.log("fetched productSizes: ", productSizes);

    const inStock = parseInt(productListing.inStock, 10);
    const disable = inStock < 1 || isNaN(inStock);
    console.log("blink disabled? ", disable);

    const salePrice = productListing.price / LAMPORTS_PER_SOL;
    // const buttonText = disable ? "SOLD OUT" : `Buy for ${salePrice} SOL`;
    const buttonText = disable ? "Sold Out" : `Purchase`;

    console.log("buttonText: ", buttonText);

    const solPrice = await getCoinGeckoSolUsdPrice();
    const usdPrice = Math.round(salePrice * solPrice * 100) / 100;

    let paymentProcessors: { label: string; value: string }[] = [
      { label: `Buy with Solana for ${salePrice} SOL`, value: "solana" },
      { label: `Buy with Credit/Debit for $${usdPrice} USD`, value: "stripe" },
    ];

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
                name: "paymentProcessor",
                label: "Select a payment method",
                required: true,
                type: "select",
                options: paymentProcessors,
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
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to get merch blink" });
  }
});

router.post("/purchase", async (req, res, next) => {
  try {
    const { account } = req.body;
    const {
      size,
      paymentProcessor,
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
      !paymentProcessor ||
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
    // const relayTx = await relayPaymentTransaction(0.001, publicKey, "mainnet");
    // console.log("Initiating verification");

    // const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
    // console.log("Responding with this paymentTx: ", paymentTx);

    const purchaseData = {
      clickcrateId: clickcrateId as string,
      size,
      quantity: 1,
      buyer: publicKey.toString(),
      payer: publicKey.toString(),
      // paymentProcessor: "solana" as "solana" | "stripe",
      paymentProcessor: paymentProcessor as "solana" | "stripe",
      shippingName: buyerName,
      shippingEmail,
      shippingAddress,
      shippingCity,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
    };

    let payload: ActionPostResponse = {
      type: "post",
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

    if (paymentProcessor === "stripe") {
      payload = {
        type: "post",
        // message: `Your purchase of ${productName} is confirmed. Order confirmation emailed to: ${shippingEmail}`,
        links: {
          next: {
            type: "inline",
            action: {
              type: "action",
              icon: `${productIcon}`,
              label: `Payment Details`,
              // title: `${productName}`,
              title: `Payment Details`,
              description: `Please enter your card information`,
              links: {
                actions: [
                  {
                    type: "post",
                    href: `/storefront/web2-purchase?clickcrateId=${clickcrateId}&productName=${productName}&productSizes=${productSizes}&productIcon=${productIcon}&productDescription=${productDescription}&size=${size}&paymentProcessor${paymentProcessor}&buyerName=${buyerName}&shippingEmail=${shippingEmail}&shippingAddress=${shippingAddress}&shippingCity=${shippingCity}&shippingStateProvince=${shippingStateProvince}&shippingCountryRegion=${shippingCountryRegion}&shippingZipCode=${shippingZipCode}`,
                    label: "Complete Purchase",
                    parameters: [
                      // {
                      //   name: "cardholderName",
                      //   label: "Cardholder Name",
                      //   required: true,
                      //   type: "text",
                      // },
                      // {
                      //   name: "sameName",
                      //   label: "Cardholder name same as shipping name?",
                      //   type: "checkbox",
                      //   options: [
                      //     {
                      //       label: `Yes, use shipping name ${buyerName}`,
                      //       value: "true",
                      //       selected: false,
                      //     },
                      //   ],
                      // },
                      {
                        name: "cardNumber",
                        label: "Card Number (1234 1234 1234 1234)",
                        // label: "1234 1234 1234 1234",
                        required: true,
                        type: "text",
                        pattern: "^[0-9]{4} [0-9]{4} [0-9]{4} [0-9]{4}$",
                        // pattern:
                        //   "^([0-9]{4}[s-]?){3}[0-9]{4}$|^([0-9]{4}[s-]?){2}[0-9]{6}$",
                        // patternDescription:
                        //   "Please enter a valid 16-digit card number with spaces",
                      },
                      {
                        name: "expiration",
                        label: "Expiration Date (MM/YY)",
                        // label: "MM/YY",
                        required: true,
                        type: "text",
                        pattern: "^(0[1-9]|1[0-2])/([0-9]{2})$",
                        // patternDescription:
                        //   "Please enter a valid expiration date in MM/YY format (e.g., 05/25)",
                      },
                      // {
                      //   name: "expirationMonth",
                      //   label: "Expiration Month",
                      //   required: true,
                      //   type: "select",
                      //   options: [
                      //     { label: "01 - January", value: "01" },
                      //     { label: "02 - February", value: "02" },
                      //     { label: "03 - March", value: "03" },
                      //     { label: "04 - April", value: "04" },
                      //     { label: "05 - May", value: "05" },
                      //     { label: "06 - June", value: "06" },
                      //     { label: "07 - July", value: "07" },
                      //     { label: "08 - August", value: "08" },
                      //     { label: "09 - September", value: "09" },
                      //     { label: "10 - October", value: "10" },
                      //     { label: "11 - November", value: "11" },
                      //     { label: "12 - December", value: "12" },
                      //   ],
                      // },
                      // {
                      //   name: "expirationYear",
                      //   label: "Expiration Year",
                      //   required: true,
                      //   type: "select",
                      //   options: [
                      //     { label: "2024", value: "24" },
                      //     { label: "2025", value: "25" },
                      //     { label: "2026", value: "26" },
                      //     { label: "2027", value: "27" },
                      //     { label: "2028", value: "28" },
                      //     { label: "2029", value: "29" },
                      //     { label: "2030", value: "30" },
                      //   ],
                      // },
                      {
                        name: "cvc",
                        label: "CVC",
                        required: true,
                        type: "text",
                      },
                      {
                        name: "billingAddress",
                        label: "Billing address is same as shipping?",
                        type: "checkbox",
                        options: [
                          {
                            label: `Yes, it is ${buyerName} ${shippingAddress} ${shippingCity}, ${shippingStateProvince} ${shippingCountryRegion} ${shippingZipCode}`,
                            value: "true",
                            selected: true,
                          },
                        ],
                      },
                    ],
                  } as LinkedAction,
                ],
              },
            },
          },
        },
      };
    } else {
      const result = await makeBlinkPurchase(purchaseData);

      if (result.status !== 200) {
        throw new Error(`Purchase initiation failed: ${result.data.message}`);
      }

      const paymentTx = result.data.transaction;

      payload = {
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
    }

    // if (paymentTx.trim() === '') {
    //   throw new Error(`Payment tx `);
    // }

    console.log("Sending response:", JSON.stringify(payload, null, 2));
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /purchase:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to purchase" });
  }
});

router.post("/web2-purchase", async (req, res, next) => {
  try {
    const { account } = req.body;
    // const { cardholderName, cardNunber, sameName, expiration, cvc } = req.body.data;
    const { cardholderName, cardNumber, expiration, cvc } = req.body.data;
    if (!cardholderName || !cardNumber || !expiration || !cvc) {
      console.error("Missing query parameters in purchase!!!");
      throw Error("Missing required parameters");
    }

    const {
      clickcrateId,
      productName,
      // productSizes,
      // productDescription,
      productIcon,
      size,
      paymentProcessor,
      buyerName,
      shippingEmail,
      shippingAddress,
      shippingCity,
      shippingStateProvince,
      shippingCountryRegion,
      shippingZipCode,
    } = req.query;
    console.log("req.query: ", req.query);

    if (!account) {
      console.error("Missing account: ", account);
      throw Error("Missing required parameters");
    }

    if (
      !clickcrateId ||
      !productName ||
      // !productSizes ||
      // !productDescription ||
      !productIcon ||
      !size ||
      !paymentProcessor ||
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
    // const relayTx = await relayPaymentTransaction(0.001, publicKey, "mainnet");
    // console.log("Initiating verification");

    // const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
    // console.log("Responding with this paymentTx: ", paymentTx);

    const purchaseData = {
      clickcrateId: clickcrateId as string,
      size: size as string,
      quantity: 1,
      buyer: publicKey.toString(),
      payer: publicKey.toString(),
      // paymentProcessor: "solana" as "solana" | "stripe",
      paymentProcessor: paymentProcessor as "solana" | "stripe",
      shippingName: buyerName as string,
      shippingEmail: shippingEmail as string,
      shippingAddress: shippingAddress as string,
      shippingCity: shippingAddress as string,
      shippingStateProvince: shippingAddress as string,
      shippingCountryRegion: shippingAddress as string,
      shippingZipCode: shippingAddress as string,
    };

    // const result = await makeStripePurchase(purchaseData);

    // if (result.status !== 200) {
    //   throw new Error(`Failed to make stripe purchase: ${result.data.message}`);
    // }

    const payload: ActionPostResponse = {
      type: "post",
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

    console.log("Sending response:", JSON.stringify(payload, null, 2));
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /purchase:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to purchase" });
  }
});

router.post("/chained/purchase", async (req, res, next) => {
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
    // const relayTx = await relayPaymentTransaction(0.001, publicKey, "mainnet");
    // console.log("Initiating verification");

    // const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
    // console.log("Responding with this paymentTx: ", paymentTx);

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

    const result = await initiatePurchase(purchaseData);

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
          // action: {
          //   type: "completed",
          //   icon: `${productIcon}`,
          //   title: `Order Confirmed`,
          //   description: `Your purchase of ${productName} is confirmed! An order confirmation has been emailed to: ${shippingEmail}`,
          //   label: `Purchase Complete`,
          // },
          action: {
            type: "action",
            icon: `${productIcon}`,
            title: `Please confirm the following is correct!`,
            description: `\nEmail: ${shippingEmail}
            \nShipping Info:\n${buyerName}\n${shippingAddress} ${shippingCity}, ${shippingStateProvince} ${shippingZipCode}\n${shippingCountryRegion}\n`,
            label: `Confirm Order`,
            links: {
              actions: [
                {
                  type: "post",
                  href: `/merch/completed?${productName}&${productIcon}&${shippingEmail}`,
                  // label: "Confirm",
                } as LinkedAction,
              ],
            },
          },
        },
      },
    };

    console.log("Sending response:", JSON.stringify(payload, null, 2));
    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in POST /purchase:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to purchase" });
  }
});

router.post("/chained/completed", async (req, res, next) => {
  try {
    console.log("completed req.body: ", req.body);
    console.log("completed req.body.data: ", req.body.data);
    const { account, clickcrateId, transactionId } = req.body;
    const { productName, productIcon, shippingEmail } = req.body.data;

    if (
      !account ||
      !clickcrateId ||
      !transactionId ||
      !productName ||
      !productIcon ||
      !shippingEmail
    ) {
      throw Error("Missing required parameters");
    }

    const completionData = {
      clickcrateId,
      transactionId,
    };

    const result = await completePurchase(completionData);

    if (result.status !== 200) {
      throw new Error(`Purchase completion failed: ${result.data.message}`);
    }

    const completedAction: CompletedAction = {
      type: "completed",
      icon: productIcon as string,
      label: "Purchase Completed",
      title: productName as string,
      description: `Your purchase of ${productName} is completed. An order confirmation has been emailed to ${shippingEmail}`,
    };

    const response: ActionPostResponse = {
      type: "post",
      message: "Purchase completed successfully!",
      links: {
        next: {
          type: "inline",
          action: completedAction,
        },
      },
    };

    console.log("Sending response:", JSON.stringify(response, null, 2));
    res.status(200).json(response);
  } catch (error) {
    console.error("Error in POST /completed:", error);
    res
      .status(400)
      .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
      .json({ message: "Failed to complete purchase" });
  }
});

// router.post("/orders", async (req, res, next) => {
//   try {
//     const { account } = req.body;

//     const {
//       clickcrateId,
//       productName,
//       productSizes,
//       productDescription,
//       productIcon,
//     } = req.query;
//     console.log("req.query: ", req.query);

//     if (!account) {
//       console.error("Missing account: ", account);
//       throw Error("Missing required parameters");
//     }

//     if (
//       !clickcrateId ||
//       !productName ||
//       !productSizes ||
//       !productDescription ||
//       !productIcon
//     ) {
//       console.error("Missing query parameters in purchase!!!");
//       throw Error("Missing required parameters");
//     }

//     const payload: ActionPostResponse = {
//       type: "external-link",
//       externalLink: `https://www.clickcrate.xyz`,
//       links: {
//         next: {
//           type: "inline",
//           action: {
//             type: "completed",
//             icon: `${productIcon}`,
//             title: `${productName}`,
//             description: `${productDescription}`,
//             label: `Completed`,
//           },
//         },
//       },
//     };

//     console.log("Sending response:", JSON.stringify(payload, null, 2));
//     res.status(200).json(payload);
//   } catch (error) {
//     console.error("Error in POST /purchase:", error);
//     res
//       .status(400)
//       .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
//       .json({ message: "Failed to purchase" });
//   }
// });

// router.post("/completed", async (req, res, next) => {
//   try {
//     const { account } = req.body;
//     const {
//       size,
//       buyerName,
//       shippingEmail,
//       shippingAddress,
//       shippingCity,
//       shippingStateProvince,
//       shippingCountryRegion,
//       shippingZipCode,
//     } = req.body.data;

//     const {
//       clickcrateId,
//       productName,
//       productSizes,
//       productDescription,
//       productIcon,
//     } = req.query;
//     console.log("req.query: ", req.query);

//     if (!account) {
//       console.error("Missing account: ", account);
//       throw Error("Missing required parameters");
//     }

//     if (
//       !clickcrateId ||
//       !productName ||
//       !productSizes ||
//       !productDescription ||
//       !productIcon
//     ) {
//       console.error("Missing query parameters in purchase!!!");
//       throw Error("Missing required parameters");
//     }

//     if (
//       !size ||
//       !buyerName ||
//       !shippingEmail ||
//       !shippingAddress ||
//       !shippingCity ||
//       !shippingStateProvince ||
//       !shippingCountryRegion ||
//       !shippingZipCode
//     ) {
//       console.error("Missing body parameters in purchase!!!");
//       throw Error("Missing required parameters");
//     }

//     // const publicKey = new PublicKey(account);
//     // const relayTx = await relayPaymentTransaction(0.001, publicKey, "mainnet");
//     // console.log("Initiating verification");

//     // const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
//     // console.log("Responding with this paymentTx: ", paymentTx);

//     const completedAction: CompletedAction = {
//       type: "completed",
//       icon: productIcon as string,
//       label: "Purchase Completed",
//       title: productName as string,
//       description: `Your purchase of ${productName} is complete. Order confirmation emailed to: ${shippingEmail}`,
//     };

//     const response: ActionPostResponse = {
//       type: "post",
//       message: "Purchase completed successfully!",
//       links: {
//         next: {
//           type: "inline",
//           action: completedAction,
//         },
//       },
//     };

//     console.log("Sending response:", JSON.stringify(response, null, 2));
//     res.status(200).json(response);
//   } catch (error) {
//     console.error("Error in POST /purchase:", error);
//     res
//       .status(400)
//       .set(ACTIONS_CORS_HEADERS_MIDDLEWARE)
//       .json({ message: "Failed to purchase" });
//   }
// });

export default router;
