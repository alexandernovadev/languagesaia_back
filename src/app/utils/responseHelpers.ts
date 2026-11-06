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

/** What usually causes each failure, said plainly for whoever sees the error. */
const HINTS: Array<[RegExp, string]> = [
  [/insufficient|credit|balance|quota|billing|exhausted|payment|\b402\b/i, "Se acabó el saldo del proveedor de IA. Hay que recargar la cuenta."],
  [/invalid api key|unauthorized|authentication|\b401\b|\b403\b/i, "El proveedor rechazó la clave. Revisa la clave en el archivo .env."],
  [/rate limit|too many|\b429\b/i, "El proveedor recibió demasiados pedidos. Espera un momento e inténtalo otra vez."],
  [/timeout|timed out|etimedout|aborted/i, "El servicio tardó demasiado en responder. Inténtalo otra vez."],
  [/econnrefused|enotfound|fetch failed|network|socket/i, "No se pudo conectar con un servicio externo. Revisa que esté en línea."],
  [/e11000|duplicate/i, "Eso ya existe, no se puede crear otra vez."],
  [/validation failed|cast to/i, "Los datos no pasaron la validación."],
  [/json|incomplete|unexpected token/i, "La IA devolvió una respuesta incompleta. Vuelve a intentarlo."],
  [/pocketbase|lecture_audio|word_images/i, "Falló el guardado en PocketBase. Revisa que el servidor esté en línea."],
];

export const explainError = (reason: string) => HINTS.find(([pattern]) => pattern.test(reason))?.[1] ?? "";

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
  const reason = errordata ? errorInstance.message : String(errorMessage);
  return res.status(statusCode).json({
    success: false,
    error: errorMessage,
    detail: { reason: reason.slice(0, 500), hint: explainError(reason) },
  });
};
