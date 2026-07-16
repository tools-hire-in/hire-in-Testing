import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

interface DevToolsStatus {
  envMode: "dev" | "qa" | "production";
}

const ENV_BADGE: Record<string, { label: string; className: string }> = {
  dev:        { label: "DEV",        className: "bg-yellow-500 text-black" },
  qa:         { label: "QA",         className: "bg-blue-500 text-white" },
  production: { label: "PRODUCTION", className: "bg-red-600 text-white" },
};

export function DevToolsShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: status } = useQuery<DevToolsStatus>({
    queryKey: ["/api/dev-tools/status"],
    refetchInterval: 10_000,
  });

  const envMode = status?.envMode ?? "dev";
  const badge = ENV_BADGE[envMode] ?? ENV_BADGE.dev;

  const navItems = [
    { href: "/dev-tools",               label: "Environment" },
    { href: "/dev-tools/crons",         label: "Cron Jobs" },
    { href: "/dev-tools/notifications", label: "Notification Sandbox" },
    { href: "/dev-tools/view-as",       label: "View As" },
  ];

  function isActive(href: string) {
    if (href === "/dev-tools") return location === "/dev-tools";
    return location.startsWith(href);
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="flex items-center gap-4 h-14 px-4 border-b border-zinc-800 shrink-0">
        {/* Back link */}
        <Link
          href="/admin/my-desk"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          data-testid="link-back-to-portal"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to Portal</span>
        </Link>

        <div className="h-5 w-px bg-zinc-700" />

        {/* Wordmark */}
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-400" />
          <span className="font-semibold text-sm tracking-tight">Dev Control Center</span>
          <Badge className={`text-[10px] px-1.5 py-0.5 font-bold rounded ${badge.className}`}>
            {badge.label}
          </Badge>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1 ml-4 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"
              }`}
              data-testid={`nav-devtools-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span className="hidden sm:inline">
            {user?.firstName} {user?.lastName}
          </span>
          <button
            onClick={() => logout()}
            className="text-xs hover:text-zinc-100 transition-colors"
            data-testid="button-devtools-logout"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
