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
          } as LinkedAction,
          {
            type: "external-link",
            href: "/api/action?type=external-link&stage=1",
            label: "External Link",
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
    const relayTx = await relayPaymentTransaction(0.001, publicKey, "mainnet");
    console.log("Initiating verification");

    const paymentTx = Buffer.from(relayTx.serialize()).toString("base64");
    console.log("Responding with this paymentTx: ", paymentTx);

    // const payload: ActionPostResponse = {
    //   transaction: paymentTx,
    //   message: `Purchase successful! Order confirmation emailed to: ${shippingEmail}`,
    //   links: {
    //     next: {
    //       type: "inline",
    //       action: {
    //         type: "completed",
    //         icon: `${productIcon}`,
    //         label: "Purchase successful!",
    //         title: `${productName}`,
    //         description: `Order confirmation emailed to: ${shippingEmail}`,
    //       },
    //     },
    //   },
    // };

    // const payload: ActionPostResponse = {
    //   type: "transaction",
    //   icon: productIcon,
    //   message: "Verification code resent. Please check your email.",
    //   links: {
    //     next: {
    //       type: "inline",
    //       href: ,
    //       links: {
    //         actions: [
    //           {
    //             href: `/creator/verify-and-place?pos=${pos}&listing=${listing}&products=${products}&price=${price}&account=${account}&email=${email}`,
    //             label: "Verify and Place Product",
    //             parameters: [
    //               {
    //                 name: "code",
    //                 label: "6-digit Verification Code",
    //                 type: "text",
    //                 required: true,
    //               },
    //             ],
    //           },

    //         ],
    //       },
    //     },
    //   },
    //   transaction: paymentTx,
    // };

    const payload: ActionPostResponse = {
      type: "transaction",
      transaction: paymentTx,
      message: `Your purchase of ${productName} is complete. Order confirmation emailed to: ${shippingEmail}`,
      // links: {
      //   next: {
      //     type: "post",
      //     href: "/merch/completed",
      //   } as NextActionLink,
      // },
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
