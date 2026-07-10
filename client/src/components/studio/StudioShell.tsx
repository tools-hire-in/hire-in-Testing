import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { usePermissions } from "@/hooks/use-permissions";
import { STUDIO_BASE, studioPath } from "@/lib/studioBase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/NotificationBell";
import { useStudioProject } from "@/pages/admin/studio/useStudioProject";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star } from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Newspaper,
  Plus,
  Send,
  Settings,
  Users,
} from "lucide-react";

/**
 * Studio T1 (Task #906): standalone creative-suite shell for /studio/*.
 * Slim top nav — Studio identity, primary nav, global create, bell, user menu.
 * Same app, same session, same RBAC; presentation and routing change only.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { can } = usePermissions();
  const notificationsEnabled = isEnabled("notifications_enabled");
  const canCreate = can("studio.create_article");
  const canManageAuthors = can("studio.manage_authors");
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();

  // Internal tool: never crawlable (server also sends X-Robots-Tag).
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const nav: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }[] = [
    {
      href: STUDIO_BASE,
      label: "Dashboard",
      icon: LayoutDashboard,
      active: location === STUDIO_BASE,
    },
    {
      href: studioPath("/calendar"),
      label: "Calendar",
      icon: CalendarDays,
      active: ["/calendar", "/board", "/table"].some((p) => location.startsWith(studioPath(p))),
    },
    {
      href: studioPath("/campaigns"),
      label: "Campaigns",
      icon: Megaphone,
      active: location.startsWith(studioPath("/campaigns")),
    },
    {
      href: studioPath("/articles"),
      label: "Articles",
      icon: Newspaper,
      active: location.startsWith(studioPath("/articles")) || location.startsWith(studioPath("/live")),
    },
    {
      href: studioPath("/authors"),
      label: "Authors",
      icon: Users,
      active: location.startsWith(studioPath("/authors")),
    },
    {
      href: studioPath("/outreach"),
      label: "Outreach",
      icon: Send,
      active: location.startsWith(studioPath("/outreach")),
    },
    ...(can("studio.bd_agent")
      ? [
          {
            href: studioPath("/bd-agent"),
            label: "BD Agent",
            icon: Briefcase,
            active: location.startsWith(studioPath("/bd-agent")),
          },
          {
            href: studioPath("/bd-templates"),
            label: "BD Templates",
            icon: FileText,
            active: location.startsWith(studioPath("/bd-templates")),
          },
          {
            href: studioPath("/bd-guide"),
            label: "BD Guide",
            icon: BookOpen,
            active: location.startsWith(studioPath("/bd-guide")) && !location.startsWith(studioPath("/guide")),
          },
        ]
      : []),
    {
      href: studioPath("/guide"),
      label: "Guide",
      icon: BookOpen,
      active: location === studioPath("/guide") || (location.startsWith(studioPath("/guide")) && !location.startsWith(studioPath("/bd-guide"))),
    },
    ...(canManageAuthors
      ? [{
          href: studioPath("/settings/templates"),
          label: "Settings",
          icon: Settings,
          active: location.startsWith(studioPath("/settings")) || location.startsWith(studioPath("/access")),
        }]
      : []),
  ];

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <Link href="/admin/my-desk">
          <span
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            data-testid="link-back-to-portal"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Portal</span>
          </span>
        </Link>
        <div className="h-4 w-px bg-border" />
        <Link href={STUDIO_BASE}>
          <span className="flex cursor-pointer items-center gap-2" data-testid="link-studio-home">
            <Clapperboard className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">Studio</span>
            <Badge variant="secondary" className="hidden px-1.5 py-0 text-[10px] sm:inline-flex">beta</Badge>
          </span>
        </Link>

        <nav className="ml-2 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              <span
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  item.active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                data-testid={`nav-studio-${item.label.toLowerCase()}`}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            disabled={projectsLoading || !projects?.length}
          >
            <SelectTrigger
              className="h-8 w-[130px] sm:w-[180px]"
              data-testid="select-shell-project"
            >
              <SelectValue placeholder={projectsLoading ? "Loading…" : "Project"} />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id} data-testid={`option-shell-project-${p.id}`}>
                  <span className="flex items-center gap-2">
                    {p.isPrimary && <Star className="h-3 w-3 text-amber-500" />}
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" data-testid="button-studio-create">
                  <Plus className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">Create</span>
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => navigate(`${studioPath("/calendar")}?create=1`)}
                  data-testid="menu-create-idea"
                >
                  New content idea
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(studioPath("/articles"))}
                  data-testid="menu-create-article"
                >
                  New article
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {notificationsEnabled && <NotificationBell />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
                data-testid="button-studio-user-menu"
              >
                {user?.firstName?.[0] || "?"}{user?.lastName?.[0] || ""}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate">
                {user?.firstName} {user?.lastName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin/my-desk")} data-testid="menu-back-to-portal">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Portal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout()} data-testid="menu-studio-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
