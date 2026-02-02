import { Express } from "express";
import { db } from "./db";
import { adminUsers, loginSchema, registerAdminSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, requireAuth, createSession, destroySession, getCurrentUser, requireRole } from "./auth";
import { z } from "zod";

export function registerAuthRoutes(app: Express) {
  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });
      }

      const { email, password } = parsed.data;

      // Check if email is from hire-in.com domain
      if (!email.endsWith("@hire-in.com")) {
        return res.status(403).json({ message: "Only @hire-in.com email addresses are allowed" });
      }

      // Find user
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

      // Verify password
      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
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
}
