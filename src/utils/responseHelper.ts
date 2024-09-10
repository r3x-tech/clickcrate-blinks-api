import { Response } from "express";
import {
  ACTIONS_CORS_HEADERS,
  ACTIONS_CORS_HEADERS_MIDDLEWARE,
  BLOCKCHAIN_IDS,
} from "@solana/actions";

export const sendResponse = (res: Response, statusCode: number, body: any) => {
  return res.status(statusCode).set(ACTIONS_CORS_HEADERS_MIDDLEWARE).json(body);
  // .set({
  //   ...ACTIONS_CORS_HEADERS,
  //   "X-Action-Version": "2.1.3",
  //   "X-Blockchain-Ids": [BLOCKCHAIN_IDS.devnet, BLOCKCHAIN_IDS.mainnet],
  //   "X-Blockchain-Ids":
  //     "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp,solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  // });
};

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string
) => {
  return sendResponse(res, statusCode, { message });
};
