import { z } from "zod";
import { VALID_DATABASES } from "./constants.js";

// Strict domain validation (no protocol, valid hostname)
export const domainSchema = z
  .string()
  .min(3, "Le domaine doit contenir au moins 3 caractères")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/,
    "Format de domaine invalide (ex: example.com, sans http://)"
  );

// Database must be in the valid list
export const databaseSchema = z
  .string()
  .default("fr")
  .refine((val) => (VALID_DATABASES as readonly string[]).includes(val), {
    message: `Base de données invalide. Valeurs acceptées : ${VALID_DATABASES.join(", ")}`,
  });

// Date in YYYYMMDD format
export const dateSchema = z
  .string()
  .regex(/^\d{8}$/, "Format de date invalide (attendu: YYYYMMDD)")
  .optional();

// Keywords array with dedup
export const keywordsArraySchema = z
  .array(z.string().min(1, "Mot-clé ne peut pas être vide"))
  .transform((arr) => [...new Set(arr)]);

// Limit with bounds
export const limitSchema = z
  .number()
  .min(1, "La limite doit être >= 1")
  .max(10000, "La limite ne peut pas dépasser 10 000")
  .default(50);

// Target for backlinks
export const targetSchema = z
  .string()
  .min(3, "La cible doit contenir au moins 3 caractères");

// Sort order
export const sortSchema = z
  .string()
  .default("tr_desc");
