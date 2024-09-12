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

// export async function createProductListing(productInfo: ProductInfo) {
//   try {
//     const response = await clickcrateAxios.post(
//       "/v1/product-listing/register",
//       productInfo
//     );
//     return response.data;
//   } catch (error) {
//     console.error("Error creating product listing:", error);
//     throw error;
//   }
// }

// export async function activateProductListing(productListingId: string) {
//   try {
//     const response = await clickcrateAxios.post(
//       "/v1/product-listing/activate",
//       {
//         productListingId,
//       }
//     );
//     return response.data;
//   } catch (error) {
//     console.error("Error activating product listing:", error);
//     throw error;
//   }
// }

export async function generateBlinkUrl(posId: string) {
  try {
    return `https://api.clickcrate.xyz/blink/${posId}`;
  } catch (error) {
    console.error("Error generating Blink URL:", error);
    throw error;
  }
}

export async function registerClickCrate(clickcrateData: {
  clickcrateId: string;
  eligiblePlacementType: string;
  eligibleProductCategory: string;
  manager: string;
}) {
  try {
    const response = await clickcrateAxios.post(
      "/v1/clickcrate/register",
      clickcrateData
    );
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error registering ClickCrate:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}

export async function activateClickCrate(clickcrateId: string) {
  try {
    const response = await clickcrateAxios.post("/v1/clickcrate/activate", {
      clickcrateId,
    });
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error activating ClickCrate:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}

export async function registerProductListing(productListingData: {
  productListingId: string;
  origin: string;
  eligiblePlacementType: string;
  eligibleProductCategory: string;
  manager: string;
  price: number;
  orderManager: string;
}) {
  try {
    const response = await clickcrateAxios.post(
      "/v1/product-listing/register",
      productListingData
    );
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error registering product listing:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}

export async function activateProductListing(productListingId: string) {
  try {
    const response = await clickcrateAxios.post(
      "/v1/product-listing/activate",
      { productListingId }
    );
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error activating product listing:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}

export async function placeProductListing(placeProductData: {
  productListingId: string;
  clickcrateId: string;
  price: number;
}) {
  try {
    const response = await clickcrateAxios.post(
      "/v1/product-listing/place",
      placeProductData
    );
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error placing product listing:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}

export async function initiateVerification(email: string) {
  try {
    const response = await clickcrateAxios.post("/v1/initiate-verification", {
      email,
    });
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error initiating verification:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}

export async function verifyCode(email: string, code: string) {
  try {
    const response = await clickcrateAxios.post("/v1/verify-code", {
      email,
      code,
    });
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    console.error("Error verifying code:", error);
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data || { message: "Unknown error occurred" },
      };
    }
    throw error;
  }
}
