import { Link, useLocation } from "wouter";
import { useCallback, useEffect, useState, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  LogOut,
  Home,
  ChevronRight,
  Shield,
  UserCircle,
  Settings,
  GraduationCap,
  AlertTriangle,
  ShieldAlert,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { COMPANY } from "@/lib/constants";
import { NotificationBell } from "@/components/NotificationBell";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

// Context to detect nested AdminLayout (tab rendering)
export const AdminLayoutMounted = createContext(false);

const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-primary text-primary-foreground" },
  admin: { label: "Admin", color: "bg-blue-500 text-white" },
  hr: { label: "HR", color: "bg-green-500 text-white" },
  operations: { label: "Operations", color: "bg-orange-500 text-white" },
  manager: { label: "Manager", color: "bg-purple-500 text-white" },
  employee: { label: "Employee", color: "bg-gray-500 text-white" },
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: number;
  badgeColor?: string;
  gated?: boolean;
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

function SidebarCollapseToggle() {
  const { open, toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center w-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
      data-testid="button-sidebar-collapse-toggle"
      title={open ? "Collapse sidebar" : "Expand sidebar"}
    >
      {open ? (
        <span className="flex items-center gap-2 text-xs">
          <PanelLeftClose className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Collapse</span>
        </span>
      ) : (
        <PanelLeftOpen className="h-4 w-4 shrink-0" />
      )}
    </button>
  );
}

function NavItemButton({
  item,
  isActive,
  isLocked,
}: {
  item: NavItem;
  isActive: boolean;
  isLocked: boolean;
}) {
  const { open } = useSidebar();

  const content = (
    <SidebarMenuButton
      asChild={!isLocked}
      isActive={isActive}
      className={isLocked ? "opacity-40 pointer-events-none" : ""}
      tooltip={!open ? item.label : undefined}
      data-testid={`nav-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {isLocked ? (
        <span className="flex items-center gap-2 w-full">
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 group-data-[collapsible=icon]:hidden">{item.label}</span>
        </span>
      ) : (
        <Link href={item.href} className="flex items-center gap-2 w-full">
          <div className="relative shrink-0">
            <item.icon className="h-4 w-4" />
            {!open && item.badge && item.badge > 0 ? (
              <span
                className={`absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full text-[9px] font-bold flex items-center justify-center text-white ${item.badgeColor || "bg-red-500"}`}
              >
                {item.badge > 9 ? "9+" : item.badge}
              </span>
            ) : null}
          </div>
          <span className="flex-1 group-data-[collapsible=icon]:hidden">{item.label}</span>
          {open && item.badge && item.badge > 0 ? (
            <span
              className={`ml-auto text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-white ${item.badgeColor || "bg-red-500"}`}
              data-testid={`badge-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          ) : null}
        </Link>
      )}
    </SidebarMenuButton>
  );

  return <SidebarMenuItem>{content}</SidebarMenuItem>;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const alreadyMounted = useContext(AdminLayoutMounted);

  // If already inside an AdminLayout (nested tab rendering), just render children
  if (alreadyMounted) {
    return <>{children}</>;
  }

  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const notificationsEnabled = isEnabled("notifications_enabled");

  const handleIdleTimeout = useCallback(() => {
    logout();
  }, [logout]);

  const { showWarning, remainingSeconds, dismissWarning } = useIdleTimeout(handleIdleTimeout);

  const isProduction = import.meta.env.PROD;
  const needs2FA = isProduction && user && !user.totpEnabled && !location.startsWith("/admin/profile") && !location.startsWith("/admin/hr/profile");

  const EXEMPT_LOCK_ROLES = ["super_admin", "admin"];
  const isLockExempt = user?.role ? EXEMPT_LOCK_ROLES.includes(user.role) : true;

  // Sidebar open/close with localStorage persistence
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_sidebar_open");
      return stored === null ? true : stored !== "false";
    } catch { return true; }
  });

  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    try { localStorage.setItem("admin_sidebar_open", String(open)); } catch {}
  };

  const { data: rayoStatusForLayout } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/rayo-academy/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/rayo-academy/status", { credentials: "include" });
        if (!res.ok) return { enabled: false };
        return res.json();
      } catch { return { enabled: false }; }
    },
    staleTime: 60000,
    enabled: !!user,
  });

  const complianceEndpoint = rayoStatusForLayout?.enabled
    ? "/api/rayo-academy/compliance-status"
    : "/api/onboarding/compliance-status";

  const { data: complianceStatus } = useQuery<{
    locked: boolean;
    overdueCount: number;
    trackTitles: string[];
    pendingExtensions: any[];
  }>({
    queryKey: [complianceEndpoint],
    queryFn: async () => {
      try {
        const res = await fetch(complianceEndpoint, { credentials: "include" });
        if (!res.ok) return { locked: false, overdueCount: 0, trackTitles: [], pendingExtensions: [] };
        return res.json();
      } catch {
        return { locked: false, overdueCount: 0, trackTitles: [], pendingExtensions: [] };
      }
    },
    refetchInterval: 120000,
    enabled: !!user && !isLockExempt,
  });

  const isComplianceLocked = !isLockExempt && complianceStatus?.locked === true;
  const isOnTrainingPage = location === "/admin/hr/my-training" || location.startsWith("/admin/hr/my-training") ||
    location.startsWith("/admin/growth");
  const isOnPolicyGatePage = location === "/admin/policy-gate";

  const userNeeds2FASetup = user && !user.totpEnabled;

  const POLICY_GATE_EXEMPT = ["super_admin", "admin"];
  const isPolicyGateExempt = POLICY_GATE_EXEMPT.includes(user?.role || "");

  const { data: policyGateStatus } = useQuery<{ hasPendingPolicies: boolean; policies: any[] }>({
    queryKey: ["/api/onboarding/policy-gate-status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/policy-gate-status", { credentials: "include" });
        // Fail-closed: if status cannot be determined, block access (hasPendingPolicies: true)
        if (!res.ok) return { hasPendingPolicies: true, policies: [] };
        return res.json();
      } catch { return { hasPendingPolicies: true, policies: [] }; }
    },
    refetchInterval: 300000,
    enabled: !!user && !isPolicyGateExempt,
  });

  const hasPendingPolicies = !isPolicyGateExempt && policyGateStatus?.hasPendingPolicies === true;

  useEffect(() => {
    if (hasPendingPolicies && !isOnPolicyGatePage && !userNeeds2FASetup) {
      setLocation("/admin/policy-gate");
    }
  }, [hasPendingPolicies, isOnPolicyGatePage, userNeeds2FASetup, setLocation]);

  useEffect(() => {
    if (isComplianceLocked && !isOnTrainingPage && !userNeeds2FASetup && !hasPendingPolicies) {
      setLocation("/admin/hr/my-training");
    }
  }, [isComplianceLocked, isOnTrainingPage, userNeeds2FASetup, hasPendingPolicies, setLocation]);

  const ENDORSER_ROLES = ["manager", "hr", "admin"];
  const isEndorserRole = ENDORSER_ROLES.includes(user?.role || "");

  const { data: pendingEndorseCount } = useQuery<number>({
    queryKey: ["/api/onboarding/extension-requests/to-endorse", "count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/extension-requests/to-endorse", { credentials: "include" });
        if (!res.ok) return 0;
        const data = await res.json();
        return Array.isArray(data) ? data.length : 0;
      } catch { return 0; }
    },
    refetchInterval: 60000,
    enabled: !!user && isEndorserRole,
  });

  const { data: trainingAlerts } = useQuery<{ overdue: number; dueSoon: number; total: number }>({
    queryKey: ["/api/onboarding/my-training-alerts"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/my-training-alerts", { credentials: "include" });
        if (!res.ok) return { overdue: 0, dueSoon: 0, total: 0 };
        return res.json();
      } catch { return { overdue: 0, dueSoon: 0, total: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user,
  });

  const { data: trainingFlagData } = useQuery<{ value: any }>({
    queryKey: ["/api/system-settings/onboarding_training_enabled"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/system-settings/onboarding_training_enabled", { credentials: "include" });
        if (!res.ok) return { value: null };
        return res.json();
      } catch { return { value: null }; }
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const ADMIN_TRAINING_ROLES = ["super_admin", "admin", "hr", "manager"];
  const trainingEnabled = trainingFlagData?.value === true || ADMIN_TRAINING_ROLES.includes(user?.role || "");

  const PERF_ADMIN_ROLES = ["super_admin", "admin", "hr", "manager"];
  const { data: perfFlagData } = useQuery<{ value: boolean | null }>({
    queryKey: ["/api/system-settings/performance_management_enabled"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/system-settings/performance_management_enabled", { credentials: "include" });
        if (!res.ok) return { value: null };
        return res.json();
      } catch { return { value: null }; }
    },
    enabled: !!user,
    staleTime: 60000,
  });
  const perfEnabled = perfFlagData?.value === true || PERF_ADMIN_ROLES.includes(user?.role || "");

  const { data: perfAlerts } = useQuery<{ pendingSelfReviews: number; upcomingCheckIns: number; total: number }>({
    queryKey: ["/api/performance/my-alerts"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/performance/my-alerts", { credentials: "include" });
        if (!res.ok) return { pendingSelfReviews: 0, upcomingCheckIns: 0, total: 0 };
        return res.json();
      } catch { return { pendingSelfReviews: 0, upcomingCheckIns: 0, total: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user && perfEnabled,
  });

  // Leave approvals badge for managers
  const { data: leaveApprovalsCount } = useQuery<number>({
    queryKey: ["/api/hr/leave-requests/my-team", "pending-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/leave-requests/my-team?status=pending", { credentials: "include" });
        if (!res.ok) return 0;
        const data = await res.json();
        return Array.isArray(data) ? data.length : 0;
      } catch { return 0; }
    },
    refetchInterval: 60000,
    enabled: !!user && ["manager", "hr", "admin", "super_admin", "operations"].includes(user?.role || ""),
  });

  const roleInfo = user?.role ? roleLabels[user.role] : roleLabels.employee;
  const userRole = user?.role || "employee";

  const hasRecruitmentAccess = ["super_admin", "admin", "operations", "manager"].includes(userRole);
  const hasTeamAccess = ["super_admin", "admin", "hr", "operations", "manager"].includes(userRole);
  const hasHRAccess = ["super_admin", "admin", "hr", "operations"].includes(userRole);
  const hasNewHireAccess = ["super_admin", "admin", "hr", "operations", "manager"].includes(userRole);
  const hasGrowthAccess = trainingEnabled || perfEnabled;

  // Training + perf badge total for My Growth
  const growthBadge = (trainingAlerts?.total ?? 0) + (perfAlerts?.total ?? 0);

  // People & HR badge (endorsements)
  const peopleHRBadge = pendingEndorseCount ?? 0;

  const navItems: NavItem[] = [
    {
      href: "/admin/hr",
      label: "My Work",
      icon: LayoutDashboard,
      roles: ["all"],
      badge: undefined,
    },
    {
      href: "/admin/profile",
      label: "My Profile",
      icon: UserCircle,
      roles: ["all"],
    },
    ...(hasGrowthAccess ? [{
      href: "/admin/growth",
      label: "My Growth",
      icon: GraduationCap,
      roles: ["all"],
      badge: growthBadge > 0 ? growthBadge : undefined,
      badgeColor: (trainingAlerts?.overdue ?? 0) > 0 ? "bg-red-500" : "bg-amber-500",
    }] : []),
    ...(hasTeamAccess ? [{
      href: "/admin/hr/my-team",
      label: "My Team",
      icon: Users,
      roles: ["super_admin", "admin", "hr", "operations", "manager"],
      badge: (leaveApprovalsCount ?? 0) > 0 ? leaveApprovalsCount : undefined,
      badgeColor: "bg-blue-500",
    }] : []),
    ...(hasRecruitmentAccess ? [{
      href: "/admin/recruitment",
      label: "Recruitment",
      icon: Briefcase,
      roles: ["super_admin", "admin", "operations", "manager"],
    }] : []),
    ...(hasNewHireAccess ? [{
      href: "/admin/new-hire",
      label: "New Hire",
      icon: UserPlus,
      roles: ["super_admin", "admin", "hr", "operations", "manager"],
    }] : []),
    ...(hasHRAccess ? [{
      href: "/admin/hr/people",
      label: "People & HR",
      icon: Settings,
      roles: ["super_admin", "admin", "hr", "operations"],
      badge: peopleHRBadge > 0 ? peopleHRBadge : undefined,
      badgeColor: "bg-amber-500",
    }] : []),
  ];

  const isNavActive = (item: NavItem) => {
    const href = item.href;
    if (href === "/admin/hr") return location === "/admin/hr" || location.startsWith("/admin/hr") && !location.startsWith("/admin/hr/my-team") && !location.startsWith("/admin/hr/people") && !location.startsWith("/admin/hr/team-attendance") && !location.startsWith("/admin/hr/leave-approvals") && !location.startsWith("/admin/hr/training-progress");
    if (href === "/admin/profile") return location === "/admin/profile" || location.startsWith("/admin/profile");
    if (href === "/admin/growth") return location === "/admin/growth" || location.startsWith("/admin/growth") || location.startsWith("/admin/performance") || location.startsWith("/admin/hr/my-training");
    if (href === "/admin/hr/my-team") return location === "/admin/hr/my-team" || location.startsWith("/admin/hr/my-team") || location.startsWith("/admin/hr/team-attendance") || location.startsWith("/admin/hr/leave-approvals") || location.startsWith("/admin/hr/training-progress");
    if (href === "/admin/recruitment") return location === "/admin/recruitment" || location.startsWith("/admin/recruitment") || location === "/admin" || location.startsWith("/admin/jobs") || location.startsWith("/admin/applications") || location.startsWith("/admin/contacts");
    if (href === "/admin/new-hire") return location === "/admin/new-hire" || location.startsWith("/admin/new-hire");
    if (href === "/admin/hr/people") return location === "/admin/hr/people" || location.startsWith("/admin/hr/people") || location.startsWith("/admin/users") || location.startsWith("/admin/hr/reports") || location.startsWith("/admin/hr/training") || location.startsWith("/admin/hr/settings");
    return location.startsWith(href);
  };

  const breadcrumbLabel = () => {
    if (location === "/admin/hr" || location.startsWith("/admin/hr")) {
      const path = location.replace("/admin/hr", "").replace(/^\//, "");
      if (!path) return "My Work";
      return path.split("/").pop()?.replace(/-/g, " ") || "My Work";
    }
    if (location.startsWith("/admin/profile")) return "My Profile";
    if (location.startsWith("/admin/growth")) return "My Growth";
    if (location.startsWith("/admin/recruitment")) return "Recruitment";
    const path = location.replace("/admin", "").replace(/^\//, "");
    if (!path) return "Dashboard";
    return path.split("/").pop()?.replace(/-/g, " ") || "Dashboard";
  };

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <AdminLayoutMounted.Provider value={true}>
      <SidebarProvider
        style={sidebarStyle as React.CSSProperties}
        open={sidebarOpen}
        onOpenChange={handleSidebarOpenChange}
      >
        <div className="flex h-screen w-full">
          <Sidebar collapsible="icon">
            {/* Profile Header */}
            <SidebarHeader className="border-b p-0">
              <Link href="/admin/profile">
                <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-none transition-colors cursor-pointer" data-testid="nav-profile-header">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center font-semibold text-primary text-sm shrink-0">
                    {user?.firstName?.[0] || "?"}{user?.lastName?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="font-semibold text-sm truncate leading-tight">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <Badge className={`text-[10px] px-1.5 py-0 mt-0.5 ${roleInfo.color}`} data-testid="badge-user-role">
                      {roleInfo.label}
                    </Badge>
                  </div>
                </div>
              </Link>
              {/* Logo row - visible in expanded mode */}
              <div className="flex items-center gap-2 px-3 pb-2 group-data-[collapsible=icon]:hidden">
                <img src={logoImage} alt={COMPANY.name} className="h-5 w-5 rounded object-cover" />
                <span className="text-xs text-muted-foreground font-medium">Hire'in Portal</span>
              </div>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navItems.map((item) => (
                      <NavItemButton
                        key={item.href}
                        item={item}
                        isActive={isNavActive(item)}
                        isLocked={isComplianceLocked && item.href !== "/admin/growth"}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* Bottom actions */}
              <SidebarGroup className="mt-auto border-t pt-2">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="View Website">
                        <Link href="/">
                          <Home className="h-4 w-4 shrink-0" />
                          <span className="group-data-[collapsible=icon]:hidden">View Website</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={() => logout()} tooltip="Sign Out" data-testid="button-logout">
                        <LogOut className="h-4 w-4 shrink-0" />
                        <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarCollapseToggle />
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between h-14 px-4 border-b bg-background shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                  <span>Admin</span>
                  <ChevronRight className="h-4 w-4" />
                  <span className="text-foreground font-medium capitalize">
                    {breadcrumbLabel()}
                  </span>
                </nav>
              </div>
              <div className="flex items-center gap-3">
                {notificationsEnabled && <NotificationBell />}
                <Badge variant="outline" className="text-xs hidden sm:flex">
                  {roleInfo.label}
                </Badge>
              </div>
            </header>

            <main className="flex-1 overflow-auto p-4 sm:p-6 bg-muted/20">
              {needs2FA ? (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="max-w-md w-full text-center space-y-6 p-8">
                    <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <ShieldAlert className="h-8 w-8 text-amber-600" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold" data-testid="text-2fa-required-title">Two-Factor Authentication Required</h2>
                      <p className="text-muted-foreground">
                        For security purposes, all employees must enable two-factor authentication before accessing the portal.
                      </p>
                    </div>
                    <Button size="lg" onClick={() => setLocation("/admin/profile")} data-testid="button-setup-2fa-redirect">
                      <Shield className="mr-2 h-4 w-4" />
                      Go to Profile & Set Up 2FA
                    </Button>
                  </div>
                </div>
              ) : (
                children
              )}
            </main>
          </div>
        </div>

        <Dialog open={showWarning} onOpenChange={() => dismissWarning()}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-session-timeout">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Session Timeout Warning
              </DialogTitle>
              <DialogDescription>
                You've been inactive for a while. Your session will expire in{" "}
                <span className="font-bold text-foreground">{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}</span>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={dismissWarning} data-testid="button-stay-signed-in">
                Stay Signed In
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarProvider>
    </AdminLayoutMounted.Provider>
  );
}
