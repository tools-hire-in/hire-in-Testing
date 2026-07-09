/**
 * Salary Structure Templates & India Statutory API
 *
 * Routes:
 *   GET    /api/hr/salary-structures              — list all (with rules embedded)
 *   POST   /api/hr/salary-structures              — create structure + rules
 *   PUT    /api/hr/salary-structures/:id          — update structure
 *   DELETE /api/hr/salary-structures/:id          — soft-deactivate
 *   GET    /api/hr/salary-structures/:id/rules    — get rules for one structure
 *   PUT    /api/hr/salary-structures/:id/rules    — replace rules for structure
 *   POST   /api/hr/salary-structures/preview      — compute component preview
 *   GET    /api/hr/employees/:userId/payroll-profile — get PF/ESI/structure flags
 *   PUT    /api/hr/employees/:userId/payroll-profile — update flags
 *   GET    /api/hr/payroll/pt-slabs               — get PT slabs (default + custom)
 *   PUT    /api/hr/payroll/pt-slabs               — save custom PT slabs
 *
 * Seed:  seedDefaultSalaryStructure()  — creates "Standard" structure + rules idempotently
 */

import { Request, Response, Express, RequestHandler } from "express";
import { db } from "./db";
import { eq, and, asc, inArray } from "drizzle-orm";
import {
  salaryStructures,
  salaryStructureRules,
  adminUsers,
  systemSettings,
} from "@shared/schema";
import { requireAuth } from "./auth";
import {
  computeComponentsFromGross,
  computeIndiaStatutory,
  DEFAULT_PT_SLABS,
  type StructureRule,
} from "./salaryEngine";

// ── Permission guard type ─────────────────────────────────────────────────────
// Passed in from routes.ts so these routes use the same registry-based
// requirePermission factory as every other route in the system.
type PermissionFactory = (featureKey: string, ...allowedRoles: string[]) => RequestHandler;

// ── Seed helper ───────────────────────────────────────────────────────────────

/**
 * Seeds the "Standard" salary structure if none exists.
 * Safe to call repeatedly (idempotent by name check).
 */
