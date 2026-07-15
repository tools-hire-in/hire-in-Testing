/**
 * Integrations Hub routes — /api/integrations/*
 * Restricted to super_admin, admin, operations.
 *
 * Zoom credential persistence:
 *   Credentials are stored in system_settings under key "zoom_credentials"
 *   (accountId, clientId, clientSecret) so they survive server restarts.
 *   zoomService.loadZoomCredentialsFromDb() is called on startup.
 *
 * Backward compat:
 *   /api/admin/jobs/sync-ceipal  →  still registered in routes.ts; also forwarded here
 *   via registerLegacyCeipalSyncAlias().
 */
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { integrationSettings } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { syncCeipalJobs, getCeipalRecruiterMetrics, getCeipalTokenHealth } from "./ceipalService";
import {
  testZoomConnection,
  isZoomConfigured,
  clearZoomTokenCache,
  setZoomCredentials,
  loadZoomCredentialsFromDb,
} from "./zoomService";
import { encryptVaultField, decryptVaultField } from "./utils/vaultCrypto";

const INTEGRATION_ROLES = ["super_admin", "admin", "operations"];

function requireIntegrationAccess(req: Request, res: Response): boolean {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  if (!INTEGRATION_ROLES.includes(req.session.role ?? "")) {
    res.status(403).json({ error: "Insufficient permissions" });
    return false;
  }
  return true;
}

