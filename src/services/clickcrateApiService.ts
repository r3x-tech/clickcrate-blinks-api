import axios from "axios";
import { ProductInfo } from "../models/schemas";

const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;
const CLICKCRATE_API_KEY = process.env.CLICKCRATE_API_KEY;

const clickcrateAxios = axios.create({
  baseURL: CLICKCRATE_API_URL,
  headers: {
    Authorization: `Bearer ${CLICKCRATE_API_KEY}`,
    "Content-Type": "application/json",
  },
});

export async function createProductListing(productInfo: ProductInfo) {
  try {
    const response = await clickcrateAxios.post(
      "/v1/product-listing/register",
      productInfo
    );
    return response.data;
  } catch (error) {
    console.error("Error creating product listing:", error);
    throw error;
  }
}

export async function activateProductListing(productListingId: string) {
  try {
    const response = await clickcrateAxios.post(
      "/v1/product-listing/activate",
      {
        productListingId,
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
    const response = await clickcrateAxios.post("/v1/blink/generate", {
      posId,
    });
    return response.data.blinkUrl;
  } catch (error) {
    console.error("Error generating Blink URL:", error);
    throw error;
  }
}

export async function initiateVerification(email: string) {
  try {
    const response = await clickcrateAxios.post("/v1/initiate-verification", {
      email,
    });
    return response.data;
  } catch (error) {
    console.error("Error initiating verification:", error);
    throw error;
  }
}

export async function verifyCode(email: string, code: string) {
  try {
    const response = await clickcrateAxios.post("/v1/verify-code", {
      email,
      code,
    });
    return response.data;
  } catch (error) {
    console.error("Error verifying code:", error);
    throw error;
  }
}
