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

  // Fetch details for each registered product listing thats placed in each pos

  // Create svg from the four icon for each item (leave for last)

  // Make Label Product Name

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
          href: `https://api.clickcrate.xyz/blink/${pos1}`,
          label: "Shirt",
        },
        {
          href: `https://api.clickcrate.xyz/blink/${pos2}`,
          label: "Cap",
        },
        {
          href: `https://api.clickcrate.xyz/blink/${pos3}`,
          label: "Belt",
        },
      ],
    },
  };
  res.status(200).json(payload);
});

// router.post("/purchase/:productId", async (req, res) => {
//   try {
//     const payload: ActionPostResponse = {
//       transaction: "dummy_transaction_base64",
//       message: "This blink allows you to purchase",
//       links: {
//         next: {
//           type: "inline",
//           action: {
//             type: "action",
//             icon: "https://example.com/verify-icon.png",
//             label: "Buy product",
//             title: "Buy the specific product",
//             description: "Buy the product from this blink",
//             links: {
//               actions: [
//                 {
//                   href: `/api/procucts/`,
//                   label: "Back",
//                 },
//               ],
//             },
//           },
//         },
//       },
//     };
//     res.json(payload);
//   } catch (error) {
//     console.error("Error Buying the product:", error);
//     res.status(400).json({ error: "Invalid data" });
//   }
// });

export default router;
