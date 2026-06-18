---
name: Object storage route auth
description: Why /objects/* and /api/uploads/request-url are login-gated, and the public-author-photo consequence
---

# Object storage route authentication

The Replit `javascript_object_storage` integration ships `routes.ts` with BOTH
routes UNAUTHENTICATED by default (they are "example" routes). In this app
`GET /objects/{*objectPath}` serves files straight from `PRIVATE_OBJECT_DIR`
and `downloadObject` reads the ACL policy only to set a Cache-Control header —
it does NOT enforce it. So both routes were anonymous-accessible.

Both routes now require `requireAuth` (server/replit_integrations/object_storage/routes.ts).

**Why:** anonymous users could mint presigned upload URLs (abuse/cost) and read
any private object (incl. employee documents from MyDocuments) if they had the
path. User explicitly approved locking it down over keeping public photos.

**How to apply:**
- Public Insights pages (InsightArticle/InsightAuthor/InsightAuthors) render
  author `photoUrl` via `/objects/*`. Now that the route is login-gated, logged-out
  visitors get 401 → the `<AvatarFallback>` initials show instead of a photo.
  This is INTENTIONAL — do not "fix" it by re-opening `/objects/*`.
- To make author photos publicly visible, add a SEPARATE public-serving path
  (public prefix/bucket + public ACL via objectAcl.ts), not a re-opened private route.
- Residual gap (still open): `/objects/*` has no per-object authorization, so any
  authenticated user can fetch any object whose path they obtain. Add owner/
  project/role ACL checks when implementing the public/private split.
