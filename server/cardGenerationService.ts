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
  isCardLayout,
  extractStatFromText,
  firstLine,
  categoryColor,
  BRAND_DEFAULTS,
  SOCIAL_IDEA_LAYOUTS,
  LAYOUT_PLATFORMS,
  type CardLayout,
  type CardPlatform,
  type CardVariables,
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

// ---------------------------------------------------------------------------
// Social-idea creative cards (Task #915). Renders hook/quote/stat/story-frame
// options for a Social idea using the idea's captionCopy hook (first line) or
// an explicit hookText override, and persists them to
// studio_content_ideas.social_cards_jsonb. Same template resolution, render
// pipeline, and upload path as article cards — extend, never rebuild.
// ---------------------------------------------------------------------------
function ideaCardObjectPath(ideaId: string, layout: string, platform: string): string {
  return `studio/social-cards/ideas/${ideaId}/${layout}-${platform}.png`;
}
function ideaCardPublicUrl(ideaId: string, layout: string, platform: string): string {
  return `/objects/${ideaCardObjectPath(ideaId, layout, platform)}`;
}

// Map an idea's channels (e.g. ["linkedin","instagram"]) to card platforms.
function ideaChannelPlatforms(channels: unknown): CardPlatform[] | null {
  if (!Array.isArray(channels) || channels.length === 0) return null;
  const set = new Set<CardPlatform>();
  for (const raw of channels) {
    const c = String(raw).toLowerCase();
    if (c.includes("linkedin") || c.includes("facebook")) set.add("linkedin");
    if (c.includes("instagram")) {
      set.add("instagram-square");
      set.add("instagram-story");
    }
    if (c.includes("twitter") || c === "x") set.add("twitter");
    if (c.includes("story")) set.add("instagram-story");
  }
  return set.size > 0 ? Array.from(set) : null;
}

export interface GenerateIdeaCardsResult {
  ideaId: string;
  family: string;
  hookText: string;
  cards: GeneratedCard[];
  skipped: Array<{ layout: string; platform: string; reason: string }>;
}

export async function generateIdeaCards(
  ideaId: string,
  options: { hookText?: string | null; layout?: string | null } = {},
): Promise<GenerateIdeaCardsResult> {
  const idea = await storage.getStudioContentIdea(ideaId);
  if (!idea) throw new Error(`Content idea ${ideaId} not found`);

  const project = idea.projectId ? await storage.getStudioProject(idea.projectId) : undefined;
  const brand = await storage.getStudioBrandSettings();
  const family = project?.activeTemplateFamily || "hirein-v1";

  const hookText =
    (options.hookText ?? "").trim() ||
    firstLine(idea.captionCopy) ||
    idea.topic ||
    "";
  if (!hookText) throw new Error("No hook text available — add caption copy or supply hookText");

  // A single-layout regenerate is allowed; otherwise render the full option set.
  const layouts: CardLayout[] = isCardLayout(options.layout)
    ? [options.layout]
    : SOCIAL_IDEA_LAYOUTS;

  const wantedPlatforms = ideaChannelPlatforms(idea.channels);
  const brandColor = project?.brandColor || brand?.orangeAccent || BRAND_DEFAULTS.orangeAccent;
  const stat = extractStatFromText(hookText);

  const cards: GeneratedCard[] = [];
  const skipped: Array<{ layout: string; platform: string; reason: string }> = [];

  for (const layout of layouts) {
    for (const platform of LAYOUT_PLATFORMS[layout]) {
      if (wantedPlatforms && !wantedPlatforms.includes(platform)) continue;
      const template = await storage.getCardTemplateFor(
        family,
        layout,
        platform,
        project?.id ?? null,
      );
      if (!template) {
        skipped.push({ layout, platform, reason: "no active template for variant" });
        continue;
      }
      try {
        const vars: CardVariables = {
          title: hookText,
          supporting_line: idea.brief ? firstLine(idea.brief) : "",
          category: idea.pillar ?? "",
          category_color: categoryColor(idea.pillar),
          brand_color: brandColor,
          logo_url: project?.logoUrl ?? brand?.logoUrl ?? "",
          footer_url: project?.footerUrl ?? "hire-in.com/insights",
          publish_date: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        };
        if (layout === "stat" && stat) {
          vars.stat_value = stat.statValue;
          vars.stat_label = stat.statLabel;
        }
        const png = await renderTemplateToPng(
          { html: template.html, width: template.width, height: template.height },
          vars,
        );
        await objectStorageService.uploadBuffer(
          png,
          ideaCardObjectPath(ideaId, layout, platform),
          "image/png",
        );
        cards.push({
          layout,
          platform,
          url: ideaCardPublicUrl(ideaId, layout, platform),
          width: template.width,
          height: template.height,
        });
      } catch (err: any) {
        skipped.push({ layout, platform, reason: err?.message ?? "render failed" });
      }
    }
  }

  // Single-layout regenerate keeps the other layouts' existing cards.
  const existing = (idea.socialCardsJsonb as any)?.cards;
  const merged =
    isCardLayout(options.layout) && Array.isArray(existing)
      ? [
          ...existing.filter((c: any) => c?.layout !== options.layout),
          ...cards,
        ]
      : cards;

  const payload = {
    family,
    layout: isCardLayout(options.layout) ? options.layout : "social",
    hookText,
    generatedAt: new Date().toISOString(),
    cards: merged,
  };
  await storage.updateStudioContentIdea(ideaId, { socialCardsJsonb: payload as any });

  return { ideaId, family, hookText, cards, skipped };
}
