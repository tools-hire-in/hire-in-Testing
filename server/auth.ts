import bcrypt from "bcryptjs";
import { Request, Response, NextFunction, Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { adminUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  }
}

// Setup session middleware
export function setupSession(app: Express) {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  app.set("trust proxy", 1);

  const cookieConfig: session.CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionTtl,
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

// Role-based auth middleware
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