async function upsertIntegrationStatus(
  key: string,
  status: "connected" | "error" | "unconfigured",
  meta?: Record<string, unknown>,
  lastError?: string
) {
  try {
    await db
      .insert(integrationSettings)
      .values({ key, status, meta: meta ?? null, lastError: lastError ?? null, lastCheckedAt: new Date(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: integrationSettings.key,
        set: {
          status,
          meta: meta ?? null,
          lastError: lastError ?? null,
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("[integrations] upsert failed:", err);
  }
}

/**
 * Encrypt a string using VAULT_ENCRYPTION_KEY if available; otherwise store with a
 * "plain:" prefix so loadZoomCredentialsFromDb can detect unencrypted values and
 * log a warning.  The vault key is set via Replit Secrets.
 */
function tryEncrypt(value: string): string {
  try {
    return encryptVaultField(value);
  } catch {
    console.warn("[integrations] VAULT_ENCRYPTION_KEY not set — storing Zoom credential unencrypted. Set the secret to enable encryption at rest.");
    return `plain:${value}`;
  }
}

function tryDecrypt(stored: string): string {
  if (!stored) return "";
  if (stored.startsWith("plain:")) return stored.slice("plain:".length);
  try {
    return decryptVaultField(stored);
  } catch {
    return stored;
  }
}

/** Persist Zoom credentials (encrypted at rest) to system_settings under zoom_integration. */
async function saveZoomCredentialsToDb(creds: {
  accountId: string;
  clientId: string;
  clientSecret: string;
  configuredBy: number;
}): Promise<void> {
  try {
    const payload = JSON.stringify({
      accountIdEnc: tryEncrypt(creds.accountId),
      clientIdEnc: tryEncrypt(creds.clientId),
      clientSecretEnc: tryEncrypt(creds.clientSecret),
      clientIdHint: creds.clientId.substring(0, 4) + "****",
      configuredAt: new Date().toISOString(),
      configuredBy: creds.configuredBy,
    });
    await db.execute(sql`
      INSERT INTO system_settings (key, value, description, updated_by)
      VALUES (
        'zoom_integration',
        ${payload}::jsonb,
        'Zoom Server-to-Server OAuth credentials (encrypted)',
        ${String(creds.configuredBy)}
      )
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_by = EXCLUDED.updated_by
    `);
  } catch (err) {
    console.error("[integrations] Could not persist Zoom credentials:", err);
    throw err;
  }
}

export async function initIntegrations(): Promise<void> {
  await loadZoomCredentialsFromDb(db);
}

export function registerIntegrationsRoutes(app: Express) {
  // GET /api/integrations/status — returns all integration statuses
  app.get("/api/integrations/status", async (req: Request, res: Response) => {
    if (!requireIntegrationAccess(req, res)) return;
    try {
      const rows = await db.select().from(integrationSettings);
      const ceipalConfigured = !!(
        process.env.CEIPAL_EMAIL &&
        process.env.CEIPAL_PASSWORD &&
        process.env.CEIPAL_API_KEY
      );
      const zoomConfigured = isZoomConfigured();

      const statusMap: Record<string, any> = {};
      for (const row of rows) {
        statusMap[row.key] = row;
      }

      if (!statusMap.ceipal) {
        statusMap.ceipal = { key: "ceipal", status: "unconfigured", meta: null };
      }
      if (!statusMap.zoom) {
        statusMap.zoom = { key: "zoom", status: "unconfigured", meta: null };
      }

      statusMap.ceipal.envConfigured = ceipalConfigured;
      statusMap.zoom.envConfigured = zoomConfigured;

      // Enrich Ceipal status with live token health (last auth time + expiry)
      const tokenHealth = getCeipalTokenHealth();
      statusMap.ceipal.tokenHealth = tokenHealth;
      // Ensure status reflects current token validity
      if (ceipalConfigured && statusMap.ceipal.status === "unconfigured") {
        statusMap.ceipal.status = "connected";
      }

      res.json({ integrations: Object.values(statusMap) });
    } catch (err: any) {
      console.error("[integrations] status error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/integrations/ceipal/test — test Ceipal auth
  app.post("/api/integrations/ceipal/test", async (req: Request, res: Response) => {
    if (!requireIntegrationAccess(req, res)) return;
    const email = process.env.CEIPAL_EMAIL;
    const password = process.env.CEIPAL_PASSWORD;
    const apiKey = process.env.CEIPAL_API_KEY;

    if (!email || !password || !apiKey) {
      await upsertIntegrationStatus("ceipal", "unconfigured", {}, "Ceipal env vars not set");
      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.ceipal.test",
        changes: { result: "unconfigured", reason: "Missing env vars" },
      });
      return res.json({ ok: false, error: "Ceipal credentials not configured. Set CEIPAL_EMAIL, CEIPAL_PASSWORD, and CEIPAL_API_KEY." });
    }

    try {
      const authRes = await fetch("https://api.ceipal.com/v1/createAuthtoken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, api_key: apiKey }),
      });

      if (!authRes.ok) {
        await upsertIntegrationStatus("ceipal", "error", {}, `Auth returned ${authRes.status}`);
        await storage.createAuditLog({
          actorId: req.session!.userId!,
          action: "integrations.ceipal.test",
          changes: { result: "error", status: authRes.status },
        });
        return res.json({ ok: false, error: `Ceipal auth failed with status ${authRes.status}` });
      }

      await upsertIntegrationStatus("ceipal", "connected", { lastTestedAt: new Date().toISOString() });
      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.ceipal.test",
        changes: { result: "connected" },
      });
      res.json({ ok: true, message: "Ceipal connection verified successfully" });
    } catch (err: any) {
      await upsertIntegrationStatus("ceipal", "error", {}, err.message);
      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.ceipal.test",
        changes: { result: "error", error: err.message },
      });
      res.json({ ok: false, error: err.message });
    }
  });

  // Core Ceipal sync handler — shared by new and legacy endpoints
  async function handleCeipalSync(req: Request, res: Response) {
    try {
      const result = await syncCeipalJobs();
      await upsertIntegrationStatus("ceipal", "connected", {
        lastSyncAt: new Date().toISOString(),
        lastSyncCreated: result.created,
        lastSyncUpdated: result.updated,
        lastSyncDeactivated: result.deactivated,
        lastSyncTotal: result.total,
      });
      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.ceipal.sync",
        changes: result,
      });
      res.json({ ok: true, message: `Sync complete: ${result.created} new, ${result.updated} updated, ${result.deactivated} deactivated`, ...result });
    } catch (err: any) {
      await upsertIntegrationStatus("ceipal", "error", {}, err.message);
      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.ceipal.sync",
        changes: { error: err.message },
      });
      res.status(500).json({ error: err.message });
    }
  }

  // POST /api/integrations/ceipal/sync — trigger manual sync
  app.post("/api/integrations/ceipal/sync", async (req: Request, res: Response) => {
    if (!requireIntegrationAccess(req, res)) return;
    return handleCeipalSync(req, res);
  });

  // POST /api/integrations/zoom/connect — save Zoom credentials to DB and test
  app.post("/api/integrations/zoom/connect", async (req: Request, res: Response) => {
    if (!requireIntegrationAccess(req, res)) return;
    const { accountId, clientId, clientSecret } = req.body;
    if (!accountId || !clientId || !clientSecret) {
      return res.status(400).json({ error: "accountId, clientId, and clientSecret are required" });
    }

    try {
      // Persist credentials to DB first so they survive restarts
      await saveZoomCredentialsToDb({
        accountId,
        clientId,
        clientSecret,
        configuredBy: req.session!.userId!,
      });

      // Set in-memory credentials immediately
      setZoomCredentials({ accountId, clientId, clientSecret });
      clearZoomTokenCache();

      const test = await testZoomConnection();
      if (!test.ok) {
        await upsertIntegrationStatus("zoom", "error", {
          clientIdHint: clientId.substring(0, 4) + "****",
        }, test.error);
        await storage.createAuditLog({
          actorId: req.session!.userId!,
          action: "integrations.zoom.connect",
          changes: { result: "error", error: test.error },
        });
        return res.json({ ok: false, error: `Credentials saved but test failed: ${test.error}` });
      }

      await upsertIntegrationStatus("zoom", "connected", {
        lastTestedAt: new Date().toISOString(),
        scopes: test.scopes,
        clientIdHint: clientId.substring(0, 4) + "****",
        grantedScopes: ["phone:read:admin", "phone:read:call_log:admin", "meeting:read:admin"],
      });
      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.zoom.connect",
        changes: { result: "connected", scopes: test.scopes },
      });
      res.json({ ok: true, message: "Zoom connected and verified successfully" });
    } catch (err: any) {
      await upsertIntegrationStatus("zoom", "error", {}, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/integrations/zoom/test — test existing Zoom connection
  app.post("/api/integrations/zoom/test", async (req: Request, res: Response) => {
    if (!requireIntegrationAccess(req, res)) return;
    if (!isZoomConfigured()) {
      return res.json({ ok: false, error: "Zoom credentials not configured" });
    }
    clearZoomTokenCache();
    const test = await testZoomConnection();
    if (test.ok) {
      const existing = await db.select().from(integrationSettings).where(eq(integrationSettings.key, "zoom"));
      const existingMeta = (existing[0]?.meta as Record<string, any>) ?? {};
      await upsertIntegrationStatus("zoom", "connected", {
        ...existingMeta,
        lastTestedAt: new Date().toISOString(),
      });
    } else {
      await upsertIntegrationStatus("zoom", "error", {}, test.error);
    }
    await storage.createAuditLog({
      actorId: req.session!.userId!,
      action: "integrations.zoom.test",
      changes: { result: test.ok ? "connected" : "error", error: test.error },
    });
    res.json(test);
  });

  // GET /api/integrations/recruiter-metrics — aggregated Ceipal recruiter data
  // period: "week" | "month" | "custom"
  // For custom: pass from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get("/api/integrations/recruiter-metrics", async (req: Request, res: Response) => {
    if (!requireIntegrationAccess(req, res)) return;
    try {
      const period = (req.query.period as string) || "week";
      const recruiterId = req.query.recruiterId as string | undefined;
      const customFrom = req.query.from as string | undefined;
      const customTo = req.query.to as string | undefined;

      const effectivePeriod = period === "custom" && customFrom && customTo ? "custom" : period;
      const metrics = await getCeipalRecruiterMetrics(effectivePeriod, recruiterId, customFrom, customTo);

      await storage.createAuditLog({
        actorId: req.session!.userId!,
        action: "integrations.recruiter_metrics.view",
        changes: { period: effectivePeriod, recruiterId, customFrom, customTo },
      });
      res.json(metrics);
    } catch (err: any) {
      console.error("[integrations] recruiter metrics error:", err);
      res.status(500).json({ error: err.message });
    }
  });
}

/**
 * Register a backward-compatible alias for the legacy Ceipal sync endpoint.
 * The old route /api/admin/jobs/sync-ceipal already exists in routes.ts and is
 * kept intact there; this just provides an additional path for the integrations hub.
 */
export function registerLegacyCeipalSyncAlias(app: Express) {
  app.post("/api/integrations/ceipal/sync-legacy-alias", async (req: Request, res: Response) => {
    res.redirect(307, "/api/integrations/ceipal/sync");
  });
}
