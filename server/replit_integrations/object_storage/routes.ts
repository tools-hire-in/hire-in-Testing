import type { Express, Request } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { requireAuth } from "../../auth";
import { ObjectPermission, getObjectAclPolicy } from "./objectAcl";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", requireAuth, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects with ACL-aware access control.
   *
   * GET /objects/:objectPath(*)
   *
   * Decision logic (in order):
   * 1. Public ACL (visibility "public") → serve to all visitors, no auth needed.
   *    This is the fix for public author photos on insight articles.
   * 2. No ACL policy at all → require an authenticated session (401 if not).
   *    Allows any authenticated user — preserves legacy behaviour for the
   *    large population of existing uploads (HR docs, payslips, SOP evidence,
   *    etc.) that were previously protected only by the requireAuth middleware
   *    and have no ACL metadata written yet.
   * 3. Explicit private ACL → require auth (401) then run per-user ownership /
   *    rules check via canAccessObjectEntity; return 403 if the user is not
   *    authorised. This is the full ACL enforcement path for objects that have
   *    been explicitly tagged private.
   */
  app.get("/objects/{*objectPath}", async (req: Request, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      // Fetch the raw ACL policy once to drive all three branches.
      const aclPolicy = await getObjectAclPolicy(objectFile);

      if (aclPolicy?.visibility === "public") {
        // Branch 1: explicitly public — serve to all visitors without auth.
        return await objectStorageService.downloadObject(objectFile, res);
      }

      // Branches 2 & 3 require an authenticated session.
      const userId = (req as any).session?.userId as string | undefined;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (aclPolicy) {
        // Branch 3: explicit private ACL — enforce per-user ownership / rules.
        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId,
          objectFile,
          requestedPermission: ObjectPermission.READ,
        });
        if (!canAccess) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      // Branch 2: no ACL policy — any authenticated user may read (legacy).

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

