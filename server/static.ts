import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function isEmployeeSubdomain(hostname: string): boolean {
  return hostname.startsWith("employee.") || hostname.startsWith("www.employee.");
}

// All known exact public SPA routes
const KNOWN_PUBLIC_EXACT_ROUTES = new Set([
  "/",
  "/about",
  "/contracts",
  "/jobs",
  "/contact",
  "/terms",
  "/privacy",
  "/capability-deck",
  "/it-staffing",
  "/ehealthcare-staffing",
  "/why-hire-in-solutions",
  "/it-staffing-guide",
  "/healthcare-staffing-guide",
  "/staffing-faq",
  "/request-a-quote",
  "/verify",
  "/services/healthcare-recruitment",
  "/services/it-software",
  "/services/engineering-technical",
  "/services/non-it-professional",
  "/services/contract-staffing",
]);

// Dynamic route patterns — arbitrary segment after a known prefix (token, id, etc.)
const DYNAMIC_ROUTE_PATTERNS: RegExp[] = [
  /^\/jobs\/[^/]+$/,            // /jobs/:id
  /^\/onboard\/[^/]+$/,         // /onboard/:token
  /^\/addendum\/[^/]+$/,        // /addendum/:token
  /^\/contracts\/sign\/[^/]+$/, // /contracts/sign/:token
  /^\/admin(\/.*)?$/,           // /admin and all admin sub-routes (auth-gated; blocked by robots.txt)
];

function isKnownRoute(reqPath: string): boolean {
  const cleanPath = reqPath.split("?")[0].replace(/\/$/, "") || "/";
  if (KNOWN_PUBLIC_EXACT_ROUTES.has(cleanPath) || KNOWN_PUBLIC_EXACT_ROUTES.has(cleanPath + "/")) {
    return true;
  }
  for (const pattern of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(cleanPath)) return true;
  }
  return false;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { index: false }));

  app.use("/{*path}", (req, res) => {
    const hostname = (req.headers["x-forwarded-host"] as string)?.split(":")[0] || req.hostname || req.headers.host?.split(":")[0] || "";
    const isEmployee = isEmployeeSubdomain(hostname);
    const known = isEmployee || isKnownRoute(req.path);

    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    html = html.replace(
      "<head>",
      `<head><script>window.__IS_EMPLOYEE_SUBDOMAIN__=${isEmployee};</script>`
    );
    res.status(known ? 200 : 404).set({ "Content-Type": "text/html" }).end(html);
  });
}
