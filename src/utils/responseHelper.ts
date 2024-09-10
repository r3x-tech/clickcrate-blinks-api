import { Response } from "express";
import { ACTIONS_CORS_HEADERS_MIDDLEWARE } from "@solana/actions";

export const sendResponse = (res: Response, statusCode: number, body: any) => {
  return res.status(statusCode).set(ACTIONS_CORS_HEADERS_MIDDLEWARE).json(body);
};

export const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string
) => {
  return sendResponse(res, statusCode, { message });
};
