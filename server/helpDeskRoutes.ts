import type { Express, Request, Response } from "express";
import { storage } from "./storage";
import { sendHelpDeskEmail } from "./email";
import { z } from "zod";

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  next();
}

const RESOLVER_ROLES = ["super_admin", "admin", "hr", "operations"];
// Approval is a manager responsibility — only the designated manager or super_admin may approve/reject
const APPROVAL_ALLOWED = (role: string, managerId: string | null | undefined, userId: string) =>
  role === "super_admin" || (role === "manager" && managerId === userId);

function baseUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

// Strict server-side state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_approval: [], // only approve/reject/return-for-info endpoints change this
  assigned: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected", "assigned"],
  needs_info: ["in_progress", "assigned", "rejected"], // resolver may manually pull a returned ticket back
  resolved: ["closed", "in_progress"], // in_progress = reopen by owner or resolver
  closed: [],
  rejected: [],
};

// Notify helper — fires in-app notification regardless of email availability,
// then also attempts email (non-blocking)
async function notifyUser(opts: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string;
  email?: {
    to: string;
    firstName: string;
    event: string;
    requestNumber: string;
    requestTitle: string;
    requestType: string;
    emailMessage?: string;
    portalUrl: string;
  };
}) {
  // Always create in-app notification
  storage.createNotification({
    userId: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    link: opts.link,
  } as any).catch(() => {});

  // Email is optional / best-effort
  if (opts.email?.to) {
    sendHelpDeskEmail({
      to: opts.email.to,
      firstName: opts.email.firstName,
      event: opts.email.event,
      requestNumber: opts.email.requestNumber,
      requestTitle: opts.email.requestTitle,
      requestType: opts.email.requestType,
      message: opts.email.emailMessage,
      portalUrl: opts.email.portalUrl,
    }).catch(() => {});
  }
}

