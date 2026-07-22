/**
 * Dev Control Center — Backend API
 * All routes return 404 when APP_ENV=production (hard gate enforced here).
 * Requires super_admin role for all endpoints.
 */

import { Router, type Request, type Response } from "express";
import { getEnvMode, invalidateEnvModeCache } from "./envMode";
import { storage } from "./storage";
import { config } from "./config";

function isSuperAdmin(req: Request): boolean {
  return (req.session as any)?.role === "super_admin";
}

function productionGate(_req: Request, res: Response, next: Function) {
  if (config.isProduction) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: Function) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (!isSuperAdmin(req)) {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}

export function createDevToolsRouter() {
  const router = Router();

  router.use(productionGate);
  router.use(requireSuperAdmin);

  router.get("/status", async (_req, res) => {
    try {
      const { JOB_REGISTRY } = await import("./scheduler");
      const envMode = await getEnvMode();

      const emailInterceptSetting = await storage.getSystemSetting("dev_email_override").catch(() => undefined);
      const dryRunSetting = await storage.getSystemSetting("dev_dry_run").catch(() => undefined);
      const overrideAddress = (emailInterceptSetting?.value as string) ?? "";
      const dryRun = (dryRunSetting?.value as boolean) ?? false;

      const crons = Array.from(JOB_REGISTRY.values()).map((job) => ({
        name: job.name,
        label: job.label,
        schedule: job.schedule,
        lastTriggeredAt: job.lastTriggeredAt?.toISOString() ?? null,
        lastTriggeredBy: job.lastTriggeredBy ?? null,
        suspended: envMode !== "production",
      }));

      res.json({
        envMode,
        emailIntercept: {
          enabled: !!overrideAddress,
          overrideAddress,
          dryRun,
        },
        crons,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/env-mode", async (req, res) => {
    try {
      const { mode } = req.body as { mode: string };
      const validModes = ["dev", "qa", "production"];
      if (!validModes.includes(mode)) {
        res.status(400).json({ error: "Invalid mode. Must be dev, qa, or production." });
        return;
      }
      if (mode === "production") {
        res.status(400).json({ error: "Cannot set env_mode to production from Dev Tools." });
        return;
      }
      await storage.upsertSystemSetting("env_mode", mode);
      invalidateEnvModeCache();
      res.json({ ok: true, envMode: mode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/email-intercept", async (req, res) => {
    try {
      const { overrideAddress, dryRun } = req.body as { overrideAddress?: string; dryRun?: boolean };
      if (overrideAddress !== undefined) {
        await storage.upsertSystemSetting("dev_email_override", overrideAddress ?? "");
      }
      if (dryRun !== undefined) {
        await storage.upsertSystemSetting("dev_dry_run", dryRun);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/crons/trigger/:jobName", async (req, res) => {
    try {
      const { jobName } = req.params;
      const { JOB_REGISTRY } = await import("./scheduler");
      const job = JOB_REGISTRY.get(jobName);
      if (!job) {
        res.status(404).json({ error: `Unknown job: ${jobName}` });
        return;
      }
      const actorId = (req.session as any)?.userId ?? "unknown";
      job.lastTriggeredAt = new Date();
      job.lastTriggeredBy = actorId;
      await job.handler();
      res.json({ ok: true, triggeredAt: job.lastTriggeredAt });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Job execution failed" });
    }
  });

  /**
   * Build a type-aware notification email that mirrors the format the real notification
   * gateway uses for each category. Both preview and send-test use this same builder
   * so preview renders exactly what would be dispatched by send-test.
   *
   * For each category, subject and body copy the structure used by actual callers
   * of notifyUser() / dispatchAutomatedEmail() in this codebase.
   */
  function buildTestNotificationEmail(
    user: { id: string; firstName: string | null; lastName: string | null; email: string },
    notificationType: string,
    sentAt: string,
  ) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const isoDate = new Date(sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const brandColor = "#1F3A6E";
    const accentColor = "#F47C20";

    // ── Type-specific content ────────────────────────────────────────────────
    let subject: string;
    let bodyTitle: string;
    let bodyLines: string[];

    if (notificationType.startsWith("leave_")) {
      subject = `[DEV TEST] Leave Update — ${fullName}`;
      bodyTitle = "Leave Request Update";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> leave notification of type <code>${notificationType}</code>.`,
        `In a real scenario, this would contain leave dates, type (e.g. EL / SL), balance after deduction, and approver details.`,
      ];
    } else if (notificationType.startsWith("attendance_")) {
      subject = `[DEV TEST] Attendance Alert — ${fullName}`;
      bodyTitle = "Attendance Notification";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> attendance notification of type <code>${notificationType}</code>.`,
        `In production, this would show punch times, attendance status (Present / Absent / Late), and any regularization link.`,
      ];
    } else if (notificationType.startsWith("salary_advance") || notificationType.startsWith("payroll_")) {
      subject = `[DEV TEST] Salary / Payroll Update — ${fullName}`;
      bodyTitle = "Payroll Notification";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> payroll notification of type <code>${notificationType}</code>.`,
        `A real email would contain advance amounts, repayment schedule, or payslip download link.`,
      ];
    } else if (notificationType.startsWith("training_") || notificationType.startsWith("compliance_")) {
      subject = `[DEV TEST] Training / Compliance — ${fullName}`;
      bodyTitle = "Training Notification";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> training notification of type <code>${notificationType}</code>.`,
        `In production, this includes track name, due date, completion percentage, and a link to the training portal.`,
      ];
    } else if (notificationType.startsWith("sop_")) {
      subject = `[DEV TEST] SOP Notification — ${fullName}`;
      bodyTitle = "SOP / Process Governance";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> SOP notification of type <code>${notificationType}</code>.`,
        `Real emails include SOP title, your role assignment, review deadline, and a direct link.`,
      ];
    } else if (notificationType.startsWith("pip_") || notificationType.startsWith("probation_") || notificationType.startsWith("growth_")) {
      subject = `[DEV TEST] Performance Plan — ${fullName}`;
      bodyTitle = "Growth / Probation Plan Update";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> performance plan notification of type <code>${notificationType}</code>.`,
        `In production, this would show plan name, current milestone, manager, and next check-in date.`,
      ];
    } else if (notificationType.startsWith("goal_")) {
      subject = `[DEV TEST] Goal Update — ${fullName}`;
      bodyTitle = "Performance Goals";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> goal notification of type <code>${notificationType}</code>.`,
        `Real emails include goal title, current progress, target, and due date.`,
      ];
    } else if (notificationType.startsWith("hird_")) {
      subject = `[DEV TEST] Request Update — ${fullName}`;
      bodyTitle = "Internal Request (HIRD) Update";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> HIRD notification of type <code>${notificationType}</code>.`,
        `In production, this contains request title, current status, reviewer name, and a link to the request.`,
      ];
    } else if (notificationType.startsWith("document_") || notificationType.startsWith("offer_letter_")) {
      subject = `[DEV TEST] Document Ready — ${fullName}`;
      bodyTitle = "Document / Offer Letter";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> document notification of type <code>${notificationType}</code>.`,
        `A real email includes document type (offer letter, experience letter, etc.), reference number, and a signing/download link.`,
      ];
    } else if (notificationType.startsWith("onboarding_")) {
      subject = `[DEV TEST] Onboarding Reminder — ${fullName}`;
      bodyTitle = "Onboarding Checklist";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> onboarding notification of type <code>${notificationType}</code>.`,
        `Real emails list pending checklist items (bank details, documents, training, consent) with completion percentages.`,
      ];
    } else if (notificationType.startsWith("studio_")) {
      subject = `[DEV TEST] Content Studio — ${fullName}`;
      bodyTitle = "Content Studio Notification";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> Content Studio notification of type <code>${notificationType}</code>.`,
        `Production emails include article title, campaign name, assigned reviewer, and a link to the Studio dashboard.`,
      ];
    } else if (notificationType.startsWith("governance_") || notificationType.startsWith("checkin_") || notificationType.startsWith("compliance_digest")) {
      subject = `[DEV TEST] Governance Alert — ${fullName}`;
      bodyTitle = "Governance / Compliance Alert";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> governance notification of type <code>${notificationType}</code>.`,
        `Real emails list overdue controls, escalation status, and owner action items.`,
      ];
    } else if (notificationType.startsWith("recruiter_activity_") || notificationType.startsWith("ceipal_")) {
      subject = `[DEV TEST] Recruiter Activity — ${fullName}`;
      bodyTitle = "Recruiter / ATS Notification";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> recruiter notification of type <code>${notificationType}</code>.`,
        `In production, this would contain today's call/screen targets, missed Ceipal updates, and ATS quick-links.`,
      ];
    } else {
      subject = `[DEV TEST] ${notificationType} — ${fullName}`;
      bodyTitle = "System Notification";
      bodyLines = [
        `Hi ${fullName},`,
        `This is a <strong>test</strong> notification of type <code>${notificationType}</code>.`,
        `No specific template is registered for this type — this is a generic sandbox render.`,
      ];
    }

    const html = `
<div style="font-family:'Inter',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:${brandColor};padding:20px 28px">
    <p style="color:#ffffff;font-size:18px;font-weight:700;margin:0">Hire'in Solutions</p>
    <p style="color:#c7d2fe;font-size:11px;margin:4px 0 0">Dev Control Center — Notification Preview</p>
  </div>
  <div style="padding:28px">
    <h2 style="color:#111827;font-size:16px;font-weight:600;margin:0 0 16px">${bodyTitle}</h2>
    ${bodyLines.map(line => `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 12px">${line}</p>`).join("")}
    <div style="margin:20px 0;padding:14px;background:#f9fafb;border-left:3px solid ${accentColor};border-radius:0 4px 4px 0;font-size:12px;color:#6b7280">
      <strong>Notification type:</strong> <code>${notificationType}</code><br/>
      <strong>Recipient:</strong> ${fullName} &lt;${user.email}&gt;<br/>
      <strong>Rendered at:</strong> ${isoDate}
    </div>
    <p style="color:#9ca3af;font-size:11px;margin:20px 0 0">
      This email was generated by the Dev Control Center Notification Sandbox. It is subject to your current email intercept settings (override address / dry-run) and does not represent a real system event.
    </p>
  </div>
</div>`.trim();

    const text = [
      `${bodyTitle} [DEV TEST]`,
      ``,
      bodyLines.map(l => l.replace(/<[^>]+>/g, "")).join("\n"),
      ``,
      `Type: ${notificationType}`,
      `Recipient: ${fullName} <${user.email}>`,
      `Rendered at: ${isoDate}`,
    ].join("\n");

    return { subject, html, text };
  }

  router.post("/notify/preview", async (req, res) => {
    try {
      const { employeeId, notificationType } = req.body as { employeeId: string; notificationType: string };
      if (!employeeId || !notificationType) {
        res.status(400).json({ error: "employeeId and notificationType are required" });
        return;
      }
      const user = await storage.getAdminUser(employeeId);
      if (!user) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }
      const sentAt = new Date().toISOString();
      const { subject, html, text } = buildTestNotificationEmail(user, notificationType, sentAt);

      // Check current intercept settings so preview reflects what would actually be delivered
      const emailInterceptSetting = await storage.getSystemSetting("dev_email_override").catch(() => undefined);
      const dryRunSetting = await storage.getSystemSetting("dev_dry_run").catch(() => undefined);
      const overrideAddress = (emailInterceptSetting?.value as string) ?? "";
      const dryRun = (dryRunSetting?.value as boolean) ?? false;
      const effectiveTo = dryRun ? "(dry-run — not delivered)" : overrideAddress || user.email;

      res.json({ subject, html, text, channel: "email", to: effectiveTo, dryRun, intercepted: !!overrideAddress && !dryRun });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/notify/send-test", async (req, res) => {
    try {
      const { employeeId, notificationType } = req.body as { employeeId: string; notificationType: string };
      if (!employeeId || !notificationType) {
        res.status(400).json({ error: "employeeId and notificationType are required" });
        return;
      }
      const user = await storage.getAdminUser(employeeId);
      if (!user) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }

      const emailInterceptSetting = await storage.getSystemSetting("dev_email_override").catch(() => undefined);
      const dryRunSetting = await storage.getSystemSetting("dev_dry_run").catch(() => undefined);
      const overrideAddress = (emailInterceptSetting?.value as string) ?? "";
      const dryRun = (dryRunSetting?.value as boolean) ?? false;

      // Safety gate: require intercept or dry-run to prevent sandbox sends reaching real recipients
      if (!dryRun && !overrideAddress) {
        res.status(400).json({
          error: "Sandbox safety: configure an override address or enable dry-run before sending test notifications. Go to Environment tab to set this up.",
        });
        return;
      }

      const sentAt = new Date().toISOString();
      const { subject, html, text } = buildTestNotificationEmail(user, notificationType, sentAt);

      // Use the real notifyUser gateway — email intercept settings (override/dry-run) apply automatically
      const { notifyUser } = await import("./notifications");
      await notifyUser({
        userId: employeeId,
        type: notificationType,
        title: `[Test] ${notificationType}`,
        message: `Test notification of type "${notificationType}" sent from Dev Control Center at ${sentAt}.`,
        metadata: { testSend: true, sentAt },
        email: { subject, html, text, configType: notificationType, sourceJob: "dev_tools_sandbox" },
      });

      const sentTo = dryRun ? "(dry-run — not delivered)" : overrideAddress;
      res.json({ ok: true, sentTo });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
