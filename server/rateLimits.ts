import rateLimit from "express-rate-limit";

const isProd = process.env.NODE_ENV === "production";

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
