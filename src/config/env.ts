/**
 * Loads .env. It must be the FIRST import of main.ts: many modules read
 * process.env the moment they are imported (aiConfig, authService, cloudinary…).
 */
import dotenv from "dotenv";

dotenv.config({ quiet: true });