export async function seedDefaultSalaryStructure(): Promise<void> {
  try {
    const existing = await db.select({ id: salaryStructures.id })
      .from(salaryStructures)
      .where(eq(salaryStructures.name, "Standard"))
      .limit(1);

    if (existing.length > 0) return; // already seeded

    const [inserted] = await db.insert(salaryStructures).values({
      name: "Standard",
      description: "Default India payroll structure: Basic 40%, HRA 50% of Basic, Conveyance ₹1,600 fixed, LTA 8.33% of Basic, Special Allowance residual.",
      isActive: true,
      pfMode: "restricted",
    }).returning({ id: salaryStructures.id });

    const structureId = inserted.id;

    await db.insert(salaryStructureRules).values([
      {
        structureId,
        componentName: "basic",
        ruleType: "percent_of_gross",
        value: "40",
        referenceComponent: null,
        lopMode: "proportional",
        sortOrder: 1,
      },
      {
        structureId,
        componentName: "hra",
        ruleType: "percent_of_component",
        value: "50",
        referenceComponent: "basic",
        lopMode: "proportional",
        sortOrder: 2,
      },
      {
        structureId,
        componentName: "conveyance",
        ruleType: "fixed",
        value: "1600",
        referenceComponent: null,
        lopMode: "proportional",
        sortOrder: 3,
      },
      {
        structureId,
        componentName: "lta",
        ruleType: "percent_of_component",
        value: "8.33",
        referenceComponent: "basic",
        lopMode: "proportional",
        sortOrder: 4,
      },
      {
        structureId,
        componentName: "special_allowance",
        ruleType: "residual",
        value: "0",
        referenceComponent: null,
        lopMode: "proportional",
        sortOrder: 5,
      },
    ]);

    console.log("[salary-structures] Seeded default 'Standard' structure");
  } catch (err) {
    console.error("[salary-structures] Seed failed:", err);
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerSalaryStructureRoutes(app: Express, requirePermission: PermissionFactory): void {
  const canView = requirePermission("hr.salaryStructures.view", "super_admin", "admin", "hr", "finance", "executive");
  const canManage = requirePermission("hr.salaryStructures.manage", "super_admin", "admin", "hr", "executive");
  const canProfile = requirePermission("hr.employee.pfExempt", "super_admin", "admin", "hr", "executive");
  const canSettings = requirePermission("hr.payroll.settings", "super_admin", "admin", "hr", "executive");

  // LIST structures (with embedded rules)
  app.get("/api/hr/salary-structures", requireAuth, canView, async (req: Request, res: Response) => {
    try {
      const structures = await db.select().from(salaryStructures).orderBy(asc(salaryStructures.createdAt));
      const rules = await db.select().from(salaryStructureRules).orderBy(asc(salaryStructureRules.structureId), asc(salaryStructureRules.sortOrder));

      const rulesByStructure: Record<string, typeof rules> = {};
      for (const rule of rules) {
        if (!rulesByStructure[rule.structureId]) rulesByStructure[rule.structureId] = [];
        rulesByStructure[rule.structureId].push(rule);
      }

      const result = structures.map((s) => ({
        ...s,
        rules: rulesByStructure[s.id] || [],
      }));

      res.json(result);
    } catch (err) {
      console.error("Failed to list salary structures:", err);
      res.status(500).json({ error: "Failed to fetch salary structures" });
    }
  });

  // GET single structure with rules
  app.get("/api/hr/salary-structures/:id", requireAuth, canView, async (req: Request, res: Response) => {
    try {
      const [structure] = await db.select().from(salaryStructures).where(eq(salaryStructures.id, req.params.id)).limit(1);
      if (!structure) return res.status(404).json({ error: "Structure not found" });

      const rules = await db.select().from(salaryStructureRules)
        .where(eq(salaryStructureRules.structureId, req.params.id))
        .orderBy(asc(salaryStructureRules.sortOrder));

      res.json({ ...structure, rules });
    } catch (err) {
      console.error("Failed to fetch salary structure:", err);
      res.status(500).json({ error: "Failed to fetch salary structure" });
    }
  });

  // CREATE structure + optional rules
  app.post("/api/hr/salary-structures", requireAuth, canManage, async (req: Request, res: Response) => {
    try {
      const { name, description, effectiveDate, pfMode, rules = [] } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: "Name is required" });

      const actor = req.session.userId!;
      const [structure] = await db.insert(salaryStructures).values({
        name: name.trim(),
        description: description || null,
        effectiveDate: effectiveDate || null,
        isActive: true,
        pfMode: pfMode || "restricted",
        createdBy: actor,
      }).returning();

      if (rules.length > 0) {
        await db.insert(salaryStructureRules).values(
          rules.map((r: any, i: number) => ({
            structureId: structure.id,
            componentName: r.componentName,
            ruleType: r.ruleType,
            value: String(r.value || 0),
            referenceComponent: r.referenceComponent || null,
            lopMode: r.lopMode || "proportional",
            sortOrder: r.sortOrder ?? i + 1,
          }))
        );
      }

      res.status(201).json(structure);
    } catch (err) {
      console.error("Failed to create salary structure:", err);
      res.status(500).json({ error: "Failed to create salary structure" });
    }
  });

  // UPDATE structure
  app.put("/api/hr/salary-structures/:id", requireAuth, canManage, async (req: Request, res: Response) => {
    try {
      const { name, description, effectiveDate, pfMode, isActive } = req.body;
      const [updated] = await db.update(salaryStructures)
        .set({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(effectiveDate !== undefined && { effectiveDate }),
          ...(pfMode !== undefined && { pfMode }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(eq(salaryStructures.id, req.params.id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Structure not found" });
      res.json(updated);
    } catch (err) {
      console.error("Failed to update salary structure:", err);
      res.status(500).json({ error: "Failed to update salary structure" });
    }
  });

  // SOFT-DELETE (deactivate) structure
  app.delete("/api/hr/salary-structures/:id", requireAuth, canManage, async (req: Request, res: Response) => {
    try {
      await db.update(salaryStructures)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(salaryStructures.id, req.params.id));
      res.json({ ok: true });
    } catch (err) {
      console.error("Failed to deactivate salary structure:", err);
      res.status(500).json({ error: "Failed to deactivate salary structure" });
    }
  });

  // GET rules for a structure
  app.get("/api/hr/salary-structures/:id/rules", requireAuth, canView, async (req: Request, res: Response) => {
    try {
      const rules = await db.select().from(salaryStructureRules)
        .where(eq(salaryStructureRules.structureId, req.params.id))
        .orderBy(asc(salaryStructureRules.sortOrder));
      res.json(rules);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch rules" });
    }
  });

  // REPLACE rules for a structure (full replace)
  app.put("/api/hr/salary-structures/:id/rules", requireAuth, canManage, async (req: Request, res: Response) => {
    try {
      const { rules } = req.body;
      if (!Array.isArray(rules)) return res.status(400).json({ error: "rules must be an array" });

      await db.delete(salaryStructureRules).where(eq(salaryStructureRules.structureId, req.params.id));

      if (rules.length > 0) {
        await db.insert(salaryStructureRules).values(
          rules.map((r: any, i: number) => ({
            structureId: req.params.id,
            componentName: r.componentName,
            ruleType: r.ruleType,
            value: String(r.value || 0),
            referenceComponent: r.referenceComponent || null,
            lopMode: r.lopMode || "proportional",
            sortOrder: r.sortOrder ?? i + 1,
          }))
        );
      }

      const updated = await db.select().from(salaryStructureRules)
        .where(eq(salaryStructureRules.structureId, req.params.id))
        .orderBy(asc(salaryStructureRules.sortOrder));

      res.json(updated);
    } catch (err) {
      console.error("Failed to replace rules:", err);
      res.status(500).json({ error: "Failed to update rules" });
    }
  });

  // PREVIEW — compute component breakdown from a gross + structure (no DB writes)
  app.post("/api/hr/salary-structures/preview", requireAuth, canView, async (req: Request, res: Response) => {
    try {
      const { structureId, gross, presentDays = 26, workingDays = 26, pfExempt = false, esiDisability = false, isFebruary = false } = req.body;
      // If ptState not provided in body, fall back to the system-wide configured PT state.
      let { ptState } = req.body as { ptState?: string };
      let ptBasis = "gross_after_lop";
      if (!ptState || ptState === "none") {
        const rows = await db.select({ key: systemSettings.key, value: systemSettings.value })
          .from(systemSettings).where(inArray(systemSettings.key, ["pt_state", "pt_basis"]));
        for (const r of rows) {
          if (r.key === "pt_state") ptState = (r.value as string) ?? "none";
          if (r.key === "pt_basis") ptBasis = (r.value as string) ?? "gross_after_lop";
        }
      }
      if (!structureId || !gross) return res.status(400).json({ error: "structureId and gross are required" });

      const [structure] = await db.select().from(salaryStructures).where(eq(salaryStructures.id, structureId)).limit(1);
      if (!structure) return res.status(404).json({ error: "Structure not found" });

      const rules = await db.select().from(salaryStructureRules)
        .where(eq(salaryStructureRules.structureId, structureId))
        .orderBy(asc(salaryStructureRules.sortOrder));

      const rulesMapped: StructureRule[] = rules.map((r) => ({
        componentName: r.componentName,
        ruleType: r.ruleType as any,
        value: Number(r.value),
        referenceComponent: r.referenceComponent,
        lopMode: r.lopMode as "proportional" | "fixed",
        sortOrder: r.sortOrder,
      }));

      const grossNum = Number(gross);
      const { components, grossAfterLOP, lopFactor } = computeComponentsFromGross(
        grossNum, rulesMapped, Number(presentDays), Number(workingDays)
      );

      const basicComp = components.find((c) => c.componentName === "basic");
      const statutory = computeIndiaStatutory({
        basicAfterLOP: basicComp?.amount ?? 0,
        grossAfterLOP,
        pfMode: (structure.pfMode as "restricted" | "unrestricted") || "restricted",
        pfExempt: !!pfExempt,
        ptState: ptState || null,
        ptCustomSlabs: await getPtCustomSlabs(),
        isDisability: !!esiDisability,
        isFebruary: !!isFebruary,
        // pt_basis: gross_before_lop uses the pre-LOP input gross for PT slab check
        ptGrossBasis: ptBasis === "gross_before_lop" ? grossNum : undefined,
      });

      res.json({
        structureName: structure.name,
        gross: grossNum,
        grossAfterLOP,
        lopFactor,
        components,
        statutory,
        netPayable: grossAfterLOP - statutory.totalEmployeeDeductions,
      });
    } catch (err) {
      console.error("Preview failed:", err);
      res.status(500).json({ error: "Preview computation failed" });
    }
  });

  // GET employee payroll profile (PF/ESI flags + assigned structure)
  app.get("/api/hr/employees/:userId/payroll-profile", requireAuth, canProfile, async (req: Request, res: Response) => {
    try {
      const [user] = await db.select({
        id: adminUsers.id,
        salaryStructureId: adminUsers.salaryStructureId,
        pfExempt: adminUsers.pfExempt,
        esiDisability: adminUsers.esiDisability,
      }).from(adminUsers).where(eq(adminUsers.id, req.params.userId)).limit(1);

      if (!user) return res.status(404).json({ error: "Employee not found" });
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch payroll profile" });
    }
  });

  // UPDATE employee payroll profile
  app.put("/api/hr/employees/:userId/payroll-profile", requireAuth, canProfile, async (req: Request, res: Response) => {
    try {
      const { salaryStructureId, pfExempt, esiDisability } = req.body;
      await db.update(adminUsers)
        .set({
          ...(salaryStructureId !== undefined && { salaryStructureId: salaryStructureId || null }),
          ...(pfExempt !== undefined && { pfExempt: !!pfExempt }),
          ...(esiDisability !== undefined && { esiDisability: !!esiDisability }),
          updatedAt: new Date(),
        })
        .where(eq(adminUsers.id, req.params.userId));
      res.json({ ok: true });
    } catch (err) {
      console.error("Failed to update payroll profile:", err);
      res.status(500).json({ error: "Failed to update payroll profile" });
    }
  });

  // GET current PT state setting
  app.get("/api/hr/payroll/pt-state", requireAuth, canSettings, async (req: Request, res: Response) => {
    try {
      const [row] = await db.select({ value: systemSettings.value })
        .from(systemSettings).where(eq(systemSettings.key, "pt_state")).limit(1);
      res.json({ ptState: row?.value ?? "none" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch PT state" });
    }
  });

  // SAVE PT state setting
  app.put("/api/hr/payroll/pt-state", requireAuth, canSettings, async (req: Request, res: Response) => {
    try {
      const { ptState } = req.body;
      const allowed = ["none", "maharashtra", "karnataka", "telangana", "tamil_nadu", "andhra_pradesh", "west_bengal", "gujarat", "madhya_pradesh", "odisha"];
      if (!allowed.includes(ptState)) return res.status(400).json({ error: "Invalid PT state" });
      await db.insert(systemSettings)
        .values({ key: "pt_state", value: ptState })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: ptState } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save PT state" });
    }
  });

  // GET PT basis setting (gross_after_lop | gross_before_lop)
  app.get("/api/hr/payroll/pt-basis", requireAuth, canSettings, async (req: Request, res: Response) => {
    try {
      const [row] = await db.select({ value: systemSettings.value })
        .from(systemSettings).where(eq(systemSettings.key, "pt_basis")).limit(1);
      res.json({ ptBasis: row?.value ?? "gross_after_lop" });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch PT basis" });
    }
  });

  // SAVE PT basis setting
  app.put("/api/hr/payroll/pt-basis", requireAuth, canSettings, async (req: Request, res: Response) => {
    try {
      const { ptBasis } = req.body;
      if (!["gross_after_lop", "gross_before_lop"].includes(ptBasis)) {
        return res.status(400).json({ error: "Invalid PT basis. Use gross_after_lop or gross_before_lop" });
      }
      await db.insert(systemSettings)
        .values({ key: "pt_basis", value: ptBasis })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: ptBasis } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save PT basis" });
    }
  });

  // GET PT slabs (system default + any custom overrides stored in system_settings)
  app.get("/api/hr/payroll/pt-slabs", requireAuth, canSettings, async (req: Request, res: Response) => {
    try {
      const custom = await getPtCustomSlabs();
      res.json({ defaults: DEFAULT_PT_SLABS, custom: custom || {} });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch PT slabs" });
    }
  });

  // SAVE custom PT slab overrides for a state
  app.put("/api/hr/payroll/pt-slabs", requireAuth, canSettings, async (req: Request, res: Response) => {
    try {
      const { state, slabs } = req.body;
      if (!state) return res.status(400).json({ error: "state is required" });

      const existing = await getPtCustomSlabs() || {};
      existing[state] = slabs;

      await db.insert(systemSettings)
        .values({ key: "pt_slabs_custom", value: JSON.stringify(existing) })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(existing) } });

      res.json({ ok: true });
    } catch (err) {
      console.error("Failed to save PT slabs:", err);
      res.status(500).json({ error: "Failed to save PT slabs" });
    }
  });
}

// ── Shared helper to load custom PT slabs from system_settings ────────────────

export async function getPtCustomSlabs(): Promise<Record<string, any> | null> {
  try {
    const [row] = await db.select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, "pt_slabs_custom"))
      .limit(1);
    if (!row) return null;
    return typeof row.value === "string" ? JSON.parse(row.value) : row.value as any;
  } catch {
    return null;
  }
}
