import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Palette, Download, Copy, Check, ExternalLink, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const ORANGE_ACCENT = "#F96D3E";

const BRAND_COLORS = [
  {
    name: "Navy",
    hex: "#1F3A6E",
    oklch: "oklch(33.2% 0.096 256.7°)",
    usage: "Primary — headings, logo field, key UI",
  },
  {
    name: "Orange",
    hex: "#F47C20",
    oklch: "oklch(67.8% 0.176 49.4°)",
    usage: "Primary accent — CTAs, highlights",
  },
  {
    name: "Orange Accent",
    hex: "#F96D3E",
    oklch: "oklch(67.3% 0.188 38.1°)",
    usage: "Secondary accent — logo frame, gradients",
  },
  {
    name: "White",
    hex: "#FFFFFF",
    oklch: "oklch(100% 0 0°)",
    usage: "Logo mark, text on dark surfaces",
  },
  {
    name: "Soft Gray",
    hex: "#F2F4F7",
    oklch: "oklch(96.5% 0.007 247°)",
    usage: "Backgrounds, cards, dividers",
  },
];

const NAVY_SHADES: Array<{ stop: number; hex: string; oklch: string }> = [
  { stop: 50, hex: "#EEF1F9", oklch: "oklch(95.8% 0.018 256.7°)" },
  { stop: 100, hex: "#D5DCEF", oklch: "oklch(89.6% 0.036 256.7°)" },
  { stop: 200, hex: "#AAB8DE", oklch: "oklch(77.8% 0.060 256.7°)" },
  { stop: 300, hex: "#7F95CD", oklch: "oklch(65.8% 0.080 256.7°)" },
  { stop: 400, hex: "#5471B7", oklch: "oklch(53.6% 0.092 256.7°)" },
  { stop: 500, hex: "#2E50A0", oklch: "oklch(43.2% 0.096 256.7°)" },
  { stop: 600, hex: "#254386", oklch: "oklch(38.0% 0.096 256.7°)" },
  { stop: 700, hex: "#1F3A6E", oklch: "oklch(33.2% 0.096 256.7°)" },
  { stop: 800, hex: "#172A50", oklch: "oklch(24.4% 0.086 256.7°)" },
  { stop: 900, hex: "#0E1A33", oklch: "oklch(15.8% 0.066 256.7°)" },
];

const ORANGE_SHADES: Array<{ stop: number; hex: string; oklch: string }> = [
  { stop: 50, hex: "#FEF3E7", oklch: "oklch(96.5% 0.030 49.4°)" },
  { stop: 100, hex: "#FCDDB9", oklch: "oklch(90.4% 0.065 49.4°)" },
  { stop: 200, hex: "#FAC282", oklch: "oklch(82.6% 0.110 49.4°)" },
  { stop: 300, hex: "#F8A74B", oklch: "oklch(75.0% 0.146 49.4°)" },
  { stop: 400, hex: "#F69233", oklch: "oklch(71.6% 0.165 49.4°)" },
  { stop: 500, hex: "#F47C20", oklch: "oklch(67.8% 0.176 49.4°)" },
  { stop: 600, hex: "#D96514", oklch: "oklch(60.2% 0.170 49.4°)" },
  { stop: 700, hex: "#B8500E", oklch: "oklch(51.0% 0.158 49.4°)" },
  { stop: 800, hex: "#8F3C09", oklch: "oklch(39.4% 0.136 49.4°)" },
  { stop: 900, hex: "#5E2604", oklch: "oklch(26.0% 0.104 49.4°)" },
];

interface ContrastEntry {
  fg: string;
  fgName: string;
  bg: string;
  bgName: string;
  ratio: string;
  normalAA: boolean;
  largeAA: boolean;
}

