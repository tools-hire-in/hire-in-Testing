import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, Download, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BRAND_COLORS = [
  { name: "Navy", hex: "#1F3A6E", usage: "Primary — headings, logo field, key UI" },
  { name: "Orange", hex: "#F47C20", usage: "Primary accent — CTAs, highlights" },
  { name: "Orange Accent", hex: "#F96D3E", usage: "Secondary accent — logo frame, gradients" },
  { name: "White", hex: "#FFFFFF", usage: "Logo mark, text on dark surfaces" },
  { name: "Soft Gray", hex: "#F2F4F7", usage: "Backgrounds, cards, dividers" },
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

export default function BrandKit() {
  const { toast } = useToast();
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

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

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-brand-kit-title">
            Brand Kit
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Official logo files, colors, and typography for the marketing and design team.
          </p>
        </div>

        {/* Logo Files */}
        <Card data-testid="card-brand-logos">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Logo Files
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Download the format you need. SVG is preferred for print, decks, and web — it scales perfectly at any size.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {BRAND_LOGOS.map((logo) => (
                <div
                  key={logo.download}
                  className="border rounded-lg overflow-hidden"
                  data-testid={`card-brand-logo-${logo.download}`}
                >
                  <div
                    className="h-40 flex items-center justify-center p-6"
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
                  <div className="p-3 space-y-2 border-t">
                    <p className="text-sm font-medium">{logo.label}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{logo.note}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      asChild
                      data-testid={`button-download-${logo.download}`}
                    >
                      <a href={logo.file} download={logo.download}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card data-testid="card-brand-colors">
          <CardHeader>
            <CardTitle className="text-base">Brand Colors</CardTitle>
            <p className="text-xs text-muted-foreground">
              Click any swatch to copy its hex code to your clipboard.
            </p>
          </CardHeader>
          <CardContent>
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
                    <span className="block text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                      {c.usage}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card data-testid="card-brand-typography">
          <CardHeader>
            <CardTitle className="text-base">Typography</CardTitle>
            <p className="text-xs text-muted-foreground">
              Fonts used across all Hire'in brand materials — decks, social cards, and documents.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4 space-y-2" data-testid="card-brand-font-heading">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Headings</Label>
                <p
                  className="text-3xl font-semibold leading-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Playfair Display
                </p>
                <p className="text-xs text-muted-foreground">
                  Serif — used for hero titles, deck headings, and social card headlines.
                </p>
                <div
                  className="text-base leading-relaxed border-t pt-3 mt-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Aa Bb Cc — Smart Solutions. Stronger Teams.
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-2" data-testid="card-brand-font-body">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Body</Label>
                <p className="text-3xl font-semibold leading-tight" style={{ fontFamily: "Inter, sans-serif" }}>
                  Inter
                </p>
                <p className="text-xs text-muted-foreground">
                  Sans-serif — used for body copy, UI elements, forms, and documents.
                </p>
                <div className="text-base leading-relaxed border-t pt-3 mt-2" style={{ fontFamily: "Inter, sans-serif" }}>
                  Aa Bb Cc — Hire'in Solutions · Healthcare · IT · Engineering
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage guidelines */}
        <Card data-testid="card-brand-guidelines">
          <CardHeader>
            <CardTitle className="text-base">Quick Usage Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Use the <strong>SVG Full Logo</strong> for all print, large-format, and digital placements — it is sharp at any resolution.</li>
              <li>Use the <strong>SVG Monogram</strong> for favicons, profile icons, small badges, and app icons on light backgrounds.</li>
              <li>Use the <strong>JPG</strong> only where SVG is not supported (e.g. email bodies, older Office docs).</li>
              <li><strong>Navy (#1F3A6E)</strong> is the primary brand color — use it for backgrounds and headings against white/light surfaces.</li>
              <li><strong>Orange (#F96D3E)</strong> is the accent — reserve it for CTAs, highlights, and the logo frame; avoid overusing it.</li>
              <li>Maintain clear space around the logo equal to at least the height of the dot above the "i" in the monogram.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
