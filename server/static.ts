import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function isEmployeeSubdomain(hostname: string): boolean {
  return hostname.startsWith("employee.") || hostname.startsWith("www.employee.");
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
    const indexPath = path.resolve(distPath, "index.html");
    let html = fs.readFileSync(indexPath, "utf-8");
    const hostname = (req.headers["x-forwarded-host"] as string)?.split(":")[0] || req.hostname || req.headers.host?.split(":")[0] || "";
    const isEmployee = isEmployeeSubdomain(hostname);
    html = html.replace(
      "<head>",
      `<head><script>window.__IS_EMPLOYEE_SUBDOMAIN__=${isEmployee};</script>`
    );
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
