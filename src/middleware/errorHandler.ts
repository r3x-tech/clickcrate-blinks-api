import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ActionError } from "@solana/actions";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  let errorResponse: ActionError;

  if (err instanceof ZodError) {
    errorResponse = {
      message: "Validation failed",
    };
    return res.status(400).json(errorResponse);
  }

  errorResponse = {
    message: err.message || "An unexpected error occurred",
  };

  res.status(500).json(errorResponse);
};