const CONTRAST_PAIRS: ContrastEntry[] = [
  { fg: NAVY, fgName: "Navy", bg: "#FFFFFF", bgName: "White", ratio: "9.73:1", normalAA: true, largeAA: true },
  { fg: ORANGE, fgName: "Orange", bg: "#FFFFFF", bgName: "White", ratio: "2.60:1", normalAA: false, largeAA: false },
  { fg: ORANGE_ACCENT, fgName: "Orange Accent", bg: "#FFFFFF", bgName: "White", ratio: "2.76:1", normalAA: false, largeAA: false },
  { fg: "#FFFFFF", fgName: "White", bg: NAVY, bgName: "Navy", ratio: "9.73:1", normalAA: true, largeAA: true },
  { fg: "#FFFFFF", fgName: "White", bg: ORANGE, bgName: "Orange", ratio: "2.60:1", normalAA: false, largeAA: false },
  { fg: NAVY, fgName: "Navy", bg: "#F2F4F7", bgName: "Soft Gray", ratio: "8.62:1", normalAA: true, largeAA: true },
  { fg: ORANGE, fgName: "Orange", bg: NAVY, bgName: "Navy", ratio: "3.74:1", normalAA: false, largeAA: true },
];

const DARK_PALETTE = [
  { name: "Dark Surface", hex: "#0F1826", oklch: "oklch(15.2% 0.028 256.7°)", usage: "App background in dark mode" },
  { name: "Dark Card", hex: "#172236", oklch: "oklch(19.8% 0.042 256.7°)", usage: "Card backgrounds" },
  { name: "Navy Muted", hex: "#2D4B7A", oklch: "oklch(36.4% 0.072 256.7°)", usage: "Subtle brand hue, desaturated" },
  { name: "Orange Dim", hex: "#C96810", oklch: "oklch(58.5% 0.148 49.4°)", usage: "Orange on dark — reduced brightness" },
  { name: "Text Dim", hex: "#94A3B8", oklch: "oklch(70.8% 0.022 247°)", usage: "Secondary text on dark backgrounds" },
];

const BRAND_LOGOS = [
  {
    label: "Full Logo (SVG)",
    file: "/brand/hirein-logo.svg",
    download: "hirein-logo.svg",
    note: "Vector — scales to any size. Navy field with orange frame.",
  },
  {
    label: "Monogram — Transparent (SVG)",
    file: "/brand/hirein-logo-mark.svg",
    download: "hirein-logo-mark.svg",
    note: "Vector — navy mark on transparent background. For light surfaces.",
  },
  {
    label: "Original Logo (JPG)",
    file: "/brand/hirein-logo-original.jpg",
    download: "hirein-logo-original.jpg",
    note: "Raster 1024×1024 — for emails and tools that don't support SVG.",
  },
];

const CSS_TOKENS = `/* Hire'in Solutions — Brand Tokens (OKLCH) */
:root {
  /* Core brand */
  --color-navy:           oklch(33.2% 0.096 256.7);
  --color-orange:         oklch(67.8% 0.176 49.4);
  --color-orange-accent:  oklch(67.3% 0.188 38.1);
  --color-white:          oklch(100% 0 0);
  --color-soft-gray:      oklch(96.5% 0.007 247);

  /* Navy shade ramp */
  --color-navy-50:   oklch(95.8% 0.018 256.7);
  --color-navy-100:  oklch(89.6% 0.036 256.7);
  --color-navy-200:  oklch(77.8% 0.060 256.7);
  --color-navy-300:  oklch(65.8% 0.080 256.7);
  --color-navy-400:  oklch(53.6% 0.092 256.7);
  --color-navy-500:  oklch(43.2% 0.096 256.7);
  --color-navy-600:  oklch(38.0% 0.096 256.7);
  --color-navy-700:  oklch(33.2% 0.096 256.7); /* brand */
  --color-navy-800:  oklch(24.4% 0.086 256.7);
  --color-navy-900:  oklch(15.8% 0.066 256.7);

  /* Orange shade ramp */
  --color-orange-50:   oklch(96.5% 0.030 49.4);
  --color-orange-100:  oklch(90.4% 0.065 49.4);
  --color-orange-200:  oklch(82.6% 0.110 49.4);
  --color-orange-300:  oklch(75.0% 0.146 49.4);
  --color-orange-400:  oklch(71.6% 0.165 49.4);
  --color-orange-500:  oklch(67.8% 0.176 49.4); /* brand */
  --color-orange-600:  oklch(60.2% 0.170 49.4);
  --color-orange-700:  oklch(51.0% 0.158 49.4);
  --color-orange-800:  oklch(39.4% 0.136 49.4);
  --color-orange-900:  oklch(26.0% 0.104 49.4);

  /* Category colours */
  --color-cat-healthcare: oklch(59.5% 0.118 182.4);
  --color-cat-it:         oklch(50.8% 0.194 264.0);
  --color-cat-engineering:oklch(44.0% 0.192 305.3);
  --color-cat-pro-svcs:   oklch(67.8% 0.176 49.4);
}`;

