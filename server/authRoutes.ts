import { Express } from "express";
import { db } from "./db";
import { adminUsers, loginSchema, registerAdminSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, requireAuth, createSession, destroySession, getCurrentUser, requireRole } from "./auth";
import { z } from "zod";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

export function registerAuthRoutes(app: Express) {
  // Login route (supports two-step TOTP)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const { email, password } = parsed.data;
      const totpCode = req.body.totpCode as string | undefined;

      if (!email.endsWith("@hire-in.com")) {
        return res.status(403).json({ message: "Only @hire-in.com email addresses are allowed" });
      }

      const [user] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.isActive) {
        return res.status(403).json({ message: "Account is deactivated. Contact your administrator." });
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.totpEnabled && user.totpSecret) {
        if (!totpCode) {
          return res.status(200).json({ totpRequired: true });
        }

        const totp = new OTPAuth.TOTP({
          issuer: "Hire'in Solutions",
          label: user.email,
          algorithm: "SHA1",
          digits: 6,
          period: 30,
          secret: OTPAuth.Secret.fromBase32(user.totpSecret),
        });

        const delta = totp.validate({ token: totpCode, window: 1 });
        if (delta === null) {
          return res.status(401).json({ message: "Invalid verification code" });
        }
      }

      createSession(req, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", async (req, res) => {
    try {
      await destroySession(req);
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      res.json(user);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Register new admin user (Super Admin only)
  app.post("/api/auth/register", requireRole("super_admin"), async (req, res) => {
    try {
      const parsed = registerAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const { email, password, firstName, lastName, role } = parsed.data;

      // Check if email already exists
      const [existing] = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.email, email.toLowerCase()))
        .limit(1);

      if (existing) {
        return res.status(409).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const [newUser] = await db
        .insert(adminUsers)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          role,
          isActive: true,
        })
        .returning({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
        });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Setup initial Super Admin (one-time setup when no users exist)
  app.post("/api/auth/setup", async (req, res) => {
    try {
      // Check if any admin users exist
      const [existingUser] = await db.select().from(adminUsers).limit(1);
      if (existingUser) {
        return res.status(403).json({ message: "Setup already completed. Contact existing admin." });
      }

      const setupSchema = z.object({
        email: z.string().email().refine(
          (email) => email.endsWith("@hire-in.com"),
          "Only @hire-in.com email addresses are allowed"
        ),
        password: z.string().min(8, "Password must be at least 8 characters"),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
      });

      const parsed = setupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const { email, password, firstName, lastName } = parsed.data;
      const hashedPassword = await hashPassword(password);

      const [newUser] = await db
        .insert(adminUsers)
        .values({
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          role: "super_admin",
          isActive: true,
        })
        .returning({
          id: adminUsers.id,
          email: adminUsers.email,
          firstName: adminUsers.firstName,
          lastName: adminUsers.lastName,
          role: adminUsers.role,
        });

      // Auto-login the new super admin
      createSession(req, {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName!,
        lastName: newUser.lastName!,
        role: newUser.role,
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Setup error:", error);
      res.status(500).json({ message: "Setup failed" });
    }
  });

  // Get TOTP status for current user
  app.get("/api/auth/totp/status", requireAuth, async (req, res) => {
    try {
      const [user] = await db
        .select({ totpEnabled: adminUsers.totpEnabled })
        .from(adminUsers)
        .where(eq(adminUsers.id, req.session.userId!))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ totpEnabled: user.totpEnabled });
    } catch (error) {
      console.error("TOTP status error:", error);
      res.status(500).json({ message: "Failed to get TOTP status" });
    }
  });

  // Generate TOTP secret and QR code for setup
  app.post("/api/auth/totp/setup", requireAuth, async (req, res) => {
    try {
      const [user] = await db
        .select({ email: adminUsers.email, totpEnabled: adminUsers.totpEnabled })
        .from(adminUsers)
        .where(eq(adminUsers.id, req.session.userId!))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.totpEnabled) {
        return res.status(400).json({ message: "2FA is already enabled. Disable it first to set up again." });
      }

      const secret = new OTPAuth.Secret({ size: 20 });
      const totp = new OTPAuth.TOTP({
        issuer: "Hire'in Solutions",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
      });

      const otpauthUrl = totp.toString();
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      await db
        .update(adminUsers)
        .set({ totpSecret: secret.base32 })
        .where(eq(adminUsers.id, req.session.userId!));

      res.json({
        secret: secret.base32,
        qrCode: qrCodeDataUrl,
      });
    } catch (error) {
      console.error("TOTP setup error:", error);
      res.status(500).json({ message: "Failed to set up 2FA" });
    }
  });

  // Verify TOTP code and enable 2FA
  app.post("/api/auth/totp/verify", requireAuth, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Verification code is required" });
      }

      const [user] = await db
        .select({ totpSecret: adminUsers.totpSecret, email: adminUsers.email })
        .from(adminUsers)
        .where(eq(adminUsers.id, req.session.userId!))
        .limit(1);

      if (!user || !user.totpSecret) {
        return res.status(400).json({ message: "TOTP not set up. Please start setup first." });
      }

      const totp = new OTPAuth.TOTP({
        issuer: "Hire'in Solutions",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totpSecret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) {
        return res.status(401).json({ message: "Invalid verification code. Please try again." });
      }

      await db
        .update(adminUsers)
        .set({ totpEnabled: true })
        .where(eq(adminUsers.id, req.session.userId!));

      res.json({ message: "2FA enabled successfully" });
    } catch (error) {
      console.error("TOTP verify error:", error);
      res.status(500).json({ message: "Failed to verify code" });
    }
  });

  // Disable TOTP 2FA
  app.post("/api/auth/totp/disable", requireAuth, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== "string") {
        return res.status(400).json({ message: "Verification code is required to disable 2FA" });
      }

      const [user] = await db
        .select({ totpSecret: adminUsers.totpSecret, totpEnabled: adminUsers.totpEnabled, email: adminUsers.email })
        .from(adminUsers)
        .where(eq(adminUsers.id, req.session.userId!))
        .limit(1);

      if (!user || !user.totpEnabled || !user.totpSecret) {
        return res.status(400).json({ message: "2FA is not enabled" });
      }

      const totp = new OTPAuth.TOTP({
        issuer: "Hire'in Solutions",
        label: user.email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(user.totpSecret),
      });

      const delta = totp.validate({ token: code, window: 1 });
      if (delta === null) {
        return res.status(401).json({ message: "Invalid verification code" });
      }

      await db
        .update(adminUsers)
        .set({ totpEnabled: false, totpSecret: null })
        .where(eq(adminUsers.id, req.session.userId!));

      res.json({ message: "2FA disabled successfully" });
    } catch (error) {
      console.error("TOTP disable error:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });
}
