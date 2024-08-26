import axios from "axios";
import { ProductInfo } from "../schemas/creator";

const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;
const CLICKCRATE_API_KEY = process.env.CLICKCRATE_API_KEY;

export async function createProductListing(productInfo: ProductInfo) {
  try {
    const response = await axios.post(
      `${CLICKCRATE_API_URL}/v1/product-listing/register`,
      productInfo,
      {
        headers: {
          Authorization: `Bearer ${CLICKCRATE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error creating product listing:", error);
    throw error;
  }
}

export async function activateProductListing(productListingId: string) {
  try {
    const response = await axios.post(
      `${CLICKCRATE_API_URL}/v1/product-listing/activate`,
      { productListingId },
      {
        headers: {
          Authorization: `Bearer ${CLICKCRATE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error activating product listing:", error);
    throw error;
  }
}

export async function generateBlinkUrl(posId: string) {
  try {
    const response = await axios.post(
      `${CLICKCRATE_API_URL}/v1/blink/generate`,
      { posId },
      {
        headers: {
          Authorization: `Bearer ${CLICKCRATE_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.blinkUrl;
  } catch (error) {
    console.error("Error generating Blink URL:", error);
    throw error;
  }
}
