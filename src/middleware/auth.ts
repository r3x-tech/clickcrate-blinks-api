import { Request, Response, NextFunction } from "express";
import axios from "axios";

const CLICKCRATE_API_URL = process.env.CLICKCRATE_API_URL;

export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key is missing" });
  }

  try {
    const response = await axios.post(
      `${CLICKCRATE_API_URL}/v1/auth/validate-api-key`,
      { apiKey },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.valid) {
      next();
    } else {
      res.status(401).json({ error: "Invalid API key" });
    }
  } catch (error) {
    console.error("Error validating API key:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
