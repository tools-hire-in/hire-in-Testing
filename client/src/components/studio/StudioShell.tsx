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
  BarChart3,
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

type NavChild = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
};

type NavDirect = NavChild & { kind: "direct" };

type NavGroup = {
  kind: "group";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: NavChild[];
};

type NavItem = NavDirect | NavGroup;

export function StudioShell({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { can } = usePermissions();
  const notificationsEnabled = isEnabled("notifications_enabled");
  const canCreate = can("studio.create_article");
  const canManageAuthors = can("studio.manage_authors");
  const canBd = can("studio.bd_agent");
  const isHrAdmin = ["super_admin", "admin", "hr"].includes(user?.role ?? "");
  const { projects, projectsLoading, selectedProjectId, setSelectedProjectId } = useStudioProject();

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const nav: NavItem[] = [
    {
      kind: "direct",
      href: studioPath("/calendar"),
      label: "Content Plan",
      icon: CalendarDays,
      active: ["/calendar", "/board", "/table"].some((p) =>
        location.startsWith(studioPath(p))
      ),
    },
    {
      kind: "direct",
      href: studioPath("/articles"),
      label: "Articles",
      icon: Newspaper,
      active:
        location.startsWith(studioPath("/articles")) ||
        location.startsWith(studioPath("/live")),
    },
    {
      kind: "direct",
      href: studioPath("/outreach"),
      label: "Outreach",
      icon: Send,
      active: location.startsWith(studioPath("/outreach")),
    },
    ...(canBd
      ? [
          {
            kind: "group" as const,
            label: "BD Tools",
            icon: Briefcase,
            active:
              location.startsWith(studioPath("/bd-agent")) ||
              location.startsWith(studioPath("/bd-templates")) ||
              (location.startsWith(studioPath("/bd-guide")) &&
                !location.startsWith(studioPath("/guide"))),
            children: [
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
                active:
                  location.startsWith(studioPath("/bd-guide")) &&
                  !location.startsWith(studioPath("/guide")),
              },
            ],
          },
        ]
      : []),
    {
      kind: "group",
      label: "Insights",
      icon: BarChart3,
      active:
        location.startsWith(studioPath("/feedback-insights")) ||
        location.startsWith(studioPath("/guide/analytics")),
      children: [
        ...(isHrAdmin
          ? [
              {
                href: studioPath("/feedback-insights"),
                label: "Feedback Insights",
                icon: BarChart3,
                active: location.startsWith(studioPath("/feedback-insights")),
              },
            ]
          : []),
        {
          href: studioPath("/guide/analytics"),
          label: "Analytics Guide",
          icon: BarChart3,
          active: location.startsWith(studioPath("/guide/analytics")),
        },
      ],
    },
    {
      kind: "group",
      label: "Help",
      icon: BookOpen,
      active: location === studioPath("/guide"),
      children: [
        {
          href: studioPath("/guide"),
          label: "Guide",
          icon: BookOpen,
          active: location === studioPath("/guide"),
        },
      ],
    },
    {
      kind: "group",
      label: "More",
      icon: LayoutDashboard,
      active:
        location === STUDIO_BASE ||
        location.startsWith(studioPath("/campaigns")) ||
        location.startsWith(studioPath("/authors")),
      children: [
        {
          href: STUDIO_BASE,
          label: "Dashboard",
          icon: LayoutDashboard,
          active: location === STUDIO_BASE,
        },
        {
          href: studioPath("/campaigns"),
          label: "Campaigns",
          icon: Megaphone,
          active: location.startsWith(studioPath("/campaigns")),
        },
        {
          href: studioPath("/authors"),
          label: "Authors",
          icon: Users,
          active: location.startsWith(studioPath("/authors")),
        },
      ],
    },
  ];

  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Dark navy header */}
      <header
        className="flex h-14 shrink-0 items-center gap-3 px-3 sm:px-4"
        style={{ backgroundColor: "#1F3A6E" }}
      >
        {/* Back to portal */}
        <Link href="/admin/my-desk">
          <span
            className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            data-testid="link-back-to-portal"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Portal</span>
          </span>
        </Link>

        <div className="h-4 w-px bg-white/20" />

        {/* Studio wordmark — clicking goes to Dashboard */}
        <Link href={STUDIO_BASE}>
          <span
            className="flex cursor-pointer items-center gap-2"
            data-testid="link-studio-home"
          >
            <Clapperboard className="h-5 w-5 text-white" />
            <span className="text-sm font-bold tracking-tight text-white">
              Studio
            </span>
            <Badge
              variant="secondary"
              className="hidden px-1.5 py-0 text-[10px] sm:inline-flex bg-white/15 text-white/80 border-0"
            >
              beta
            </Badge>
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="ml-2 flex min-w-0 flex-1 items-center gap-0.5">
          {nav.map((item) => {
            if (item.kind === "direct") {
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      item.active
                        ? "bg-white/20 font-medium text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                    data-testid={`nav-studio-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </span>
                </Link>
              );
            }

            // Group — render as DropdownMenu trigger
            const group = item as NavGroup;
            return (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none ${
                      group.active
                        ? "bg-white/20 font-medium text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                    data-testid={`nav-studio-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <group.icon className="h-4 w-4" />
                    <span className="hidden md:inline">{group.label}</span>
                    <ChevronDown className="ml-0.5 h-3 w-3 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {group.children.map((child) => (
                    <DropdownMenuItem
                      key={child.href}
                      onClick={() => navigate(child.href)}
                      className={
                        child.active ? "bg-primary/10 font-medium text-primary" : ""
                      }
                      data-testid={`nav-studio-${child.label.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <child.icon className="mr-2 h-4 w-4" />
                      {child.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Settings icon — only for authors managers */}
          {canManageAuthors && (
            <Link href={studioPath("/settings/templates")}>
              <span
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                  location.startsWith(studioPath("/settings")) ||
                  location.startsWith(studioPath("/access"))
                    ? "bg-white/20 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
                data-testid="nav-studio-settings"
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </span>
            </Link>
          )}

          {/* Project switcher */}
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            disabled={projectsLoading || !projects?.length}
          >
            <SelectTrigger
              className="h-8 w-[130px] sm:w-[160px] border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30 [&>svg]:text-white/70"
              data-testid="select-shell-project"
            >
              <SelectValue placeholder={projectsLoading ? "Loading…" : "Project"} />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((p) => (
                <SelectItem
                  key={p.id}
                  value={p.id}
                  data-testid={`option-shell-project-${p.id}`}
                >
                  <span className="flex items-center gap-2">
                    {p.isPrimary && <Star className="h-3 w-3 text-amber-500" />}
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Create button */}
          {canCreate && (
            <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="bg-white/15 text-white border border-white/20 hover:bg-white/25 hover:text-white"
                  data-testid="button-studio-create"
                >
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

          {/* Notification bell */}
          {notificationsEnabled && (
            <span className="[&_button]:text-white/70 [&_button:hover]:text-white [&_button]:hover:bg-white/10">
              <NotificationBell />
            </span>
          )}

          {/* User avatar menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white hover:bg-white/25 transition-colors"
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
              <DropdownMenuItem
                onClick={() => navigate("/admin/my-desk")}
                data-testid="menu-back-to-portal"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Portal
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => logout()}
                data-testid="menu-studio-logout"
              >
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
