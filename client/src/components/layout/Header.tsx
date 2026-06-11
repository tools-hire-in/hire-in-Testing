import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { NAV_LINKS, COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

interface HeaderProps {
  onOpenConsultation?: (ctaType: string) => void;
  transparent?: boolean;
}

export function Header({ onOpenConsultation, transparent = false }: HeaderProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);

  useEffect(() => {
    if (!transparent) return;

    const check = () => {
      const val = document.documentElement.getAttribute("data-hero-visible");
      setHeroVisible(val === "true");
    };

    check();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-hero-visible") {
          check();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-hero-visible"],
    });

    return () => observer.disconnect();
  }, [transparent]);

  const isActive = (href: string) => location === href;

  const handleCTA = (ctaType: string) => {
    if (onOpenConsultation) {
      onOpenConsultation(ctaType);
    }
  };

  const isTransparent = transparent && heroVisible;

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        isTransparent
          ? "bg-transparent border-transparent backdrop-blur-sm"
          : "bg-background/95 border-b backdrop-blur supports-[backdrop-filter]:bg-background/60"
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <img
            src={logoImage}
            alt="Hire'in Solutions"
            className="h-10 w-10 rounded-md object-cover"
            data-testid="img-logo"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span
                className={`text-xl font-bold transition-colors duration-500 ${
                  isTransparent ? "text-white" : "text-primary"
                }`}
                data-testid="text-company-name"
              >
                Hire'in
              </span>
              <span
                className={`text-xl font-medium transition-colors duration-500 ${
                  isTransparent ? "text-white/80" : "text-muted-foreground"
                }`}
              >
                Solutions
              </span>
            </div>
            <span
              className={`text-[10px] tracking-wide transition-colors duration-500 ${
                isTransparent ? "text-white/60" : "text-muted-foreground"
              }`}
            >
              {COMPANY.brandLine}
            </span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((link) =>
            "children" in link ? (
              <DropdownMenu key={link.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider transition-opacity duration-300 hover:opacity-100 cursor-pointer ${
                      isTransparent ? "text-white/85 hover:text-white" : "text-foreground/80 hover:text-foreground"
                    }`}
                    data-testid={`nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-56">
                  {link.children.map((child) => (
                    <DropdownMenuItem key={child.href} asChild>
                      <Link
                        href={child.href}
                        className="w-full cursor-pointer"
                        data-testid={`nav-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {child.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[13px] font-semibold uppercase tracking-wider transition-opacity duration-300 hover:opacity-100 ${
                  isTransparent
                    ? `text-white/85 hover:text-white ${isActive(link.href) ? "text-white" : ""}`
                    : `text-foreground/80 hover:text-foreground ${isActive(link.href) ? "text-foreground" : ""}`
                }`}
                data-testid={`nav-${link.label.toLowerCase()}`}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Button
            size="sm"
            asChild
            className="gap-1.5"
            data-testid="button-header-get-quote"
          >
            <Link href="/request-a-quote">
              <FileText className="h-3.5 w-3.5" />
              Get a Quote
            </Link>
          </Button>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              className={isTransparent ? "text-white hover:bg-white/10" : ""}
              data-testid="button-mobile-menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80">
            <div className="flex flex-col gap-4 pt-8">
              {NAV_LINKS.map((link) =>
                "children" in link ? (
                  <div key={link.label} className="space-y-2">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {link.label}
                    </span>
                    <div className="flex flex-col gap-1 pl-4">
                      {link.children.map((child) => (
                        <SheetClose asChild key={child.href}>
                          <Link
                            href={child.href}
                            className="py-2 text-sm hover:text-primary transition-colors"
                          >
                            {child.label}
                          </Link>
                        </SheetClose>
                      ))}
                    </div>
                  </div>
                ) : (
                  <SheetClose asChild key={link.href}>
                    <Link
                      href={link.href}
                      className={`py-2 text-lg font-medium hover:text-primary transition-colors ${
                        isActive(link.href) ? "text-primary" : ""
                      }`}
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                )
              )}
              
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
