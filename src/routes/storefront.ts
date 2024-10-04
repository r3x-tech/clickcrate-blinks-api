import express from "express";
import { z } from "zod";
import axios from "axios";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import {
  ActionGetResponse,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
} from "@solana/actions";

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

const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

// Step 1: Choose product type
router.get("/", (req, res) => {
  console.log(req.query);
  const { pos1, pos2, pos3 } = req.query;

  // Fetch details for each registered pos
  // fetchRegisteredClickcrate(pos1)
  // fetchRegisteredClickcrate(pos2)
  // fetchRegisteredClickcrate(pos3)

  // Fetch details for each registered product listing thats placed in each pos
  // fetchRegisteredProductListing(pos1)
  // fetchRegisteredProductListing(pos2)
  // fetchRegisteredProductListing(pos3)

  // Create svg from the four icon for each item (leave for last, can temporarily/as fallback use this: https://shdw-drive.genesysgo.net/3CjrSiTMjg73qjNb9Phpd54sT2ZNXM6YmUudRHvwwppx/clickcrate_storefront.svg

  // Set label to product listing name

  // Make # of POSs optional 1-4

  const payload: ActionGetResponse = {
    icon: "https://shdw-drive.genesysgo.net/CiJnYeRgNUptSKR4MmsAPn7Zhp6LSv91ncWTuNqDLo7T/autofill_checkout_button_bottom.png",
    label: "Choose a product",
    type: "action",
    title: "Product aggregator",
    description: "A blink that allows you to aggregate multiple products",
    links: {
      actions: [
        {
          href: `/merch/purchase?clickcrateId=${pos1}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
          label: "Shirt",
        },
        {
          href: `/merch/purchase?clickcrateId=${pos2}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
          label: "Cap",
        },
        {
          href: `/merch/purchase?clickcrateId=${pos1}&productName=${productListingAsset.content.metadata.name}&productSizes=${productSizeAttr?.value}&productIcon=${icon}&productDescription=${productListingAsset.content.metadata.description}`,
          label: "Belt",
        },
      ],
    },
  };
  res.status(200).json(payload);
});

export default router;