const TAILWIND_TOKENS = `// tailwind.config.ts — extend.colors block
colors: {
  navy: {
    DEFAULT: "#1F3A6E",
    50:  "#EEF1F9",
    100: "#D5DCEF",
    200: "#AAB8DE",
    300: "#7F95CD",
    400: "#5471B7",
    500: "#2E50A0",
    600: "#254386",
    700: "#1F3A6E",
    800: "#172A50",
    900: "#0E1A33",
  },
  orange: {
    DEFAULT: "#F47C20",
    50:  "#FEF3E7",
    100: "#FCDDB9",
    200: "#FAC282",
    300: "#F8A74B",
    400: "#F69233",
    500: "#F47C20",
    600: "#D96514",
    700: "#B8500E",
    800: "#8F3C09",
    900: "#5E2604",
  },
  "orange-accent": "#F96D3E",
  "soft-gray":     "#F2F4F7",
  category: {
    healthcare: "#0E9F8E",
    it:         "#2563EB",
    engineering:"#7C3AED",
    "pro-svcs": "#F47C20",
  },
},`;

export default function BrandKit() {
  const { toast } = useToast();
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [svgCache, setSvgCache] = useState<Record<string, string>>({});

  useEffect(() => {
    const svgFiles = ["/brand/hirein-logo.svg", "/brand/hirein-logo-mark.svg"];
    svgFiles.forEach(async (url) => {
      try {
        const res = await fetch(url);
        const text = await res.text();
        setSvgCache((prev) => ({ ...prev, [url]: text }));
      } catch {
        /* silent */
      }
    });
  }, []);

  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
      toast({ title: `Copied ${hex}` });
    } catch {
      toast({ title: "Couldn't copy — select it manually", variant: "destructive" });
    }
  };

  const copyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(key);
      setTimeout(() => setCopiedSection(null), 2000);
      toast({ title: `Copied ${label}` });
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-brand-kit-title">
            Brand Kit
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Official logo files, colors, typography, tokens, and guidelines for the marketing and design team.
          </p>
        </div>

        {/* ── Logo Files ────────────────────────────────────────────────── */}
        <Card data-testid="card-brand-logos">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Logo Files
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              SVG is preferred for print, decks, and web — it scales perfectly at any size.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {BRAND_LOGOS.map((logo) => (
                <div
                  key={logo.download}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`card-brand-logo-${logo.download}`}
                >
                  {/* Checkerboard preview */}
                  <div
                    className="h-32 flex items-center justify-center p-4"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%)",
                      backgroundSize: "16px 16px",
                      backgroundPosition: "0 0, 8px 8px",
                    }}
                  >
                    <img
                      src={logo.file}
                      alt={logo.label}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  {/* Dark background preview */}
                  <div
                    className="h-20 flex items-center justify-center p-4"
                    style={{ background: NAVY }}
                  >
                    <img
                      src={logo.file}
                      alt={`${logo.label} on dark`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  {/* 32px favicon size test */}
                  {logo.file.endsWith(".svg") && (
                    <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/30">
                      <span className="text-[10px] text-muted-foreground">32px:</span>
                      <img
                        src={logo.file}
                        alt="32px test"
                        style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
                      />
                      <span className="text-[10px] text-muted-foreground">16px:</span>
                      <img
                        src={logo.file}
                        alt="16px test"
                        style={{ width: 16, height: 16, objectFit: "contain", flexShrink: 0 }}
                      />
                    </div>
                  )}
                  <div className="p-3 space-y-2 border-t">
                    <p className="text-sm font-medium">{logo.label}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{logo.note}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        asChild
                        data-testid={`button-download-${logo.download}`}
                      >
                        <a href={logo.file} download={logo.download}>
                          <Download className="h-3.5 w-3.5 mr-1.5" />
                          Download
                        </a>
                      </Button>
                      {logo.file.endsWith(".svg") && svgCache[logo.file] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyText(svgCache[logo.file], logo.file, "SVG source")}
                          data-testid={`button-copy-svg-${logo.download}`}
                        >
                          {copiedSection === logo.file ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Brand Colors ───────────────────────────────────────────────── */}
        <Card data-testid="card-brand-colors">
          <CardHeader>
            <CardTitle className="text-base">Brand Colors</CardTitle>
            <p className="text-xs text-muted-foreground">
              Click any swatch to copy its hex code. OKLCH values shown for modern CSS workflows.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {BRAND_COLORS.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => copyHex(c.hex)}
                  className="flex items-center gap-3 border rounded-lg p-3 text-left transition-shadow hover:shadow-md active:scale-[0.98]"
                  data-testid={`button-brand-color-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span
                    className="h-12 w-12 rounded-md border flex-shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {c.name}
                      {copiedHex === c.hex ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">{c.hex}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground/70 truncate">{c.oklch}</span>
                    <span className="block text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                      {c.usage}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Shade Ramps */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Navy Shade Ramp (50–900)
              </p>
              <div className="flex rounded-lg overflow-hidden border">
                {NAVY_SHADES.map(({ stop, hex, oklch }) => (
                  <button
                    key={stop}
                    type="button"
                    title={`${hex} — ${oklch}`}
                    onClick={() => copyHex(hex)}
                    className="flex-1 group relative"
                    style={{ background: hex }}
                    data-testid={`button-navy-shade-${stop}`}
                  >
                    <div className="h-14 w-full" />
                    <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex flex-col items-center pb-1">
                      <span
                        className="text-[9px] font-bold leading-tight"
                        style={{ color: stop >= 500 ? "#fff" : "#1F3A6E" }}
                      >
                        {stop}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                {NAVY_SHADES.map(({ stop }) => (
                  <span key={stop} className="flex-1 text-center">{stop}</span>
                ))}
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Orange Shade Ramp (50–900)
              </p>
              <div className="flex rounded-lg overflow-hidden border">
                {ORANGE_SHADES.map(({ stop, hex, oklch }) => (
                  <button
                    key={stop}
                    type="button"
                    title={`${hex} — ${oklch}`}
                    onClick={() => copyHex(hex)}
                    className="flex-1 group relative"
                    style={{ background: hex }}
                    data-testid={`button-orange-shade-${stop}`}
                  >
                    <div className="h-14 w-full" />
                    <div className="absolute inset-x-0 bottom-0 hidden group-hover:flex flex-col items-center pb-1">
                      <span
                        className="text-[9px] font-bold leading-tight"
                        style={{ color: stop >= 600 ? "#fff" : "#5E2604" }}
                      >
                        {stop}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                {ORANGE_SHADES.map(({ stop }) => (
                  <span key={stop} className="flex-1 text-center">{stop}</span>
                ))}
              </div>
            </div>

            {/* WCAG Contrast Audit */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                WCAG AA Contrast Audit
              </p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs" data-testid="table-contrast-audit">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 font-semibold">Pair</th>
                      <th className="text-right px-3 py-2 font-semibold">Ratio</th>
                      <th className="text-center px-3 py-2 font-semibold">Normal text (4.5:1)</th>
                      <th className="text-center px-3 py-2 font-semibold">Large text (3:1)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CONTRAST_PAIRS.map((pair, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-4 h-4 rounded border text-[8px] font-bold flex items-center justify-center flex-shrink-0"
                              style={{ background: pair.bg, color: pair.fg, border: `1px solid ${pair.fg}22` }}
                            >
                              Aa
                            </span>
                            <span className="text-muted-foreground">
                              {pair.fgName} on {pair.bgName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{pair.ratio}</td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant={pair.normalAA ? "default" : "destructive"}
                            className={`text-[10px] px-1.5 py-0 ${pair.normalAA ? "bg-green-600 hover:bg-green-600" : ""}`}
                          >
                            {pair.normalAA ? "PASS" : "FAIL"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant={pair.largeAA ? "default" : "destructive"}
                            className={`text-[10px] px-1.5 py-0 ${pair.largeAA ? "bg-green-600 hover:bg-green-600" : ""}`}
                          >
                            {pair.largeAA ? "PASS" : "FAIL"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                ⚠ Orange (#F47C20) does not meet AA for normal-weight body text on white. Reserve it for large headings (≥18 pt / ≥14 pt bold) or as a decorative accent — never for body-weight text on white.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Dark Mode Palette ──────────────────────────────────────────── */}
        <Card data-testid="card-brand-dark-palette">
          <CardHeader>
            <CardTitle className="text-base">Dark Mode Palette</CardTitle>
            <p className="text-xs text-muted-foreground">
              Brand colours adapted for dark surfaces — reduced brightness, desaturated slightly. Shown in context.
            </p>
          </CardHeader>
          <CardContent>
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: "#0F1826" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#94A3B8" }}
              >
                Dark Mode Preview
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DARK_PALETTE.map((c) => (
                  <button
                    type="button"
                    key={c.hex}
                    onClick={() => copyHex(c.hex)}
                    className="flex items-center gap-3 rounded-lg p-3 text-left transition-opacity hover:opacity-80 active:scale-[0.98]"
                    style={{ background: "#172236", border: "1px solid #2D4B7A33" }}
                    data-testid={`button-dark-color-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span
                      className="h-10 w-10 rounded-md flex-shrink-0"
                      style={{ backgroundColor: c.hex, border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold" style={{ color: "#E2E8F0" }}>
                        {c.name}
                      </span>
                      <span className="block font-mono text-xs" style={{ color: "#64748B" }}>
                        {c.hex}
                      </span>
                      <span className="block text-[10px] font-mono truncate" style={{ color: "#475569" }}>
                        {c.oklch}
                      </span>
                      <span className="block text-[11px] truncate mt-0.5" style={{ color: "#64748B" }}>
                        {c.usage}
                      </span>
                    </span>
                    {copiedHex === c.hex && <Check className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#4ADE80" }} />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Typography ────────────────────────────────────────────────── */}
        <Card data-testid="card-brand-typography">
          <CardHeader>
            <CardTitle className="text-base">Typography</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fonts used across all Hire'in brand materials — decks, social cards, and documents.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 space-y-2" data-testid="card-brand-font-heading">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Headings — Playfair Display</p>
                <p className="text-3xl font-semibold leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Playfair Display
                </p>
                <p className="text-xs text-muted-foreground">
                  Serif — hero titles, deck headings, document headlines, offer letters.
                </p>
                <div className="border-t pt-3 mt-2 space-y-1.5" style={{ fontFamily: "'Playfair Display', serif" }}>
                  <p className="text-2xl font-bold leading-tight" style={{ color: NAVY }}>H1 — 2.25 rem / Bold 700</p>
                  <p className="text-xl font-bold leading-tight" style={{ color: NAVY }}>H2 — 1.875 rem / Bold 700</p>
                  <p className="text-lg font-semibold" style={{ color: NAVY }}>H3 — 1.5 rem / Semibold 600</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-2" data-testid="card-brand-font-body">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Body & UI — Inter</p>
                <p className="text-3xl font-semibold leading-tight" style={{ fontFamily: "Inter, sans-serif" }}>
                  Inter
                </p>
                <p className="text-xs text-muted-foreground">
                  Sans-serif — body copy, UI elements, forms, captions, and documents.
                </p>
                <div className="border-t pt-3 mt-2 space-y-1.5" style={{ fontFamily: "Inter, sans-serif" }}>
                  <p className="text-base font-semibold">H4 — 1 rem / Semibold 600 / lh 1.4</p>
                  <p className="text-sm">Body — 0.875 rem / Regular 400 / lh 1.6</p>
                  <p className="text-xs text-muted-foreground">Caption — 0.75 rem / Medium 500 / lh 1.5</p>
                </div>
              </div>
            </div>

            {/* Typography hierarchy table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs" data-testid="table-typography-hierarchy">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold">Element</th>
                    <th className="text-left px-3 py-2 font-semibold">Font</th>
                    <th className="text-left px-3 py-2 font-semibold">Size</th>
                    <th className="text-left px-3 py-2 font-semibold">Weight</th>
                    <th className="text-left px-3 py-2 font-semibold">Line Height</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { el: "H1 (Hero)", font: "Playfair Display", size: "2.25–3rem", weight: "700 Bold", lh: "1.1" },
                    { el: "H2 (Section)", font: "Playfair Display", size: "1.875–2.25rem", weight: "700 Bold", lh: "1.2" },
                    { el: "H3 (Card title)", font: "Playfair Display", size: "1.375–1.5rem", weight: "600 Semibold", lh: "1.3" },
                    { el: "H4 (Subsection)", font: "Inter", size: "1rem–1.125rem", weight: "600 Semibold", lh: "1.4" },
                    { el: "Body", font: "Inter", size: "0.875rem–1rem", weight: "400 Regular", lh: "1.6 relaxed" },
                    { el: "Caption / Label", font: "Inter", size: "0.75rem", weight: "500 Medium", lh: "1.5" },
                  ].map((row) => (
                    <tr key={row.el} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{row.el}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.font}</td>
                      <td className="px-3 py-2 font-mono">{row.size}</td>
                      <td className="px-3 py-2">{row.weight}</td>
                      <td className="px-3 py-2 font-mono">{row.lh}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Design Tokens ─────────────────────────────────────────────── */}
        <Card data-testid="card-brand-tokens">
          <CardHeader>
            <CardTitle className="text-base">Design Tokens</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ready-to-paste CSS custom properties and Tailwind config for all brand and category colours.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="css">
              <TabsList>
                <TabsTrigger value="css" data-testid="tab-tokens-css">CSS Custom Properties</TabsTrigger>
                <TabsTrigger value="tailwind" data-testid="tab-tokens-tailwind">Tailwind Config</TabsTrigger>
              </TabsList>
              <TabsContent value="css" className="mt-3">
                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => copyText(CSS_TOKENS, "css-tokens", "CSS tokens")}
                    data-testid="button-copy-css-tokens"
                  >
                    {copiedSection === "css-tokens" ? (
                      <><Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>
                    )}
                  </Button>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto pr-24 leading-relaxed">
                    {CSS_TOKENS}
                  </pre>
                </div>
              </TabsContent>
              <TabsContent value="tailwind" className="mt-3">
                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2 z-10"
                    onClick={() => copyText(TAILWIND_TOKENS, "tailwind-tokens", "Tailwind config")}
                    data-testid="button-copy-tailwind-tokens"
                  >
                    {copiedSection === "tailwind-tokens" ? (
                      <><Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</>
                    )}
                  </Button>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto pr-24 leading-relaxed">
                    {TAILWIND_TOKENS}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Brand Guidelines ──────────────────────────────────────────── */}
        <Card data-testid="card-brand-guidelines">
          <CardHeader>
            <CardTitle className="text-base">Brand Guidelines</CardTitle>
            <p className="text-xs text-muted-foreground">
              How to use the Hire'in brand correctly — colour, type, voice, and accessibility.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Colour do's / don'ts */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Colour Do's &amp; Don'ts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-green-200 bg-green-50 rounded-lg p-3 space-y-1.5 text-sm dark:bg-green-950/20 dark:border-green-900">
                  <p className="font-semibold text-green-700 dark:text-green-400 text-xs uppercase tracking-wider">✓ Do</p>
                  <ul className="space-y-1 text-muted-foreground list-disc list-inside text-xs">
                    <li>Use <strong>Navy #1F3A6E</strong> for all primary headings and hero backgrounds.</li>
                    <li>Use <strong>Orange #F47C20</strong> for one primary CTA per view.</li>
                    <li>Use <strong>white text</strong> on Navy or Orange backgrounds (contrast ≥ 4.5:1).</li>
                    <li>Use Orange for large display text (≥ 18 pt or bold ≥ 14 pt) only.</li>
                    <li>Keep clear space around the logo equal to at least the height of the dot above the "i".</li>
                  </ul>
                </div>
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-1.5 text-sm dark:bg-red-950/20 dark:border-red-900">
                  <p className="font-semibold text-red-700 dark:text-red-400 text-xs uppercase tracking-wider">✗ Don't</p>
                  <ul className="space-y-1 text-muted-foreground list-disc list-inside text-xs">
                    <li>Don't use Orange (#F47C20) for normal body-weight text on white — it fails WCAG AA.</li>
                    <li>Don't place the logo on busy photographic backgrounds without a clear field.</li>
                    <li>Don't recolour, rotate, or distort the logo or monogram.</li>
                    <li>Don't use more than two brand accent colours on a single surface.</li>
                    <li>Don't use the JPG logo where SVG is supported — it degrades at scale.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Voice & Tone */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Voice &amp; Tone</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hire'in Solutions sounds <strong>warm, direct, and confident</strong> — never salesy or corporate. We speak to both candidates and employers with clarity and respect. Headlines use action-oriented language; body copy is concise and evidence-based. Avoid jargon; explain industry terms on first use.
              </p>
              <div className="mt-2">
                <Link href="/admin/studio/brand-voice">
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" data-testid="link-brand-voice">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Edit brand voice settings
                  </Button>
                </Link>
              </div>
            </div>

            {/* Accessibility Standards */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Accessibility Standards</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { label: "Minimum font size", value: "12 px (body copy), 11 px (labels/captions)" },
                  { label: "Touch targets", value: "Minimum 44 × 44 px for all interactive elements" },
                  { label: "Colour contrast (body text)", value: "≥ 4.5:1 against background (WCAG AA)" },
                  { label: "Colour contrast (large text)", value: "≥ 3:1 against background (WCAG AA Large)" },
                  { label: "Icon clarity", value: "All icons ≥ 24 × 24 px; paired with text label or ARIA label" },
                  { label: "Motion sensitivity", value: "Respect prefers-reduced-motion — no auto-play or essential animations" },
                  { label: "Focus indicators", value: "Visible, high-contrast focus ring on all interactive elements" },
                  { label: "Alt text", value: "All non-decorative images require descriptive alt text" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-2 text-xs">
                    <span className="font-semibold text-foreground whitespace-nowrap min-w-[130px]">{label}:</span>
                    <span className="text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Asset Package ─────────────────────────────────────────────── */}
        <Card data-testid="card-brand-assets">
          <CardHeader>
            <CardTitle className="text-base">Asset Package</CardTitle>
            <p className="text-xs text-muted-foreground">
              Download all official brand files bundled into a single ZIP — includes SVG logos, monogram, and the original JPG.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border rounded-lg bg-muted/30">
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">hirein-brand-assets.zip</p>
                <p className="text-xs text-muted-foreground">
                  Contains: hirein-logo.svg · hirein-logo-mark.svg · hirein-logo-original.jpg
                </p>
              </div>
              <Button
                asChild
                data-testid="button-download-brand-zip"
              >
                <a href="/api/brand/assets.zip" download="hirein-brand-assets.zip">
                  <Download className="h-4 w-4 mr-2" />
                  Download Asset Package
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Brand in Action ───────────────────────────────────────────── */}
        <Card data-testid="card-brand-in-action">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Brand in Action
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              The brand applied to realistic product surfaces: job listing card, social hook card, dashboard header, and offer letter header.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <iframe
              src="/__mockup/preview/brand-in-action/BrandInAction"
              className="w-full rounded-b-xl border-0"
              style={{ height: 620, background: "#F2F4F7" }}
              title="Brand in Action canvas"
              data-testid="iframe-brand-in-action"
            />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
