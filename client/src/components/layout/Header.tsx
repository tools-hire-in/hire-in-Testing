import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, ChevronDown, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { NAV_LINKS, COMPANY } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

interface ConsultationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctaType: string;
}

interface HeaderProps {
  onOpenConsultation?: (ctaType: string) => void;
}

export function Header({ onOpenConsultation }: HeaderProps) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => location === href;

  const handleCTA = (ctaType: string) => {
    if (onOpenConsultation) {
      onOpenConsultation(ctaType);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <img
            src={logoImage}
            alt="Hire'in Solutions"
            className="h-10 w-10 rounded-md object-cover"
            data-testid="img-logo"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary" data-testid="text-company-name">
                Hire'in
              </span>
              <span className="text-lg font-medium text-muted-foreground">Solutions</span>
            </div>
            <span className="text-xs text-muted-foreground">{COMPANY.brandLine}</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) =>
            "children" in link ? (
              <DropdownMenu key={link.label}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center gap-1"
                    data-testid={`nav-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
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
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  className={isActive(link.href) ? "bg-accent" : ""}
                  data-testid={`nav-${link.label.toLowerCase()}`}
                >
                  {link.label}
                </Button>
              </Link>
            )
          )}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden lg:flex items-center gap-3">
          {isAuthenticated ? (
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-admin">
                Admin
              </Button>
            </Link>
          ) : (
            <Link href="/admin/login">
              <Button variant="ghost" size="sm" data-testid="button-login">
                <LogIn className="h-4 w-4 mr-1" />
                Login
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
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
              <div className="flex flex-col gap-3 pt-4 border-t">
                {isAuthenticated ? (
                  <SheetClose asChild>
                    <Link href="/admin">
                      <Button variant="ghost" className="w-full justify-start">
                        Admin Dashboard
                      </Button>
                    </Link>
                  </SheetClose>
                ) : (
                  <SheetClose asChild>
                    <Link href="/admin/login">
                      <Button variant="ghost" className="w-full justify-start">
                        <LogIn className="h-4 w-4 mr-2" />
                        Login
                      </Button>
                    </Link>
                  </SheetClose>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
