import { type Express, type Request, type Response, type NextFunction } from "express";
import { db } from "./db";
import {
  vaults, vaultSecrets, vaultSecretGrants, vaultAuditLogs, vaultShares, adminUsers,
  type Vault, type VaultSecret, type VaultSecretGrant,
} from "../shared/schema";
import { eq, and, isNull, inArray, desc, gte, sql, or } from "drizzle-orm";
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
  return true;
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

async function getVaultShare(vaultId: string, userId: string) {
  const [share] = await db.select().from(vaultShares).where(
    and(eq(vaultShares.vaultId, vaultId), eq(vaultShares.userId, userId), isNull(vaultShares.revokedAt))
  );
  return share ?? null;
}

async function canAccessSecret(
  userId: string, userRole: string, secretId: string,
  vaultHint?: { vaultId: string; isPersonal?: boolean | null; ownerId?: string | null; scope?: string | null }
): Promise<{ allowed: boolean; canCopy: boolean; canReveal: boolean }> {
  let vaultId = vaultHint?.vaultId;
  let isPersonal = vaultHint?.isPersonal;
  let ownerId = vaultHint?.ownerId;
  let scope = vaultHint?.scope;

  if (!vaultId) {
    const [row] = await db.select({ vaultId: vaultSecrets.vaultId }).from(vaultSecrets).where(eq(vaultSecrets.id, secretId));
    if (!row) return { allowed: false, canCopy: false, canReveal: false };
    vaultId = row.vaultId;
  }
  if (isPersonal === undefined || ownerId === undefined || scope === undefined) {
    const [vault] = await db.select({ isPersonal: vaults.isPersonal, ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
    isPersonal = vault?.isPersonal;
    ownerId = vault?.ownerId ?? null;
    scope = vault?.scope ?? "admin";
  }

  // Personal vault: ONLY the owner can access — admins are intentionally blocked
  if (isPersonal) {
    const isOwner = ownerId === userId;
    return { allowed: isOwner, canCopy: isOwner, canReveal: isOwner };
  }

  // Admins bypass membership checks for all non-personal vaults (admin + team)
  if (ADMIN_ROLES.includes(userRole)) {
    return { allowed: true, canCopy: true, canReveal: true };
  }

  // Team vault: owner gets full access
  if (scope === "team" && ownerId === userId) {
    return { allowed: true, canCopy: true, canReveal: true };
  }

  // Vault-level share: handles both admin and team vault member access
  const vaultShare = await getVaultShare(vaultId, userId);
  if (vaultShare) {
    if (scope === "team") {
      // Team vaults: all members (viewer + editor) can reveal and copy credentials;
      // write access is gated separately via canWriteVaultSecret / canEdit response field
      return { allowed: true, canCopy: true, canReveal: true };
    } else {
      // Admin vaults (legacy behavior): manager can reveal/copy; viewer can browse entry list only
      const isManager = vaultShare.canEdit || vaultShare.role === "manager";
      return { allowed: true, canCopy: isManager, canReveal: isManager };
    }
  }

  // Secret-level grants (existing mechanism for admin-scoped vaults)
  const grants = await getGrantsForUser(secretId, userId, userRole);
  if (!grants.length) return { allowed: false, canCopy: false, canReveal: false };
  return { allowed: true, canCopy: grants.some(g => g.canCopyPassword), canReveal: grants.some(g => g.canRevealPassword) };
}

/** Returns whether a user may create/edit/delete secrets in the given vault. */
async function canWriteVaultSecret(userId: string, userRole: string, vaultId: string): Promise<boolean> {
  const [vault] = await db.select({ isPersonal: vaults.isPersonal, ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
  if (!vault) return false;
  if (vault.isPersonal) return vault.ownerId === userId;
  if (ADMIN_ROLES.includes(userRole)) return true;
  // Team vault: owner or editor can write
  if (vault.scope === "team") {
    if (vault.ownerId === userId) return true;
    const share = await getVaultShare(vaultId, userId);
    return share?.canEdit === true;
  }
  return false;
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

  // ── System vaults list (admin-managed) ─────────────────────────────────────
  app.get("/api/vaults", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);

      // Personal vaults are never shown in the system vault list
      // For admins: show all non-personal vaults (admin + team)
      // For non-admins: only admin-scoped vaults they have grant access to
      const allVaults = await db.select().from(vaults).where(
        and(isNull(vaults.archivedAt), sql`(${vaults.isPersonal} IS NOT TRUE)`)
      ).orderBy(vaults.name);

      if (isAdmin) {
        // Admins see all vaults. Enrich team vaults with owner name.
        const ownerIds = [...new Set(allVaults.filter(v => v.ownerId && v.scope === "team").map(v => v.ownerId!))];
        const owners = ownerIds.length
          ? await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName }).from(adminUsers).where(inArray(adminUsers.id, ownerIds))
          : [];
        const ownerMap = new Map(owners.map(o => [o.id, `${o.firstName} ${o.lastName}`]));
        return res.json(allVaults.map(v => ({
          ...v,
          ownerName: v.ownerId ? ownerMap.get(v.ownerId) ?? null : null,
        })));
      }

      // Non-admin: only admin-scoped vaults accessible via grants/shares
      const adminVaults = allVaults.filter(v => v.scope === "admin");

      const activeGrants = await db.select().from(vaultSecretGrants).where(
        and(
          isNull(vaultSecretGrants.revokedAt),
          sql`(${vaultSecretGrants.expiresAt} IS NULL OR ${vaultSecretGrants.expiresAt} > NOW())`,
        )
      );
      const userGrants = activeGrants.filter(g => g.userId === userId || g.roleName === userRole);

      const myVaultShares = await db.select({ vaultId: vaultShares.vaultId }).from(vaultShares).where(
        and(eq(vaultShares.userId, userId), isNull(vaultShares.revokedAt))
      );
      const directSharedVaultIds = new Set(myVaultShares.map(s => s.vaultId));

      if (!userGrants.length && !directSharedVaultIds.size) {
        return res.json([]);
      }

      const accessibleVaultIds = new Set(directSharedVaultIds);
      if (userGrants.length) {
        const accessibleSecrets = await db.select({ vaultId: vaultSecrets.vaultId })
          .from(vaultSecrets)
          .where(inArray(vaultSecrets.id, userGrants.map(g => g.secretId)));
        for (const s of accessibleSecrets) accessibleVaultIds.add(s.vaultId);
      }
      return res.json(adminVaults.filter(v => accessibleVaultIds.has(v.id)));
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
        scope: "admin",
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

      const [vault] = await db.select({ isPersonal: vaults.isPersonal, ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
      const vaultHint = vault ? { vaultId, isPersonal: vault.isPersonal, ownerId: vault.ownerId, scope: vault.scope } : undefined;

      // For team vaults: non-owner, non-admin, non-member → 403
      if (vault?.scope === "team" && !isAdmin && vault.ownerId !== userId) {
        const share = await getVaultShare(vaultId, userId);
        if (!share) return res.status(403).json({ error: "Access denied" });
      }

      const secrets = await db.select().from(vaultSecrets).where(
        and(eq(vaultSecrets.vaultId, vaultId), isNull(vaultSecrets.archivedAt))
      ).orderBy(vaultSecrets.systemName);

      // Determine write capability for team vaults (owner + editors only; viewers are read-only)
      const isTeamOwner = vault?.scope === "team" && vault.ownerId === userId;
      const teamShare = (vault?.scope === "team" && !isAdmin && !isTeamOwner)
        ? await getVaultShare(vaultId, userId)
        : null;
      // canEditVault: controls write/delete buttons in UI (owner + editors for team; admin bypass)
      const canEditVault = isAdmin || (vault?.isPersonal && vault?.ownerId === userId) || isTeamOwner || (vault?.scope === "team" && teamShare?.canEdit === true);

      const sanitized = await Promise.all(secrets.map(async (s) => {
        const access = await canAccessSecret(userId, userRole, s.id, vaultHint);
        if (!access.allowed) return null;
        // canSeeDetails: whether to include decrypted username/notes in list response.
        // Viewers use the explicit reveal endpoint (audited); this gate keeps list data minimal.
        const canSeeDetails = isAdmin || (vault?.isPersonal && vault?.ownerId === userId) || isTeamOwner || (teamShare?.canEdit === true);
        return {
          id: s.id, vaultId: s.vaultId, systemName: s.systemName, loginUrl: s.loginUrl,
          sensitivity: s.sensitivity, rotationDueAt: s.rotationDueAt, rotationRequired: s.rotationRequired,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
          canCopy: access.canCopy, canReveal: access.canReveal,
          canEdit: vault?.scope === "team" ? canEditVault : access.canCopy,
          ...(canSeeDetails && s.usernameEnc ? { username: decryptVaultField(s.usernameEnc) } : {}),
          ...(canSeeDetails && s.notesEnc ? { notes: decryptVaultField(s.notesEnc) } : {}),
        };
      }));
      res.json(sanitized.filter(Boolean));
    } catch (err) {
      console.error("[Vault] GET /api/vaults/:id/secrets:", err);
      res.status(500).json({ error: "Failed to fetch secrets" });
    }
  });

  app.post("/api/vaults/:id/secrets", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const { id: vaultId } = req.params;

      if (!(await canWriteVaultSecret(userId, userRole, vaultId))) {
        return res.status(403).json({ error: "Access denied" });
      }
      // Sensitivity cap: personal vault owners are restricted to low/medium
      if (!ADMIN_ROLES.includes(userRole)) {
        const [vault] = await db.select({ isPersonal: vaults.isPersonal, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
        if (vault?.isPersonal) {
          const allowedSens = ["low", "medium"];
          if (req.body.sensitivity && !allowedSens.includes(req.body.sensitivity)) {
            return res.status(403).json({ error: "Personal vault secrets may only use low or medium sensitivity" });
          }
        }
      }

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
        createdBy: userId,
      }).returning();

      await logVaultAudit({ actorId: userId, secretId: created.id, vaultId, action: "create_secret", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
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

      const access = await canAccessSecret(userId, userRole, id);
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

  app.patch("/api/secrets/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const { id } = req.params;
      const { systemName, loginUrl, username, password, notes, sensitivity, rotationDueAt, rotationRequired } = req.body as {
        systemName?: string; loginUrl?: string; username?: string; password?: string;
        notes?: string; sensitivity?: string; rotationDueAt?: string; rotationRequired?: boolean;
      };

      const [existing] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!existing || existing.archivedAt) return res.status(404).json({ error: "Secret not found" });

      if (!(await canWriteVaultSecret(userId, userRole, existing.vaultId))) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!ADMIN_ROLES.includes(userRole) && sensitivity && !["low", "medium"].includes(sensitivity)) {
        const [vault] = await db.select({ isPersonal: vaults.isPersonal }).from(vaults).where(eq(vaults.id, existing.vaultId));
        if (vault?.isPersonal) {
          return res.status(403).json({ error: "Personal vault secrets may only use low or medium sensitivity" });
        }
      }

      const validSensitivities = ["low", "medium", "high", "critical"];
      const updates: Partial<VaultSecret> = {
        updatedAt: new Date(), updatedBy: userId,
        ...(systemName && { systemName: systemName.trim() }),
        ...(loginUrl !== undefined && { loginUrl: loginUrl?.trim() || null }),
        ...(!!username && { usernameEnc: encryptVaultField(username) }),
        ...(!!password && { passwordEnc: encryptVaultField(password) }),
        ...(!!notes && { notesEnc: encryptVaultField(notes) }),
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

  app.delete("/api/secrets/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const { id } = req.params;
      const [existing] = await db.select().from(vaultSecrets).where(eq(vaultSecrets.id, id));
      if (!existing) return res.status(404).json({ error: "Secret not found" });

      if (!(await canWriteVaultSecret(userId, userRole, existing.vaultId))) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.update(vaultSecrets).set({ archivedAt: new Date() }).where(eq(vaultSecrets.id, id));
      await logVaultAudit({ actorId: userId, secretId: id, vaultId: existing.vaultId, action: "archive_secret", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
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
        const grantSecretIds = userGrants.map(g => g.secretId);

        const myVaultShares = await db.select().from(vaultShares).where(
          and(eq(vaultShares.userId, userId), isNull(vaultShares.revokedAt))
        );
        const sharedVaultIds = myVaultShares.map(s => s.vaultId);
        let sharedVaultSecretIds: string[] = [];
        if (sharedVaultIds.length > 0) {
          const sharedSecrets = await db.select({ id: vaultSecrets.id }).from(vaultSecrets).where(
            and(inArray(vaultSecrets.vaultId, sharedVaultIds), isNull(vaultSecrets.archivedAt))
          );
          sharedVaultSecretIds = sharedSecrets.map(s => s.id);
        }

        secretIds = [...new Set([...grantSecretIds, ...sharedVaultSecretIds])];
      }

      if (!secretIds.length) return res.json([]);

      const secrets = await db.select().from(vaultSecrets).where(
        and(inArray(vaultSecrets.id, secretIds), isNull(vaultSecrets.archivedAt))
      ).orderBy(vaultSecrets.systemName);

      const vaultIds = [...new Set(secrets.map(s => s.vaultId))];
      const vaultList = vaultIds.length ? await db.select().from(vaults).where(inArray(vaults.id, vaultIds)) : [];
      const vaultMap = new Map(vaultList.map(v => [v.id, v]));

      const result = await Promise.all(secrets.map(async (s) => {
        const vault = vaultMap.get(s.vaultId);
        if (vault?.scope === "team") return null; // team vault secrets shown in team vaults section
        const vaultHint = vault ? { vaultId: s.vaultId, isPersonal: vault.isPersonal, ownerId: vault.ownerId, scope: vault.scope } : undefined;
        const access = await canAccessSecret(userId, userRole, s.id, vaultHint);
        if (!access.allowed) return null;
        return {
          id: s.id, vaultId: s.vaultId, vaultName: vault?.name ?? "",
          systemName: s.systemName, loginUrl: s.loginUrl, sensitivity: s.sensitivity,
          rotationDueAt: s.rotationDueAt, rotationRequired: s.rotationRequired,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
          canCopy: access.canCopy, canReveal: access.canReveal,
        };
      }));
      res.json(result.filter(Boolean));
    } catch (err) {
      console.error("[Vault] GET /api/my-vault-access:", err);
      res.status(500).json({ error: "Failed to fetch vault access" });
    }
  });

  // ── Vault-level sharing (admin can share entire vault with a user) ──────────
  app.get("/api/vaults/:id/shares", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId } = req.params;

      // Allow vault owner (team vault) or admin to see shares
      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
      if (!vault) return res.status(404).json({ error: "Vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Access denied" });

      const shares = await db.select().from(vaultShares)
        .where(eq(vaultShares.vaultId, vaultId))
        .orderBy(desc(vaultShares.grantedAt));
      res.json(shares);
    } catch (err) {
      console.error("[Vault] GET /api/vaults/:id/shares:", err);
      res.status(500).json({ error: "Failed to fetch vault shares" });
    }
  });

  app.post("/api/vaults/:id/shares", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId } = req.params;
      const { userId: targetUserId, role, canEdit } = req.body as { userId: string; role?: string; canEdit?: boolean };
      if (!targetUserId) return res.status(400).json({ error: "userId is required" });

      // Allow vault owner or admin
      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
      if (!vault) return res.status(404).json({ error: "Vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Access denied" });

      const existing = await db.select().from(vaultShares).where(
        and(eq(vaultShares.vaultId, vaultId), eq(vaultShares.userId, targetUserId), isNull(vaultShares.revokedAt))
      );
      if (existing.length > 0) return res.status(409).json({ error: "Vault already shared with this user" });

      // For team vaults: canEdit controls editor/viewer distinction
      // For admin vaults: use role (viewer/manager) for backward compat
      const isEditor = vault.scope === "team" ? (canEdit === true) : (role === "manager");

      const [share] = await db.insert(vaultShares).values({
        vaultId,
        userId: targetUserId,
        role: vault.scope === "team" ? (isEditor ? "editor" : "viewer") : (role ?? "viewer"),
        canEdit: isEditor,
        grantedBy: userId,
      }).returning();

      await logVaultAudit({
        actorId: userId, vaultId, action: "share_vault",
        ip: getClientIp(req), userAgent: req.headers["user-agent"],
        meta: { userId: targetUserId, role: share.role, canEdit: isEditor },
      });
      res.json(share);
    } catch (err) {
      console.error("[Vault] POST /api/vaults/:id/shares:", err);
      res.status(500).json({ error: "Failed to share vault" });
    }
  });

  app.patch("/api/vaults/:id/shares/:shareId", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId, shareId } = req.params;
      const { canEdit, role } = req.body as { canEdit?: boolean; role?: string };

      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
      if (!vault) return res.status(404).json({ error: "Vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Access denied" });

      const isEditor = vault.scope === "team" ? (canEdit === true) : (role === "manager");
      const [updated] = await db.update(vaultShares)
        .set({
          canEdit: isEditor,
          role: vault.scope === "team" ? (isEditor ? "editor" : "viewer") : (role ?? "viewer"),
        })
        .where(and(eq(vaultShares.id, shareId), eq(vaultShares.vaultId, vaultId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "Share not found" });

      await logVaultAudit({
        actorId: userId, vaultId, action: "team_vault_member_update",
        meta: { shareId, canEdit: isEditor },
      });
      res.json(updated);
    } catch (err) {
      console.error("[Vault] PATCH /api/vaults/:id/shares/:shareId:", err);
      res.status(500).json({ error: "Failed to update share" });
    }
  });

  app.delete("/api/vaults/:id/shares/:shareId", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId, shareId } = req.params;

      const [vault] = await db.select({ ownerId: vaults.ownerId }).from(vaults).where(eq(vaults.id, vaultId));
      if (!vault) return res.status(404).json({ error: "Vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Access denied" });

      const [share] = await db.select().from(vaultShares).where(
        and(eq(vaultShares.id, shareId), eq(vaultShares.vaultId, vaultId))
      );
      if (!share) return res.status(404).json({ error: "Share not found" });

      await db.update(vaultShares)
        .set({ revokedAt: new Date(), revokedBy: userId })
        .where(eq(vaultShares.id, shareId));

      await logVaultAudit({
        actorId: userId, vaultId, action: "revoke_vault_share",
        ip: getClientIp(req), userAgent: req.headers["user-agent"],
        meta: { shareId, userId: share.userId },
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("[Vault] DELETE /api/vaults/:id/shares/:shareId:", err);
      res.status(500).json({ error: "Failed to revoke vault share" });
    }
  });

  // ── Personal vault (employee-owned, auto-created) ──────────────────────────
  app.get("/api/my-personal-vault", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const existing = await db.select().from(vaults).where(
        and(eq(vaults.isPersonal, true), eq(vaults.ownerId, userId), isNull(vaults.archivedAt))
      );
      if (existing.length > 0) return res.json(existing[0]);

      const [created] = await db.insert(vaults).values({
        name: "My Personal Vault",
        description: "Your private credential storage",
        isPersonal: true,
        ownerId: userId,
        createdBy: userId,
        scope: "personal",
      }).returning();
      res.json(created);
    } catch (err) {
      console.error("[Vault] GET /api/my-personal-vault:", err);
      res.status(500).json({ error: "Failed to get personal vault" });
    }
  });

  // ── Team Vaults — any employee can create and manage ───────────────────────
  app.get("/api/team-vaults", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);

      let teamVaultsList: typeof vaults.$inferSelect[] = [];

      if (isAdmin) {
        // Admins see ALL team vaults
        teamVaultsList = await db.select().from(vaults).where(
          and(eq(vaults.scope, "team"), isNull(vaults.archivedAt))
        ).orderBy(vaults.name);
      } else {
        // Non-admins: vaults they own or are shared into
        const ownedVaults = await db.select().from(vaults).where(
          and(eq(vaults.scope, "team"), eq(vaults.ownerId, userId), isNull(vaults.archivedAt))
        );

        const myShares = await db.select({ vaultId: vaultShares.vaultId }).from(vaultShares).where(
          and(eq(vaultShares.userId, userId), isNull(vaultShares.revokedAt))
        );
        const sharedIds = myShares.map(s => s.vaultId);

        const sharedVaults = sharedIds.length
          ? await db.select().from(vaults).where(
              and(eq(vaults.scope, "team"), inArray(vaults.id, sharedIds), isNull(vaults.archivedAt))
            )
          : [];

        const seen = new Set<string>();
        teamVaultsList = [...ownedVaults, ...sharedVaults].filter(v => {
          if (seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        });
        teamVaultsList.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Enrich with owner names and member counts
      const ownerIds = [...new Set(teamVaultsList.filter(v => v.ownerId).map(v => v.ownerId!))];
      const owners = ownerIds.length
        ? await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName }).from(adminUsers).where(inArray(adminUsers.id, ownerIds))
        : [];
      const ownerMap = new Map(owners.map(o => [o.id, `${o.firstName} ${o.lastName}`]));

      const enriched = await Promise.all(teamVaultsList.map(async (v) => {
        const members = await db.select().from(vaultShares).where(
          and(eq(vaultShares.vaultId, v.id), isNull(vaultShares.revokedAt))
        );
        return {
          ...v,
          ownerName: v.ownerId ? ownerMap.get(v.ownerId) ?? null : null,
          isOwner: v.ownerId === userId,
          memberCount: members.length,
        };
      }));

      res.json(enriched);
    } catch (err) {
      console.error("[Vault] GET /api/team-vaults:", err);
      res.status(500).json({ error: "Failed to fetch team vaults" });
    }
  });

  app.post("/api/team-vaults", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { name, description } = req.body as { name: string; description?: string };
      if (!name?.trim()) return res.status(400).json({ error: "Vault name is required" });

      const [created] = await db.insert(vaults).values({
        name: name.trim(),
        description: description?.trim() || null,
        scope: "team",
        ownerId: userId,
        createdBy: userId,
      }).returning();

      await logVaultAudit({
        actorId: userId, vaultId: created.id, action: "team_vault_create",
        ip: getClientIp(req), userAgent: req.headers["user-agent"],
      });
      res.json({ ...created, isOwner: true, memberCount: 0, ownerName: null });
    } catch (err) {
      console.error("[Vault] POST /api/team-vaults:", err);
      res.status(500).json({ error: "Failed to create team vault" });
    }
  });

  app.patch("/api/team-vaults/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id } = req.params;
      const { name, description } = req.body as { name?: string; description?: string };

      const [vault] = await db.select().from(vaults).where(and(eq(vaults.id, id), eq(vaults.scope, "team")));
      if (!vault) return res.status(404).json({ error: "Team vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Only the vault owner can edit it" });

      const [updated] = await db.update(vaults)
        .set({ name: name?.trim() ?? vault.name, description: description?.trim() ?? vault.description, updatedAt: new Date() })
        .where(eq(vaults.id, id))
        .returning();

      await logVaultAudit({ actorId: userId, vaultId: id, action: "edit_vault", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to update team vault" });
    }
  });

  app.delete("/api/team-vaults/:id", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id } = req.params;

      const [vault] = await db.select().from(vaults).where(and(eq(vaults.id, id), eq(vaults.scope, "team")));
      if (!vault) return res.status(404).json({ error: "Team vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Only the vault owner can delete it" });

      await db.update(vaults).set({ archivedAt: new Date() }).where(eq(vaults.id, id));
      await logVaultAudit({ actorId: userId, vaultId: id, action: "archive_vault", ip: getClientIp(req), userAgent: req.headers["user-agent"] });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete team vault" });
    }
  });

  app.post("/api/team-vaults/:id/transfer", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id } = req.params;
      const { newOwnerId } = req.body as { newOwnerId: string };
      if (!newOwnerId) return res.status(400).json({ error: "newOwnerId is required" });

      const [vault] = await db.select().from(vaults).where(and(eq(vaults.id, id), eq(vaults.scope, "team")));
      if (!vault) return res.status(404).json({ error: "Team vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Only the vault owner can transfer ownership" });

      const [updated] = await db.update(vaults)
        .set({ ownerId: newOwnerId, updatedAt: new Date() })
        .where(eq(vaults.id, id))
        .returning();

      await logVaultAudit({
        actorId: userId, vaultId: id, action: "transfer_vault_ownership",
        meta: { fromUserId: userId, toUserId: newOwnerId },
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: "Failed to transfer vault ownership" });
    }
  });

  // Team vault members (uses vault_shares but with owner/admin gating)
  app.get("/api/team-vaults/:id/members", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId } = req.params;

      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(eq(vaults.id, vaultId));
      if (!vault || vault.scope !== "team") return res.status(404).json({ error: "Team vault not found" });

      // Members can see the member list (to know who else is in the vault)
      const share = await getVaultShare(vaultId, userId);
      if (!isAdmin && vault.ownerId !== userId && !share) return res.status(403).json({ error: "Access denied" });

      const shares = await db.select().from(vaultShares)
        .where(and(eq(vaultShares.vaultId, vaultId), isNull(vaultShares.revokedAt)))
        .orderBy(vaultShares.grantedAt);

      // Enrich with user details
      const userIds = shares.map(s => s.userId);
      const users = userIds.length
        ? await db.select({ id: adminUsers.id, firstName: adminUsers.firstName, lastName: adminUsers.lastName, role: adminUsers.role }).from(adminUsers).where(inArray(adminUsers.id, userIds))
        : [];
      const userMap = new Map(users.map(u => [u.id, u]));

      res.json(shares.map(s => ({
        ...s,
        user: userMap.get(s.userId) ?? null,
      })));
    } catch (err) {
      console.error("[Vault] GET /api/team-vaults/:id/members:", err);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // POST /api/team-vaults/:id/members — add a member (viewer or editor)
  app.post("/api/team-vaults/:id/members", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId } = req.params;
      const { userId: targetUserId, canEdit } = req.body as { userId: string; canEdit?: boolean };
      if (!targetUserId) return res.status(400).json({ error: "userId is required" });

      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(and(eq(vaults.id, vaultId), eq(vaults.scope, "team")));
      if (!vault) return res.status(404).json({ error: "Team vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Only the vault owner can add members" });

      const existing = await db.select().from(vaultShares).where(
        and(eq(vaultShares.vaultId, vaultId), eq(vaultShares.userId, targetUserId), isNull(vaultShares.revokedAt))
      );
      if (existing.length > 0) return res.status(409).json({ error: "User is already a member of this vault" });

      const isEditor = canEdit === true;
      const [share] = await db.insert(vaultShares).values({
        vaultId, userId: targetUserId,
        role: isEditor ? "editor" : "viewer",
        canEdit: isEditor, grantedBy: userId,
      }).returning();

      await logVaultAudit({ actorId: userId, vaultId, action: "share_vault", ip: getClientIp(req), userAgent: req.headers["user-agent"], meta: { userId: targetUserId, role: share.role, canEdit: isEditor } });
      res.json(share);
    } catch (err) {
      console.error("[Vault] POST /api/team-vaults/:id/members:", err);
      res.status(500).json({ error: "Failed to add member" });
    }
  });

  // PATCH /api/team-vaults/:id/members/:shareId — update member role
  app.patch("/api/team-vaults/:id/members/:shareId", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId, shareId } = req.params;
      const { canEdit } = req.body as { canEdit: boolean };

      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(and(eq(vaults.id, vaultId), eq(vaults.scope, "team")));
      if (!vault) return res.status(404).json({ error: "Team vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Only the vault owner can update members" });

      const isEditor = canEdit === true;
      const [updated] = await db.update(vaultShares)
        .set({ canEdit: isEditor, role: isEditor ? "editor" : "viewer" })
        .where(and(eq(vaultShares.id, shareId), eq(vaultShares.vaultId, vaultId)))
        .returning();
      if (!updated) return res.status(404).json({ error: "Member not found" });

      await logVaultAudit({ actorId: userId, vaultId, action: "team_vault_member_update", meta: { shareId, canEdit: isEditor } });
      res.json(updated);
    } catch (err) {
      console.error("[Vault] PATCH /api/team-vaults/:id/members/:shareId:", err);
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  // DELETE /api/team-vaults/:id/members/:shareId — remove a member
  app.delete("/api/team-vaults/:id/members/:shareId", ...authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userRole = req.session.role ?? "";
      const isAdmin = ADMIN_ROLES.includes(userRole);
      const { id: vaultId, shareId } = req.params;

      const [vault] = await db.select({ ownerId: vaults.ownerId, scope: vaults.scope }).from(vaults).where(and(eq(vaults.id, vaultId), eq(vaults.scope, "team")));
      if (!vault) return res.status(404).json({ error: "Team vault not found" });
      if (!isAdmin && vault.ownerId !== userId) return res.status(403).json({ error: "Only the vault owner can remove members" });

      await db.update(vaultShares).set({ revokedAt: new Date() }).where(and(eq(vaultShares.id, shareId), eq(vaultShares.vaultId, vaultId)));
      await logVaultAudit({ actorId: userId, vaultId, action: "revoke_vault_share", ip: getClientIp(req), userAgent: req.headers["user-agent"], meta: { shareId } });
      res.json({ ok: true });
    } catch (err) {
      console.error("[Vault] DELETE /api/team-vaults/:id/members/:shareId:", err);
      res.status(500).json({ error: "Failed to remove member" });
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
      const usernameValue = secret.usernameEnc ? decryptVaultField(secret.usernameEnc) : undefined;

      await logVaultAudit({
        actorId: userId, secretId: id, vaultId: secret.vaultId,
        action: "reveal_password", ip: getClientIp(req), userAgent: req.headers["user-agent"],
        reason: reason?.trim(),
      });

      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.json({ value: plaintext, sensitivity: secret.sensitivity, username: usernameValue });
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
