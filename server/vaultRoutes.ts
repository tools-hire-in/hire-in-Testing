import { type Express, type Request, type Response, type NextFunction } from "express";
import { db } from "./db";
import {
  vaults, vaultSecrets, vaultSecretGrants, vaultAuditLogs,
  type Vault, type VaultSecret, type VaultSecretGrant,
} from "../shared/schema";
import { eq, and, isNull, inArray, desc, gte, sql } from "drizzle-orm";
import { encryptVaultField, decryptVaultField } from "./utils/vaultCrypto";
import { logVaultAudit } from "./vaultAudit";
import { requireAuth } from "./auth";
import { vaultRevealLimiter, vaultCopyLimiter } from "./rateLimits";
import { resolveRoles } from "../shared/accessControl";

function requirePermission(featureKey: string, ...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const allowed = resolveRoles(featureKey, Array.from(new Set(["super_admin", ...allowedRoles])));
    if (allowed.includes(req.session.role!)) return next();
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

const ADMIN_ROLES = ["super_admin", "admin"];

function getRetentionMonths(sensitivity: string): number | null {
  switch (sensitivity) {
    case "low": return 3;
    case "medium": return 6;
    case "high": return 12;
    case "critical": return null;
    default: return 6;
  }
}

function requiresReason(sensitivity: string): boolean {
  return true; // All sensitivity levels require a business reason
  void sensitivity;
}

function requiresTotp(sensitivity: string): boolean {
  return ["high", "critical"].includes(sensitivity);
}

async function getGrantsForUser(secretId: string, userId: string, userRole: string): Promise<VaultSecretGrant[]> {
  const now = new Date();
  const rows = await db.select().from(vaultSecretGrants).where(
    and(
      eq(vaultSecretGrants.secretId, secretId),
      isNull(vaultSecretGrants.revokedAt),
      sql`(${vaultSecretGrants.expiresAt} IS NULL OR ${vaultSecretGrants.expiresAt} > ${now})`,
    )
  );
  return rows.filter(g => g.userId === userId || g.roleName === userRole);
}

async function canAccessSecret(userId: string, userRole: string, secretId: string): Promise<{ allowed: boolean; canCopy: boolean; canReveal: boolean }> {
  if (ADMIN_ROLES.includes(userRole)) {
    return { allowed: true, canCopy: true, canReveal: true };
  }
  const grants = await getGrantsForUser(secretId, userId, userRole);
  if (!grants.length) return { allowed: false, canCopy: false, canReveal: false };
  const canCopy = grants.some(g => g.canCopyPassword);
  const canReveal = grants.some(g => g.canRevealPassword);
  return { allowed: true, canCopy, canReveal };
}

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export async function revokeUserVaultGrants(userId: string, actorId: string): Promise<void> {
  try {
    const now = new Date();
    const activeGrants = await db.select().from(vaultSecretGrants).where(
      and(
        eq(vaultSecretGrants.userId, userId),
        isNull(vaultSecretGrants.revokedAt),
      )
    );
    if (!activeGrants.length) return;

    const secretIds = [...new Set(activeGrants.map(g => g.secretId))];

    await db.update(vaultSecretGrants)
      .set({ revokedAt: now, revokedBy: actorId })
      .where(and(eq(vaultSecretGrants.userId, userId), isNull(vaultSecretGrants.revokedAt)));

    if (secretIds.length > 0) {
      await db.update(vaultSecrets)
        .set({ rotationRequired: true })
        .where(inArray(vaultSecrets.id, secretIds));
    }

    for (const grant of activeGrants) {
      await logVaultAudit({
        actorId,
        secretId: grant.secretId,
        action: "exit_revoke",
        meta: { revokedUserId: userId, grantId: grant.id },
      });
    }
  } catch (err) {
    console.error("[VaultRoutes] Failed to revoke vault grants on exit:", err);
  }
}

export function registerVaultRoutes(app: Express): void {
  const authMiddleware = [requireAuth];

  const adminOnly = requirePermission("vault.manage", "super_admin", "admin");

  app.get("/api/vaults", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);

      const allVaults = await db.select().from(vaults).where(isNull(vaults.archivedAt)).orderBy(vaults.name);

      if (isAdmin) {
        return res.json(allVaults);
      }

      const activeGrants = await db.select().from(vaultSecretGrants).where(
        and(
          isNull(vaultSecretGrants.revokedAt),
          sql`(${vaultSecretGrants.expiresAt} IS NULL OR ${vaultSecretGrants.expiresAt} > NOW())`,
        )
      );
      const userGrants = activeGrants.filter(g => g.userId === userId || g.roleName === userRole);

      if (!userGrants.length) {
        return res.json([]);
      }

      const accessibleSecrets = await db.select({ vaultId: vaultSecrets.vaultId })
        .from(vaultSecrets)
        .where(inArray(vaultSecrets.id, userGrants.map(g => g.secretId)));

      const accessibleVaultIds = new Set(accessibleSecrets.map(s => s.vaultId));
      return res.json(allVaults.filter(v => accessibleVaultIds.has(v.id)));
    } catch (err) {
      console.error("[Vault] GET /api/vaults:", err);
      res.status(500).json({ error: "Failed to fetch vaults" });
    }
  });

  app.post("/api/vaults", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { name, description, category } = req.body as { name: string; description?: string; category?: string };
      if (!name?.trim()) return res.status(400).json({ error: "Vault name is required" });
      const [created] = await db.insert(vaults).values({
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        createdBy: req.session.userId!,
      }).returning();
      await logVaultAudit({ actorId: req.session.userId!, vaultId: created.id, action: "create_vault", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      res.json(created);
    } catch (err) {
      console.error("[Vault] POST /api/vaults:", err);
      res.status(500).json({ error: "Failed to create vault" });
    }
  });

  app.patch("/api/vaults/:id", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, category } = req.body as { name?: string; description?: string; category?: string };
      const [updated] = await db.update(vaults)
        .set({ name: name?.trim(), description: description?.trim(), category: category?.trim(), updatedAt: new Date() })
        .where(eq(vaults.id, id))
        .returning();
      if (!updated) return res.status(404).json({ error: "Vault not found" });
      await logVaultAudit({ actorId: req.session.userId!, vaultId: id, action: "edit_vault", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update vault" });
    }
  });

  app.get("/api/vaults/:id/secrets", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId } = req.params;

      const secrets = await db.select().from(vaultSecrets).where(
        and(eq(vaultSecrets.vaultId, vaultId), isNull(vaultSecrets.archivedAt))
      ).orderBy(vaultSecrets.systemName);

      const sanitized = await Promise.all(secrets.map(async (s) => {
        const access = isAdmin ? { allowed: true, canCopy: true, canReveal: true } : await canAccessSecret(userId, userRole, s.id);
        if (!access.allowed) return null;
        return {
          id: s.id, vaultId: s.vaultId, systemName: s.systemName, loginUrl: s.loginUrl,
          sensitivity: s.sensitivity, rotationDueAt: s.rotationDueAt, rotationRequired: s.rotationRequired,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
          canCopy: access.canCopy, canReveal: access.canReveal,
        };
      }));
      res.json(sanitized.filter(Boolean));
    } catch (err) {
      console.error("[Vault] GET /api/vaults/:id/secrets:", err);
      res.status(500).json({ error: "Failed to fetch secrets" });
    }
  });

  app.post("/api/vaults/:id/secrets", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id: vaultId } = req.params;
      const { systemName, loginUrl, username, password, notes, sensitivity, rotationDueAt } = req.body as {
        systemName: string; loginUrl?: string; username?: string; password?: string;
        notes?: string; sensitivity?: string; rotationDueAt?: string;
      };
      if (!systemName?.trim()) return res.status(400).json({ error: "System name is required" });

      const validSensitivities = ["low", "medium", "high", "critical"];
      const sens = validSensitivities.includes(sensitivity ?? "") ? sensitivity! : "medium";

      const [created] = await db.insert(vaultSecrets).values({
        vaultId, systemName: systemName.trim(),
        loginUrl: loginUrl?.trim() || null,
        usernameEnc: username ? encryptVaultField(username) : null,
        passwordEnc: password ? encryptVaultField(password) : null,
        notesEnc: notes ? encryptVaultField(notes) : null,
        sensitivity: sens,
        rotationDueAt: rotationDueAt ? new Date(rotationDueAt) : null,
        createdBy: req.session.userId!,
      }).returning();

      await logVaultAudit({ actorId: req.session.userId!, secretId: created.id, vaultId, action: "create_secret", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      const { usernameEnc: _u, passwordEnc: _p, notesEnc: _n, ...safe } = created;
      res.json(safe);
    } catch (err) {
      console.error("[Vault] POST /api/vaults/:id/secrets:", err);
      res.status(500).json({ error: "Failed to create secret" });
    }
  });

  app.get("/api/secrets/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id } = req.params;

      const [secret] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!secret || secret.archivedAt) return res.status(404).json({ error: "Secret not found" });

      const access = isAdmin ? { allowed: true, canCopy: true, canReveal: true } : await canAccessSecret(userId, userRole, id);
      if (!access.allowed) {
        await logVaultAudit({ actorId: userId, secretId: id, action: "failed_access", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
        return res.status(403).json({ error: "Access denied" });
      }

      const { usernameEnc: _u, passwordEnc: _p, notesEnc: _n, ...safe } = secret;
      res.json({ ...safe, canCopy: access.canCopy, canReveal: access.canReveal });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch secret" });
    }
  });

  app.patch("/api/secrets/:id", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { systemName, loginUrl, username, password, notes, sensitivity, rotationDueAt, rotationRequired } = req.body as {
        systemName?: string; loginUrl?: string; username?: string; password?: string;
        notes?: string; sensitivity?: string; rotationDueAt?: string; rotationRequired?: boolean;
      };

      const [existing] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!existing || existing.archivedAt) return res.status(404).json({ error: "Secret not found" });

      const validSensitivities = ["low", "medium", "high", "critical"];
      const updates: Partial<VaultSecret> = {
        updatedAt: new Date(), updatedBy: req.session.userId!,
        ...(systemName && { systemName: systemName.trim() }),
        ...(loginUrl !== undefined && { loginUrl: loginUrl?.trim() || null }),
        ...(username !== undefined && { usernameEnc: username ? encryptVaultField(username) : null }),
        ...(password !== undefined && { passwordEnc: password ? encryptVaultField(password) : null }),
        ...(notes !== undefined && { notesEnc: notes ? encryptVaultField(notes) : null }),
        ...(sensitivity && validSensitivities.includes(sensitivity) && { sensitivity }),
        ...(rotationDueAt !== undefined && { rotationDueAt: rotationDueAt ? new Date(rotationDueAt) : null }),
        ...(rotationRequired !== undefined && { rotationRequired }),
      };

      const [updated] = await db.update(vaultSecrets).set(updates).where(eq(vaultSecrets.id, id)).returning();
      await logVaultAudit({ actorId: req.session.userId!, secretId: id, vaultId: existing.vaultId, action: "edit_secret", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      const { usernameEnc: _u, passwordEnc: _p, notesEnc: _n, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      console.error("[Vault] PATCH /api/secrets/:id:", err);
      res.status(500).json({ error: "Failed to update secret" });
    }
  });

  app.delete("/api/secrets/:id", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [existing] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!existing) return res.status(404).json({ error: "Secret not found" });
      await db.update(vaultSecrets).set({ archivedAt: new Date() }).where(eq(vaultSecrets.id, id));
      await logVaultAudit({ actorId: req.session.userId!, secretId: id, vaultId: existing.vaultId, action: "archive_secret", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to archive secret" });
    }
  });

  app.get("/api/my-vault-access", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const now = new Date();

      let secretIds: string[] = [];

      if (isAdmin) {
        const allSecrets = await db.select({ id: vaultSecrets.id }).from(vaultSecrets).where(isNull(vaultSecrets.archivedAt));
        secretIds = allSecrets.map(s => s.id);
      } else {
        const grants = await db.select().from(vaultSecretGrants).where(
          and(
            isNull(vaultSecretGrants.revokedAt),
            sql`(${vaultSecretGrants.expiresAt} IS NULL OR ${vaultSecretGrants.expiresAt} > ${now})`,
          )
        );
        const userGrants = grants.filter(g => g.userId === userId || g.roleName === userRole);
        secretIds = [...new Set(userGrants.map(g => g.secretId))];
      }

      if (!secretIds.length) return res.json([]);

      const secrets = await db.select().from(vaultSecrets).where(
        and(inArray(vaultSecrets.id, secretIds), isNull(vaultSecrets.archivedAt))
      ).orderBy(vaultSecrets.systemName);

      const vaultIds = [...new Set(secrets.map(s => s.vaultId))];
      const vaultList = vaultIds.length ? await db.select().from(vaults).where(inArray(vaults.id, vaultIds)) : [];
      const vaultMap = new Map(vaultList.map(v => [v.id, v]));

      const result = await Promise.all(secrets.map(async (s) => {
        const access = isAdmin ? { canCopy: true, canReveal: true } : await (async () => {
          const grants = await getGrantsForUser(s.id, userId, userRole);
          return { canCopy: grants.some(g => g.canCopyPassword), canReveal: grants.some(g => g.canRevealPassword) };
        })();
        return {
          id: s.id, vaultId: s.vaultId, vaultName: vaultMap.get(s.vaultId)?.name ?? "",
          systemName: s.systemName, loginUrl: s.loginUrl, sensitivity: s.sensitivity,
          rotationDueAt: s.rotationDueAt, rotationRequired: s.rotationRequired,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
          canCopy: access.canCopy, canReveal: access.canReveal,
        };
      }));
      res.json(result);
    } catch (err) {
      console.error("[Vault] GET /api/my-vault-access:", err);
      res.status(500).json({ error: "Failed to fetch vault access" });
    }
  });

  app.post("/api/secrets/:id/copy-username", ...authMiddleware, vaultCopyLimiter, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const { id } = req.params;

      const [secret] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!secret || secret.archivedAt) return res.status(404).json({ error: "Secret not found" });

      const access = await canAccessSecret(userId, userRole, id);
      if (!access.allowed) {
        await logVaultAudit({ actorId: userId, secretId: id, action: "failed_access", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
        return res.status(403).json({ error: "Access denied" });
      }

      if (!secret.usernameEnc) return res.status(400).json({ error: "No username stored" });

      const plaintext = decryptVaultField(secret.usernameEnc);

      await logVaultAudit({
        actorId: userId, secretId: id, vaultId: secret.vaultId,
        action: "copy_username", ip: getClientIp(req), userAgent: req.headers["user-agent"],
      });

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.json({ value: plaintext });
    } catch (err) {
      console.error("[Vault] copy-username:", err);
      res.status(500).json({ error: "Failed to copy username" });
    }
  });

  app.post("/api/secrets/:id/copy-password", ...authMiddleware, vaultCopyLimiter, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const { id } = req.params;

      const [secret] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!secret || secret.archivedAt) return res.status(404).json({ error: "Secret not found" });

      const access = await canAccessSecret(userId, userRole, id);
      if (!access.allowed || !access.canCopy) {
        await logVaultAudit({ actorId: userId, secretId: id, action: "failed_access", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
        return res.status(403).json({ error: "Access denied" });
      }

      if (!secret.passwordEnc) return res.status(400).json({ error: "No password stored" });

      const plaintext = decryptVaultField(secret.passwordEnc);

      await logVaultAudit({
        actorId: userId, secretId: id, vaultId: secret.vaultId,
        action: "copy_password", ip: getClientIp(req), userAgent: req.headers["user-agent"],
      });

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.json({ value: plaintext });
    } catch (err) {
      console.error("[Vault] copy-password:", err);
      res.status(500).json({ error: "Failed to copy password" });
    }
  });

  app.post("/api/secrets/:id/reveal", ...authMiddleware, vaultRevealLimiter, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const { id } = req.params;
      const { reason, totpCode } = req.body as { reason?: string; totpCode?: string };

      const [secret] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!secret || secret.archivedAt) return res.status(404).json({ error: "Secret not found" });

      const access = await canAccessSecret(userId, userRole, id);
      if (!access.allowed || !access.canReveal) {
        await logVaultAudit({ actorId: userId, secretId: id, action: "failed_access", ip: getClientIp(req), userAgent: req.headers["user-agent"], reason });
        return res.status(403).json({ error: "Access denied" });
      }

      if (requiresReason(secret.sensitivity) && !reason?.trim()) {
        return res.status(400).json({ error: "A business reason is required to reveal this credential", requiresReason: true });
      }

      if (requiresTotp(secret.sensitivity)) {
        if (!totpCode) {
          return res.status(400).json({ error: "TOTP code is required for this sensitivity level", requiresTotp: true });
        }
        // Fail-closed: any error in this block denies access
        try {
          const user = await db.query.adminUsers?.findFirst({ where: (u, { eq }) => eq(u.id, userId) });
          if (!user || !(user as any).totpSecret) {
            await logVaultAudit({ actorId: userId, secretId: id, action: "totp_failed", ip: getClientIp(req), userAgent: req.headers["user-agent"], reason, meta: "no_totp_configured" });
            return res.status(403).json({ error: "TOTP authentication is required but not configured on your account. Contact an admin." });
          }
          const speakeasy = await import("speakeasy");
          const valid = speakeasy.default.totp.verify({
            secret: (user as any).totpSecret,
            encoding: "base32",
            token: totpCode,
            window: 1,
          });
          if (!valid) {
            await logVaultAudit({ actorId: userId, secretId: id, action: "totp_failed", ip: getClientIp(req), userAgent: req.headers["user-agent"], reason });
            return res.status(401).json({ error: "Invalid TOTP code", totpInvalid: true });
          }
        } catch (totpErr) {
          console.error("[Vault] TOTP verification error:", totpErr);
          await logVaultAudit({ actorId: userId, secretId: id, action: "totp_failed", ip: getClientIp(req), userAgent: req.headers["user-agent"], reason, meta: "totp_error" });
          return res.status(500).json({ error: "TOTP verification failed. Please try again or contact an admin." });
        }
      }

      if (!secret.passwordEnc) return res.status(400).json({ error: "No password stored" });

      const plaintext = decryptVaultField(secret.passwordEnc);

      await logVaultAudit({
        actorId: userId, secretId: id, vaultId: secret.vaultId,
        action: "reveal_password", ip: getClientIp(req), userAgent: req.headers["user-agent"],
        reason: reason?.trim(),
      });

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.json({ value: plaintext, sensitivity: secret.sensitivity });
    } catch (err) {
      console.error("[Vault] reveal:", err);
      res.status(500).json({ error: "Failed to reveal password" });
    }
  });

  app.get("/api/secrets/:id/grants", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const grants = await db.select().from(vaultSecretGrants).where(eq(vaultSecretGrants.secretId, id)).orderBy(desc(vaultSecretGrants.createdAt));
      res.json(grants);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch grants" });
    }
  });

  app.post("/api/secrets/:id/grants", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id: secretId } = req.params;
      const { userId, roleName, canCopyPassword, canRevealPassword, expiresAt } = req.body as {
        userId?: string; roleName?: string; canCopyPassword?: boolean; canRevealPassword?: boolean; expiresAt?: string;
      };

      if (!userId && !roleName) return res.status(400).json({ error: "Either userId or roleName is required" });

      const [grant] = await db.insert(vaultSecretGrants).values({
        secretId, userId: userId || null, roleName: roleName || null,
        canCopyPassword: canCopyPassword !== false,
        canRevealPassword: canRevealPassword !== false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        grantedBy: req.session.userId!,
      }).returning();

      await logVaultAudit({
        actorId: req.session.userId!, secretId, action: "grant_access",
        ip: getClientIp(req), userAgent: req.headers["user-agent"],
        meta: { userId, roleName },
      });
      res.json(grant);
    } catch (err) {
      console.error("[Vault] POST grants:", err);
      res.status(500).json({ error: "Failed to create grant" });
    }
  });

  app.delete("/api/grants/:id", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [grant] = await db.select().from(vaultSecretGrants).where(eq(vaultSecretGrants.id, id));
      if (!grant) return res.status(404).json({ error: "Grant not found" });
      await db.update(vaultSecretGrants).set({ revokedAt: new Date(), revokedBy: req.session.userId! }).where(eq(vaultSecretGrants.id, id));
      await logVaultAudit({
        actorId: req.session.userId!, secretId: grant.secretId, action: "revoke_access",
        ip: getClientIp(req), userAgent: req.headers["user-agent"],
        meta: { grantId: id, userId: grant.userId, roleName: grant.roleName },
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to revoke grant" });
    }
  });

  app.get("/api/vault-audit-logs", ...authMiddleware, requirePermission("vault.audit", "super_admin", "admin"), async (req: Request, res: Response) => {
    try {
      const { secretId, actorId, action, from, to, limit: limitStr, offset: offsetStr } = req.query as Record<string, string>;
      const limit = Math.min(parseInt(limitStr ?? "50"), 200);
      const offset = parseInt(offsetStr ?? "0") || 0;

      const conditions = [];
      if (secretId) conditions.push(eq(vaultAuditLogs.secretId, secretId));
      if (actorId) conditions.push(eq(vaultAuditLogs.actorId, actorId));
      if (action) conditions.push(eq(vaultAuditLogs.action, action));
      if (from) conditions.push(gte(vaultAuditLogs.createdAt, new Date(from)));
      if (to) conditions.push(sql`${vaultAuditLogs.createdAt} <= ${new Date(to).toISOString()}::timestamptz`);

      const rows = await db.select().from(vaultAuditLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(vaultAuditLogs.createdAt))
        .limit(limit).offset(offset);

      res.json(rows);
    } catch (err) {
      console.error("[Vault] GET /api/vault-audit-logs:", err);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/vault-audit-logs/purge-expired", ...authMiddleware, adminOnly, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      let totalDeleted = 0;

      for (const [sens, months] of [["low", 3], ["medium", 6], ["high", 12]] as [string, number][]) {
        const cutoff = new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
        const secretsOfSens = await db.select({ id: vaultSecrets.id }).from(vaultSecrets).where(eq(vaultSecrets.sensitivity, sens));
        const ids = secretsOfSens.map(s => s.id);
        if (!ids.length) continue;
        const result = await db.delete(vaultAuditLogs).where(
          and(
            inArray(vaultAuditLogs.secretId, ids),
            sql`${vaultAuditLogs.createdAt} < ${cutoff}`,
          )
        );
        totalDeleted += (result as any).rowCount ?? 0;
      }

      res.json({ ok: true, totalDeleted });
    } catch (err) {
      console.error("[Vault] purge-expired:", err);
      res.status(500).json({ error: "Failed to purge expired audit logs" });
    }
  });
}