export function registerHelpDeskRoutes(app: Express) {

  // ── GET /api/help-desk/open-count — sidebar badge (resolver roles only)
  app.get("/api/help-desk/open-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.session.role || "employee";
      if (!RESOLVER_ROLES.includes(role)) return res.json({ count: 0 });
      const count = await storage.getHirdOpenCount();
      return res.json({ count });
    } catch { return res.json({ count: 0 }); }
  });

  // ── Type-specific template Zod schemas (server-enforced)
  const ACCESS_TEMPLATE = z.object({
    system: z.string().min(1, "System/Tool is required"),
    accessLevel: z.enum(["view_only", "contributor", "admin", "custom"], { required_error: "Access level is required" }),
    accessType: z.enum(["permanent", "temporary"]).default("permanent"),
    accessEndDate: z.string().optional(),
    justification: z.string().min(50, "Business justification must be at least 50 characters"),
    requestedRole: z.string().optional(),
    projectOrClient: z.string().optional(),
  }).refine(d => d.accessType !== "temporary" || !!d.accessEndDate, {
    message: "End date is required for temporary access",
    path: ["accessEndDate"],
  });

  const HR_TEMPLATE = z.object({
    requestSubtype: z.enum([
      "Letter Request", "Payslip Issue", "Leave Issue", "Policy Clarification",
      "Salary Discrepancy", "Documentation", "Other",
    ], { required_error: "HR sub-type is required" }),
    period: z.string().optional(),
    additionalContext: z.string().optional(),
  });

  const OPS_TEMPLATE = z.object({
    requestSubtype: z.string().min(1, "Ops sub-type is required"),
    asset: z.string().optional(),        // Equipment/Device name or model
    quantity: z.string().optional(),
    urgency: z.enum(["immediate", "this_week", "this_month", "no_rush"]).optional(),
    isBlocking: z.enum(["yes", "no"]).optional(),
  });

  const GENERAL_TEMPLATE = z.object({
    category: z.string().optional(),
  });

  function validateTemplateData(type: string, templateData: any) {
    if (type === "access") return ACCESS_TEMPLATE.safeParse(templateData || {});
    if (type === "hr") return HR_TEMPLATE.safeParse(templateData || {});
    if (type === "ops") return OPS_TEMPLATE.safeParse(templateData || {});
    return GENERAL_TEMPLATE.safeParse(templateData || {});
  }

  // ── POST /api/help-desk/requests — create (atomic HIRD-YYYY-NNNNN number)
  app.post("/api/help-desk/requests", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;

      const schema = z.object({
        type: z.enum(["access", "hr", "ops", "general"]),
        title: z.string().min(3).max(200),
        description: z.string().min(5),
        priority: z.enum(["p1", "p2", "p3", "p4"]).optional().default("p3"),
        neededByDate: z.string().nullable().optional(),
        templateData: z.record(z.any()).nullable().optional(),
        requestedForId: z.string().nullable().optional(),
        attachmentUrl: z.string().url().nullable().optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.errors });

      const { type, title, description, priority, neededByDate, templateData, requestedForId, attachmentUrl } = parsed.data;

      // Type-specific template validation
      const tplValidation = validateTemplateData(type, templateData);
      if (!tplValidation.success) {
        return res.status(400).json({ message: "Invalid template data", errors: tplValidation.error.errors });
      }

      const requester = await storage.getAdminUser(userId);
      const managerId = requester?.managerId || null;

      const request = await storage.createInternalRequestWithNumber({
        requesterId: userId,
        requestedForId: requestedForId || null,
        managerId: managerId || undefined,
        type,
        title,
        description,
        priority,
        neededByDate: neededByDate || null,
        templateData: templateData || null,
        attachmentUrl: attachmentUrl || null,
      } as any);

      await storage.addInternalRequestAuditEntry({
        requestId: request.id,
        actorId: userId,
        action: "created",
        newStatus: "pending_approval",
        metadata: { requestNumber: request.requestNumber },
      } as any);

      // Notify requester (submitted confirmation)
      notifyUser({
        userId,
        type: "hird_submitted",
        title: "Request submitted",
        message: `Your request ${request.requestNumber} is pending manager approval`,
        link: `/admin/hr?tab=requests`,
        email: requester?.email ? {
          to: requester.email,
          firstName: requester.firstName || "there",
          event: "submitted",
          requestNumber: request.requestNumber,
          requestTitle: title,
          requestType: type,
          emailMessage: `Your request has been submitted and is pending manager approval. Request number: <strong>${request.requestNumber}</strong>`,
          portalUrl: `${baseUrl(req)}/admin/hr?tab=requests`,
        } : undefined,
      });

      // Notify manager (action needed)
      if (managerId) {
        const manager = await storage.getAdminUser(managerId);
        notifyUser({
          userId: managerId,
          type: "hird_approval_needed",
          title: "New request needs approval",
          message: `${requester?.firstName || "An employee"} submitted ${request.requestNumber}: ${title}`,
          link: `/admin/hr/my-team?tab=approvals`,
          email: manager?.email ? {
            to: manager.email,
            firstName: manager.firstName || "there",
            event: "submitted",
            requestNumber: request.requestNumber,
            requestTitle: title,
            requestType: type,
            emailMessage: `${requester?.firstName || "An employee"} submitted a request requiring your approval.`,
            portalUrl: `${baseUrl(req)}/admin/hr/my-team?tab=approvals`,
          } : undefined,
        });
      }

      return res.status(201).json(request);
    } catch (err: any) {
      console.error("HIRD create error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/help-desk/requests/stats — must be before /:id
  app.get("/api/help-desk/requests/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const stats = await storage.getHirdStats(userId, role);
      return res.json(stats);
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/help-desk/requests — list (role-scoped, tab filter)
  app.get("/api/help-desk/requests", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";
      const { tab, type } = req.query as Record<string, string>;

      let requests;
      if (RESOLVER_ROLES.includes(role)) {
        requests = await storage.listInternalRequestsQueue({
          tab: tab || "open",
          type: type && type !== "all" ? type : undefined,
          assignedToId: tab === "mine" ? userId : undefined,
        });
      } else if (role === "manager") {
        const managerReqs = await storage.listInternalRequestsForManager(userId);
        const ownReqs = await storage.listInternalRequestsByRequester(userId);
        const seen = new Set<string>();
        requests = [...managerReqs, ...ownReqs].filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
      } else {
        requests = await storage.listInternalRequestsByRequester(userId);
      }

      const userIds = new Set<string>();
      for (const r of requests) {
        if (r.requesterId) userIds.add(r.requesterId);
        if (r.managerId) userIds.add(r.managerId);
        if ((r as any).assignedToId) userIds.add((r as any).assignedToId);
      }
      const userMap: Record<string, any> = {};
      for (const uid of userIds) {
        const u = await storage.getAdminUser(uid);
        if (u) userMap[uid] = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role };
      }

      return res.json(requests.map(r => ({
        ...r,
        requester: r.requesterId ? userMap[r.requesterId] : null,
        manager: r.managerId ? userMap[r.managerId] : null,
        assignedTo: (r as any).assignedToId ? userMap[(r as any).assignedToId] : null,
      })));
    } catch (err: any) {
      console.error("HIRD list error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/help-desk/requests/:id
  app.get("/api/help-desk/requests/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });

      const isOwner = request.requesterId === userId;
      const isManager = request.managerId === userId;
      const isResolver = RESOLVER_ROLES.includes(role);

      if (!isOwner && !isManager && !isResolver) return res.status(403).json({ message: "Forbidden" });

      const [comments, auditLog, approvals] = await Promise.all([
        storage.getInternalRequestComments(request.id),
        storage.getInternalRequestAuditLog(request.id),
        storage.listInternalRequestApprovals(request.id),
      ]);

      const rawIds = [
        request.requesterId, request.managerId,
        (request as any).assignedToId, (request as any).requestedForId,
        ...comments.map(c => c.authorId),
        ...auditLog.map(a => a.actorId),
        ...approvals.map(a => a.approverId),
      ].filter(Boolean) as string[];
      const userMap: Record<string, any> = {};
      for (const uid of new Set(rawIds)) {
        const u = await storage.getAdminUser(uid);
        if (u) userMap[uid] = { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role };
      }

      return res.json({
        ...request,
        requester: request.requesterId ? userMap[request.requesterId] : null,
        requestedFor: (request as any).requestedForId ? userMap[(request as any).requestedForId] : null,
        manager: request.managerId ? userMap[request.managerId] : null,
        assignedTo: (request as any).assignedToId ? userMap[(request as any).assignedToId] : null,
        comments: comments.map(c => ({ ...c, author: userMap[c.authorId] || null })),
        auditLog: auditLog.map(a => ({ ...a, actor: userMap[a.actorId] || null })),
        approvals: approvals.map(a => ({ ...a, approver: userMap[a.approverId] || null })),
      });
    } catch (err: any) {
      console.error("HIRD get error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/help-desk/requests/:id/approve
  // Only the designated manager for this ticket, or super_admin, may approve.
  app.post("/api/help-desk/requests/:id/approve", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      if (request.status !== "pending_approval") return res.status(400).json({ message: "Request is not pending approval" });

      if (!APPROVAL_ALLOWED(role, request.managerId, userId)) {
        return res.status(403).json({ message: "Only the designated manager may approve this request" });
      }

      const { reason } = req.body;
      const oldStatus = request.status;

      await storage.addInternalRequestApproval({ requestId: request.id, approverId: userId, decision: "approved", reason: reason || null } as any);
      const updated = await storage.updateInternalRequest(request.id, { status: "assigned" });
      await storage.addInternalRequestAuditEntry({ requestId: request.id, actorId: userId, action: "approved", oldStatus, newStatus: "assigned", metadata: { reason } } as any);

      const requester = await storage.getAdminUser(request.requesterId);
      notifyUser({
        userId: request.requesterId,
        type: "hird_approved",
        title: "Request approved",
        message: `${request.requestNumber} has been approved and sent to the team`,
        link: `/admin/hr?tab=requests`,
        email: requester?.email ? {
          to: requester.email,
          firstName: requester.firstName || "there",
          event: "approved",
          requestNumber: request.requestNumber,
          requestTitle: request.title,
          requestType: request.type,
          emailMessage: "Your request has been approved and sent to the team for resolution.",
          portalUrl: `${baseUrl(req)}/admin/hr?tab=requests`,
        } : undefined,
      });

      return res.json(updated);
    } catch (err: any) {
      console.error("HIRD approve error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/help-desk/requests/:id/reject
  // Only the designated manager for this ticket, or super_admin, may reject. Reason is required.
  app.post("/api/help-desk/requests/:id/reject", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });
      if (request.status !== "pending_approval") return res.status(400).json({ message: "Request is not pending approval" });

      if (!APPROVAL_ALLOWED(role, request.managerId, userId)) {
        return res.status(403).json({ message: "Only the designated manager may reject this request" });
      }

      const reasonSchema = z.object({ reason: z.string().min(1, "A rejection reason is required") });
      const reasonParsed = reasonSchema.safeParse(req.body);
      if (!reasonParsed.success) return res.status(400).json({ message: "A rejection reason is required" });
      const { reason } = reasonParsed.data;
      const oldStatus = request.status;

      await storage.addInternalRequestApproval({ requestId: request.id, approverId: userId, decision: "rejected", reason: reason || null } as any);
      const updated = await storage.updateInternalRequest(request.id, { status: "rejected" });
      await storage.addInternalRequestAuditEntry({ requestId: request.id, actorId: userId, action: "rejected", oldStatus, newStatus: "rejected", metadata: { reason } } as any);

      const requester = await storage.getAdminUser(request.requesterId);
      notifyUser({
        userId: request.requesterId,
        type: "hird_rejected",
        title: "Request not approved",
        message: `${request.requestNumber} was not approved${reason ? `: ${reason}` : ""}`,
        link: `/admin/hr?tab=requests`,
        email: requester?.email ? {
          to: requester.email,
          firstName: requester.firstName || "there",
          event: "rejected",
          requestNumber: request.requestNumber,
          requestTitle: request.title,
          requestType: request.type,
          emailMessage: reason ? `Reason: ${reason}` : undefined,
          portalUrl: `${baseUrl(req)}/admin/hr?tab=requests`,
        } : undefined,
      });

      return res.json(updated);
    } catch (err: any) {
      console.error("HIRD reject error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── PATCH /api/help-desk/requests/:id — enforced state machine
  app.patch("/api/help-desk/requests/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });

      const isResolver = RESOLVER_ROLES.includes(role);
      const isOwner = request.requesterId === userId;

      if (!isResolver && !isOwner) return res.status(403).json({ message: "Forbidden" });

      const schema = z.object({
        status: z.enum(["pending_approval", "assigned", "in_progress", "resolved", "closed", "rejected"]).optional(),
        assignedToId: z.string().nullable().optional(),
        priority: z.enum(["p1", "p2", "p3", "p4"]).optional(),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid input" });

      const { status: newStatus, assignedToId, priority } = parsed.data;

      // Non-resolvers (owners) may ONLY: close a resolved ticket OR reopen a resolved ticket (→ in_progress)
      if (!isResolver) {
        if (assignedToId !== undefined) return res.status(403).json({ message: "Forbidden" });
        if (priority !== undefined) return res.status(403).json({ message: "Forbidden" });
        if (newStatus && newStatus !== "closed" && newStatus !== "in_progress") {
          return res.status(403).json({ message: "Owners may only confirm resolution or reopen a resolved request" });
        }
        if (newStatus === "closed" && request.status !== "resolved") {
          return res.status(400).json({ message: "Can only close a resolved request" });
        }
        if (newStatus === "in_progress" && request.status !== "resolved") {
          return res.status(400).json({ message: "Can only reopen a resolved request" });
        }
      }

      // State machine: validate resolver status transitions
      if (isResolver && newStatus && newStatus !== request.status) {
        const allowed = VALID_TRANSITIONS[request.status] || [];
        if (!allowed.includes(newStatus)) {
          return res.status(400).json({ message: `Cannot transition from ${request.status} to ${newStatus}` });
        }
      }

      const oldStatus = request.status;
      const updates: Partial<typeof request> = {};
      if (newStatus) updates.status = newStatus as any;
      if (assignedToId !== undefined) updates.assignedToId = assignedToId;
      if (priority) updates.priority = priority as any;

      const updated = await storage.updateInternalRequest(request.id, updates);

      const isReopen = newStatus === "in_progress" && oldStatus === "resolved" && !isResolver;
      const action = isReopen ? "reopened" : assignedToId ? "assigned" : newStatus ? `status_changed_to_${newStatus}` : "updated";
      await storage.addInternalRequestAuditEntry({ requestId: request.id, actorId: userId, action, oldStatus, newStatus: newStatus || oldStatus, metadata: { assignedToId, priority } } as any);

      // Notify on resolution
      if (newStatus === "resolved") {
        const requester = await storage.getAdminUser(request.requesterId);
        notifyUser({
          userId: request.requesterId,
          type: "hird_resolved",
          title: "Request resolved",
          message: `${request.requestNumber} has been resolved — please confirm or reopen`,
          link: `/admin/help-desk/${request.id}`,
          email: requester?.email ? {
            to: requester.email,
            firstName: requester.firstName || "there",
            event: "resolved",
            requestNumber: request.requestNumber,
            requestTitle: request.title,
            requestType: request.type,
            emailMessage: "Your request has been marked as resolved. Please visit the portal to confirm resolution or reopen if the issue persists.",
            portalUrl: `${baseUrl(req)}/admin/hr?tab=requests`,
          } : undefined,
        });
      }

      // Notify resolver/assignee when employee confirms (closed)
      if (newStatus === "closed" && isOwner) {
        const notifyIds = new Set<string>();
        if ((request as any).assignedToId) notifyIds.add((request as any).assignedToId);
        if (request.managerId) notifyIds.add(request.managerId);
        for (const uid of notifyIds) {
          const u = await storage.getAdminUser(uid);
          notifyUser({
            userId: uid,
            type: "hird_confirmed_closed",
            title: "Request confirmed resolved",
            message: `Requester confirmed ${request.requestNumber} is resolved and closed it`,
            link: `/admin/help-desk/${request.id}`,
            email: u?.email ? {
              to: u.email,
              firstName: u.firstName || "there",
              event: "closed",
              requestNumber: request.requestNumber,
              requestTitle: request.title,
              requestType: request.type,
              emailMessage: "The requester has confirmed resolution and closed the request.",
              portalUrl: `${baseUrl(req)}/admin/help-desk/${request.id}`,
            } : undefined,
          });
        }
      }

      // Notify resolver/assignee when employee reopens
      if (isReopen) {
        const notifyIds = new Set<string>();
        if ((request as any).assignedToId) notifyIds.add((request as any).assignedToId);
        if (request.managerId) notifyIds.add(request.managerId);
        for (const uid of notifyIds) {
          const u = await storage.getAdminUser(uid);
          notifyUser({
            userId: uid,
            type: "hird_reopened",
            title: "Request reopened",
            message: `Requester reopened ${request.requestNumber} — issue not resolved`,
            link: `/admin/help-desk/${request.id}`,
            email: u?.email ? {
              to: u.email,
              firstName: u.firstName || "there",
              event: "reopened",
              requestNumber: request.requestNumber,
              requestTitle: request.title,
              requestType: request.type,
              emailMessage: "The requester has reopened this request, indicating the issue was not resolved.",
              portalUrl: `${baseUrl(req)}/admin/help-desk/${request.id}`,
            } : undefined,
          });
        }
      }

      // Notify assignee on assignment
      if (assignedToId && assignedToId !== (request as any).assignedToId) {
        const assignee = await storage.getAdminUser(assignedToId);
        notifyUser({
          userId: assignedToId,
          type: "hird_assigned",
          title: "Request assigned to you",
          message: `${request.requestNumber}: ${request.title}`,
          link: `/admin/help-desk/${request.id}`,
          email: assignee?.email ? {
            to: assignee.email,
            firstName: assignee.firstName || "there",
            event: "assigned",
            requestNumber: request.requestNumber,
            requestTitle: request.title,
            requestType: request.type,
            emailMessage: "You have been assigned to resolve this request.",
            portalUrl: `${baseUrl(req)}/admin/help-desk/${request.id}`,
          } : undefined,
        });
      }

      return res.json(updated);
    } catch (err: any) {
      console.error("HIRD patch error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/help-desk/requests/:id/comments
  app.post("/api/help-desk/requests/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });

      const isOwner = request.requesterId === userId;
      const isManager = request.managerId === userId;
      const isResolver = RESOLVER_ROLES.includes(role);

      if (!isOwner && !isManager && !isResolver) return res.status(403).json({ message: "Forbidden" });

      const { body } = req.body;
      if (!body || typeof body !== "string" || body.trim().length === 0) return res.status(400).json({ message: "Comment body required" });

      const comment = await storage.addInternalRequestComment({ requestId: request.id, authorId: userId, body: body.trim() });
      await storage.addInternalRequestAuditEntry({ requestId: request.id, actorId: userId, action: "commented", metadata: { commentId: comment.id } } as any);

      const actor = await storage.getAdminUser(userId);
      const actorName = actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() : "A team member";

      const notifyIds = new Set<string>();
      if (!isOwner) notifyIds.add(request.requesterId);
      if (request.managerId && request.managerId !== userId) notifyIds.add(request.managerId);
      if ((request as any).assignedToId && (request as any).assignedToId !== userId) notifyIds.add((request as any).assignedToId);

      for (const uid of notifyIds) {
        const u = await storage.getAdminUser(uid);
        notifyUser({
          userId: uid,
          type: "hird_comment",
          title: "New comment on request",
          message: `${actorName} commented on ${request.requestNumber}`,
          link: `/admin/help-desk/${request.id}`,
          email: u?.email ? {
            to: u.email,
            firstName: u.firstName || "there",
            event: "comment",
            requestNumber: request.requestNumber,
            requestTitle: request.title,
            requestType: request.type,
            emailMessage: `New comment from ${actorName}: "${body.trim().substring(0, 120)}${body.length > 120 ? "..." : ""}"`,
            portalUrl: `${baseUrl(req)}/admin/hr?tab=requests`,
          } : undefined,
        });
      }

      return res.status(201).json({
        ...comment,
        author: actor ? { id: actor.id, firstName: actor.firstName, lastName: actor.lastName } : null,
      });
    } catch (err: any) {
      console.error("HIRD comment error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/help-desk/requests/:id/return-for-info — bounce a ticket back to the requester
  // Allowed for the approving manager (while pending_approval) or any resolver (assigned/in_progress).
  // A comment is REQUIRED so the requester knows what is needed.
  app.post("/api/help-desk/requests/:id/return-for-info", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const role = req.session.role || "employee";

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });

      const isResolver = RESOLVER_ROLES.includes(role);
      const isApprover = APPROVAL_ALLOWED(role, request.managerId, userId);

      // Who can return, and from which states
      const canReturnFromApproval = request.status === "pending_approval" && isApprover;
      const canReturnFromWork = (request.status === "assigned" || request.status === "in_progress") && isResolver;
      if (!canReturnFromApproval && !canReturnFromWork) {
        return res.status(403).json({ message: "You cannot return this request for more information at its current stage" });
      }

      const { comment } = req.body;
      if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
        return res.status(400).json({ message: "A comment explaining what is needed is required" });
      }

      const priorStatus = request.status;
      const updated = await storage.updateInternalRequest(request.id, { status: "needs_info" as any });

      const savedComment = await storage.addInternalRequestComment({ requestId: request.id, authorId: userId, body: comment.trim() });
      await storage.addInternalRequestAuditEntry({
        requestId: request.id,
        actorId: userId,
        action: "returned_for_info",
        oldStatus: priorStatus,
        newStatus: "needs_info",
        metadata: { priorStatus, commentId: savedComment.id },
      } as any);

      // Notify the requester — action needed
      const requester = await storage.getAdminUser(request.requesterId);
      notifyUser({
        userId: request.requesterId,
        type: "hird_needs_info",
        title: "Action needed on your request",
        message: `${request.requestNumber} was returned — more information is needed`,
        link: `/admin/help-desk/${request.id}`,
        email: requester?.email ? {
          to: requester.email,
          firstName: requester.firstName || "there",
          event: "needs_info",
          requestNumber: request.requestNumber,
          requestTitle: request.title,
          requestType: request.type,
          emailMessage: `More information is needed before we can continue: "${comment.trim().substring(0, 200)}${comment.trim().length > 200 ? "..." : ""}"`,
          portalUrl: `${baseUrl(req)}/admin/help-desk/${request.id}`,
        } : undefined,
      });

      return res.json(updated);
    } catch (err: any) {
      console.error("HIRD return-for-info error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/help-desk/requests/:id/respond — requester replies to a needs_info ticket
  // Adds the reply (+ optional attachment) and moves the ticket back to its prior active state.
  app.post("/api/help-desk/requests/:id/respond", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;

      const request = await storage.getInternalRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Not found" });

      if (request.requesterId !== userId) return res.status(403).json({ message: "Only the requester can respond" });
      if (request.status !== "needs_info") return res.status(400).json({ message: "This request is not awaiting your response" });

      const { body, attachmentUrl } = req.body;
      if (!body || typeof body !== "string" || body.trim().length === 0) {
        return res.status(400).json({ message: "A reply is required" });
      }

      // Determine where to send the ticket back — recorded when it was returned
      const auditLog = await storage.getInternalRequestAuditLog(request.id);
      const lastReturn = [...auditLog].reverse().find((a: any) => a.action === "returned_for_info");
      const priorStatus = ((lastReturn?.metadata as any)?.priorStatus as string) || "in_progress";

      const updates: any = { status: priorStatus };
      if (attachmentUrl && typeof attachmentUrl === "string" && attachmentUrl.trim()) {
        updates.attachmentUrl = attachmentUrl.trim();
      }
      const updated = await storage.updateInternalRequest(request.id, updates);

      const savedComment = await storage.addInternalRequestComment({ requestId: request.id, authorId: userId, body: body.trim() });
      await storage.addInternalRequestAuditEntry({
        requestId: request.id,
        actorId: userId,
        action: "responded_to_info",
        oldStatus: "needs_info",
        newStatus: priorStatus,
        metadata: { commentId: savedComment.id, attachmentUrl: updates.attachmentUrl },
      } as any);

      const actor = await storage.getAdminUser(userId);
      const actorName = actor ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim() : "The requester";

      // Notify resolver/owner(s) — the assignee and/or the manager
      const notifyIds = new Set<string>();
      if ((request as any).assignedToId) notifyIds.add((request as any).assignedToId);
      if (request.managerId) notifyIds.add(request.managerId);
      notifyIds.delete(userId);

      for (const uid of notifyIds) {
        const u = await storage.getAdminUser(uid);
        notifyUser({
          userId: uid,
          type: "hird_responded",
          title: "Requester responded",
          message: `${actorName} responded to ${request.requestNumber}`,
          link: `/admin/help-desk/${request.id}`,
          email: u?.email ? {
            to: u.email,
            firstName: u.firstName || "there",
            event: "responded",
            requestNumber: request.requestNumber,
            requestTitle: request.title,
            requestType: request.type,
            emailMessage: `${actorName} replied: "${body.trim().substring(0, 200)}${body.trim().length > 200 ? "..." : ""}"`,
            portalUrl: `${baseUrl(req)}/admin/help-desk/${request.id}`,
          } : undefined,
        });
      }

      return res.json(updated);
    } catch (err: any) {
      console.error("HIRD respond error:", err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/help-desk/resolvers — resolver roles only (those who work tickets)
  app.get("/api/help-desk/resolvers", requireAuth, async (req: Request, res: Response) => {
    try {
      const role = req.session.role || "employee";
      if (!RESOLVER_ROLES.includes(role) && role !== "manager") return res.status(403).json({ message: "Forbidden" });
      const users = await storage.getAdminUsers();
      const resolvers = users.filter(u => RESOLVER_ROLES.includes(u.role || ""));
      return res.json(resolvers.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role })));
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
}
