import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import http from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getStaticSchemas, getJobPostingSchema, injectSchemas } from "./seo-schemas";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Proxy /__mockup/ requests to the mockup sandbox dev server (port 23636)
  app.use("/__mockup", (req, res) => {
    const target = `http://localhost:23636/__mockup${req.url}`;
    const proxyReq = http.request(target, { method: req.method, headers: req.headers }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    proxyReq.on("error", () => res.status(502).send("Mockup sandbox unavailable"));
    req.pipe(proxyReq, { end: true });
  });

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      let page = await vite.transformIndexHtml(url, template);

      // Inject route-specific JSON-LD schemas into the initial HTML response
      const pathname = url.split("?")[0];
      const staticSchemas = getStaticSchemas(pathname);
      if (staticSchemas.length) {
        page = injectSchemas(page, staticSchemas);
      } else {
        const jobMatch = pathname.match(/^\/jobs\/([^/?#]+)$/);
        if (jobMatch) {
          const jobSchema = await getJobPostingSchema(jobMatch[1]);
          if (jobSchema) page = injectSchemas(page, [jobSchema]);
        }
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
