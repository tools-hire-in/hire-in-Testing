import rateLimit from "express-rate-limit";
import { config } from "./config";

const isProd = config.isProductionSecurity;

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
  skip: () => false,
});

export const vaultRevealLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reveal attempts. Please wait 15 minutes and try again." },
  skip: () => false,
});

export const vaultCopyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: isProd ? 60 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many copy attempts. Please wait and try again." },
  skip: () => false,
});

export const tokenLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again.", retryAfter: 60 },
  skip: () => false,
});

export const verifyLetterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification requests. Please wait a moment and try again.", retryAfter: 60 },
  skip: () => false,
});
