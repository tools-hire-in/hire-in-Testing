import bcrypt from "bcryptjs";
import { Request, Response, NextFunction, Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { adminUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { resolveRoles } from "@shared/accessControl";

const SALT_ROUNDS = 12;

// Password utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session type augmentation
declare module "express-session" {
  interface SessionData {
    userId: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
    // Stable anonymous identifier used to attribute public reactions to a
    // visitor without requiring login. Hashed before storage.
    anonId: string;
    // Per-article last-view timestamps (ms) used to rate-limit counted article
    // views for the Content Studio analytics dashboard (1/session/hour).
    studioViews?: Record<string, number>;
  }
}

// Setup session middleware
export function setupSession(app: Express) {
  const sessionTtlSeconds = 30 * 60; // 30 minutes in seconds
  const sessionTtlMs = sessionTtlSeconds * 1000; // 30 minutes in milliseconds (for cookie)
  const pgStore = connectPg(session);
  // Reuse the app's single bounded pool (server/db.ts) instead of opening a
  // second unbounded pool. A shift-start login burst hits the session store
  // hard; sharing one bounded pool prevents connection exhaustion.
  const sessionStore = new pgStore({
    pool,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds,
    tableName: "sessions",
  });

  app.set("trust proxy", 1);

  const cookieConfig: session.CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionTtlMs,
    sameSite: "lax" as const,
  };

  if (process.env.COOKIE_DOMAIN) {
    cookieConfig.domain = process.env.COOKIE_DOMAIN;
  }

  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: cookieConfig,
    })
  );
}

// Auth middleware - checks if user is authenticated
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Middleware to enforce 2FA setup - blocks API access if 2FA not enabled
// Excludes auth routes and TOTP setup routes
const TOTP_EXEMPT_PATHS = [
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/totp/status",
  "/api/auth/totp/setup",
  "/api/auth/totp/verify",
  "/api/auth/totp/disable",
  "/api/auth/totp/admin-reset",
  "/api/hr/my-profile",
];

export async function require2FA(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  if (!req.session.userId) {
    return next();
  }

  if (TOTP_EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith(p + "/"))) {
    return next();
  }

  const [user] = await db
    .select({ totpEnabled: adminUsers.totpEnabled })
    .from(adminUsers)
    .where(eq(adminUsers.id, req.session.userId))
    .limit(1);

  if (user && !user.totpEnabled) {
    return res.status(403).json({ message: "Two-factor authentication must be enabled before accessing this resource." });
  }

  next();
}

// Role-based auth middleware (legacy: exact list, no auto-grant)
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!allowedRoles.includes(req.session.role!)) {
      return res.status(403).json({ message: "Forbidden - insufficient permissions" });
    }
    next();
  };
}

// Centralized permission middleware — resolves allowed roles via the central
// access registry (when the flag is on) or the provided fallback (legacy).
// Preserves the no-auto-grant semantics of requireRole and its error shapes.
export function requirePermission(featureKey: string, ...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const allowed = resolveRoles(featureKey, allowedRoles);
    if (!allowed.includes(req.session.role!)) {
      return res.status(403).json({ message: "Forbidden - insufficient permissions" });
    }
    next();
  };
}

// Get current user from session
export async function getCurrentUser(req: Request) {
  if (!req.session.userId) {
    return null;
  }
  
  const [user] = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      firstName: adminUsers.firstName,
      lastName: adminUsers.lastName,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
      totpEnabled: adminUsers.totpEnabled,
      employeeId: adminUsers.employeeId,
      salary: adminUsers.salary,
      gender: adminUsers.gender,
      attendanceExempt: adminUsers.attendanceExempt,
      trainingExempt: adminUsers.trainingExempt,
      maternityLeaveEligible: adminUsers.maternityLeaveEligible,
      employmentType: adminUsers.employmentType,
      preferences: adminUsers.preferences,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, req.session.userId))
    .limit(1);
  
  return user || null;
}

// Create session for user after login
export function createSession(req: Request, user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}) {
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.role = user.role;
  req.session.firstName = user.firstName;
  req.session.lastName = user.lastName;
}

// Destroy session on logout
export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
