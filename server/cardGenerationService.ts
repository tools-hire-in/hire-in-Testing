// ---------------------------------------------------------------------------
// Content Studio — Social Card render service (Task #432)
// Rasterises the pre-coded HTML templates (Task #435) into platform PNG cards
// via headless Chromium (puppeteer-core), uploads them to object storage, and
// records the public URLs on the article.
// ---------------------------------------------------------------------------
import { execSync } from "child_process";
import puppeteer, { type Browser } from "puppeteer-core";
import { storage } from "./storage";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import {
  resolveCardLayout,
  cardVariantsForLayout,
  buildCardVariables,
  renderCardTemplate,
  type CardLayout,
  type CardPlatform,
} from "@shared/socialCards";

const objectStorageService = new ObjectStorageService();

// ---- Chromium resolution -------------------------------------------------
let cachedExecutablePath: string | null = null;
function resolveChromiumPath(): string {
  if (cachedExecutablePath) return cachedExecutablePath;
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) {
    cachedExecutablePath = fromEnv;
    return fromEnv;
  }
  try {
    const found = execSync("which chromium", { encoding: "utf8" }).trim();
    if (found) {
      cachedExecutablePath = found;
      return found;
    }
  } catch {
    // fall through
  }
  throw new Error(
    "Chromium executable not found. Set PUPPETEER_EXECUTABLE_PATH or install the `chromium` system package.",
  );
}

// ---- Shared browser lifecycle -------------------------------------------
let browserPromise: Promise<Browser> | null = null;
async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.connected) return b;
    } catch {
      // recreate below
    }
  }
  browserPromise = puppeteer.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const b = await browserPromise;
    await b.close();
  } catch {
    // ignore
  }
  browserPromise = null;
}

// ---- PDF renderer -------------------------------------------------------
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle0" as any, timeout: 30000 });
    try {
      await page.evaluate(() => (document as any).fonts?.ready);
    } catch {
      // ignore
    }
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

// ---- Core rasteriser (shared by preview + generation) -------------------
export async function renderHtmlToPng(
  html: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" as any, timeout: 30000 });
    // Best-effort: wait for embedded webfonts to finish loading.
    try {
      await page.evaluate(() => (document as any).fonts?.ready);
    } catch {
      // ignore
    }
    const buffer = (await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width, height },
    })) as Buffer;
    return buffer;
  } finally {
    await page.close();
  }
}

// Render a single template variant to PNG using sample/real variables.
export async function renderTemplateToPng(
  template: { html: string; width: number; height: number },
  vars: Record<string, any>,
): Promise<Buffer> {
  const filled = renderCardTemplate(template.html, vars as any);
  return renderHtmlToPng(filled, template.width, template.height);
}

// ---- Public path helpers -------------------------------------------------
function cardObjectPath(articleId: string, layout: string, platform: string): string {
  return `studio/social-cards/${articleId}/${layout}-${platform}.png`;
}
function cardPublicUrl(articleId: string, layout: string, platform: string): string {
  // Served by the object-storage GET /objects/{*objectPath} route.
  return `/objects/${cardObjectPath(articleId, layout, platform)}`;
}

export interface GeneratedCard {
  layout: CardLayout;
  platform: CardPlatform;
  url: string;
  width: number;
  height: number;
}

export interface GenerateArticleCardsResult {
  articleId: string;
  layout: CardLayout;
  family: string;
  cards: GeneratedCard[];
  skipped: Array<{ platform: string; reason: string }>;
}

// ---------------------------------------------------------------------------
// Generate (or regenerate) every social card for an article and persist the
// resulting URLs on socialCardsJsonb.
// ---------------------------------------------------------------------------
export async function generateArticleCards(
  articleId: string,
  options: { layoutOverride?: string | null } = {},
): Promise<GenerateArticleCardsResult> {
  const article = await storage.getStudioArticle(articleId);
  if (!article) throw new Error(`Article ${articleId} not found`);

  const project = article.projectId
    ? await storage.getStudioProject(article.projectId)
    : undefined;
  const author = article.authorProfileId
    ? await storage.getStudioAuthorProfile(article.authorProfileId)
    : undefined;
  const brand = await storage.getStudioBrandSettings();

  const family = project?.activeTemplateFamily || "hirein-v1";
  const layout = resolveCardLayout(
    article.contentType,
    options.layoutOverride ?? article.cardLayout,
  );

  const variants = cardVariantsForLayout(layout);
  const cards: GeneratedCard[] = [];
  const skipped: Array<{ platform: string; reason: string }> = [];

  for (const { platform } of variants) {
    const template = await storage.getCardTemplateFor(
      family,
      layout,
      platform,
      project?.id ?? null,
    );
    if (!template) {
      skipped.push({ platform, reason: "no active template for variant" });
      continue;
    }
    try {
      const vars = buildCardVariables(
        {
          article: {
            title: article.title,
            excerpt: article.excerpt,
            category: article.category,
            contentType: article.contentType,
            publishedAt: article.publishedAt ?? article.approvedAt ?? null,
            socialKit: (article as any).socialKitJsonb,
            keyTakeaways: ((article as any).socialKitJsonb?.key_takeaways) ?? null,
          },
          project: project
            ? {
                brandColor: project.brandColor,
                logoUrl: project.logoUrl,
                footerUrl: project.footerUrl,
              }
            : null,
          author: author
            ? {
                displayName: author.displayName,
                title: author.title,
                photoUrl: author.photoUrl,
              }
            : null,
          brand: brand
            ? { navy: brand.navy, orangeAccent: brand.orangeAccent, logoUrl: brand.logoUrl }
            : null,
        },
        layout,
        platform,
      );
      const png = await renderTemplateToPng(
        { html: template.html, width: template.width, height: template.height },
        vars,
      );
      await objectStorageService.uploadBuffer(
        png,
        cardObjectPath(articleId, layout, platform),
        "image/png",
      );
      cards.push({
        layout,
        platform,
        url: cardPublicUrl(articleId, layout, platform),
        width: template.width,
        height: template.height,
      });
    } catch (err: any) {
      skipped.push({ platform, reason: err?.message ?? "render failed" });
    }
  }

  const payload = {
    layout,
    family,
    generatedAt: new Date().toISOString(),
    cards,
  };
  await storage.updateStudioArticle(articleId, {
    socialCardsJsonb: payload as any,
  });

  return { articleId, layout, family, cards, skipped };
}
