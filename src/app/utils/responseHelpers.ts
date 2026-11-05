import { Response } from "express";
import logger from "./logger";

export const successResponse = (
  res: Response,
  message = "Success",
  data?: any,
  statusCode = 200
) => {
  // Already answered (e.g. the request timed out while the AI was still working)
  if (res.headersSent) {
    logger.warn(`Response already sent, dropping: ${message}`);
    return res;
  }
  return res.status(statusCode).json({ success: true, message, data });
};

export const errorResponse = (
  res: Response,
  errorMessage: any,
  statusCode = 400,
  errordata?: any
) => {
  // Si errordata no es un Error, lo convertimos a uno para tener un stack
  const errorInstance =
    errordata instanceof Error
      ? errordata
      : new Error(
          errordata
            ? typeof errordata === "object"
              ? JSON.stringify(errordata)
              : String(errordata)
            : String(errorMessage)
        );

  logger.error("Error Response:", {
    message: errorMessage + " - " + errordata,
    stack: errorInstance.stack || "No stack available",
  });

  if (res.headersSent) {
    // A stream broke halfway: cut the connection so the client sees a failure, not a short answer
    if (!res.writableEnded) res.destroy();
    return res;
  }
  return res.status(statusCode).json({ success: false, error: errorMessage });
};
