import { Link, useLocation } from "wouter";
import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Mail,
  Users,
  LogOut,
  Home,
  ChevronRight,
  Shield,
  Clock,
  CalendarDays,
  CalendarCheck,
  UserCircle,
  Receipt,
  FileBarChart,
  Ticket,
  Settings,
  Network,
  FileCheck,
  ClipboardCheck,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  GraduationCap,
  BarChart3,
  UsersRound,
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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth, type AuthUser } from "@/hooks/use-auth";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { COMPANY } from "@/lib/constants";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

const recruitmentMenu = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "operations", "manager"]
  },
  {
    href: "/admin/jobs",
    label: "Jobs",
    icon: Briefcase,
    roles: ["super_admin", "admin", "operations", "manager"]
  },
  {
    href: "/admin/applications",
    label: "Applications",
    icon: FileText,
    roles: ["super_admin", "admin", "operations", "manager"]
  },
  {
    href: "/admin/contacts",
    label: "Contacts",
    icon: Mail,
    roles: ["super_admin", "admin", "operations", "manager"]
  },
];

const myWorkspaceMenu = [
  {
    href: "/admin/hr",
    label: "My Dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/attendance",
    label: "My Attendance",
    icon: Clock,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/leaves",
    label: "My Leaves",
    icon: CalendarCheck,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/holidays",
    label: "Holiday Calendar",
    icon: CalendarDays,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/my-documents",
    label: "My Documents",
    icon: FileCheck,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/salary-slips",
    label: "My Salary Slips",
    icon: Receipt,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/tickets",
    label: "Tickets",
    icon: Ticket,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/org-chart",
    label: "Org Chart",
    icon: Network,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/profile",
    label: "My Profile",
    icon: UserCircle,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/my-training",
    label: "My Training",
    icon: GraduationCap,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"],
    trainingGated: true,
  },
];

const teamManagementMenu = [
  {
    href: "/admin/hr/my-team",
    label: "My Team",
    icon: Network,
    roles: ["super_admin", "admin", "hr", "operations", "manager"]
  },
  {
    href: "/admin/hr/team-attendance",
    label: "Team Attendance",
    icon: Clock,
    roles: ["super_admin", "admin", "hr", "operations", "manager"]
  },
  {
    href: "/admin/hr/leave-approvals",
    label: "Leave Approvals",
    icon: CalendarCheck,
    roles: ["super_admin", "admin", "hr", "manager"]
  },
  {
    href: "/admin/hr/training-progress",
    label: "Training Progress",
    icon: BarChart3,
    roles: ["super_admin", "admin", "hr", "manager", "operations"]
  },
];

const administrationMenu = [
  {
    href: "/admin/users",
    label: "User Management",
    icon: Users,
    roles: ["super_admin", "admin", "hr", "operations"]
  },
  {
    href: "/admin/hr/salary-reports",
    label: "Salary Reports",
    icon: FileBarChart,
    roles: ["super_admin", "admin", "hr"]
  },
  {
    href: "/admin/hr/document-compliance",
    label: "Document Compliance",
    icon: ClipboardCheck,
    roles: ["super_admin", "admin", "hr"]
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: FileText,
    roles: ["super_admin", "admin"]
  },
  {
    href: "/admin/hr/tools",
    label: "HR Tools",
    icon: Wrench,
    roles: ["super_admin", "admin", "hr"]
  },
  {
    href: "/admin/hr/training",
    label: "Training Management",
    icon: GraduationCap,
    roles: ["super_admin", "admin", "hr", "manager", "operations"]
  },
  {
    href: "/admin/hr/settings",
    label: "HR Settings",
    icon: Settings,
    roles: ["super_admin", "admin", "hr"]
  },
];

const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-primary text-primary-foreground" },
  admin: { label: "Admin", color: "bg-blue-500 text-white" },
  hr: { label: "HR", color: "bg-green-500 text-white" },
  operations: { label: "Operations", color: "bg-orange-500 text-white" },
  manager: { label: "Manager", color: "bg-purple-500 text-white" },
  employee: { label: "Employee", color: "bg-gray-500 text-white" },
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleIdleTimeout = useCallback(() => {
    logout();
  }, [logout]);

  const { showWarning, remainingSeconds, dismissWarning } = useIdleTimeout(handleIdleTimeout);

  const needs2FA = user && !user.totpEnabled && !location.startsWith("/admin/hr/profile");

  const EXEMPT_LOCK_ROLES = ["super_admin", "admin"];
  const isLockExempt = user?.role ? EXEMPT_LOCK_ROLES.includes(user.role) : true;

  const { data: complianceStatus } = useQuery<{
    locked: boolean;
    overdueCount: number;
    trackTitles: string[];
    pendingExtensions: any[];
  }>({
    queryKey: ["/api/onboarding/compliance-status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/compliance-status", { credentials: "include" });
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
  const isOnTrainingPage = location === "/admin/hr/my-training" || location.startsWith("/admin/hr/my-training");

  useEffect(() => {
    if (isComplianceLocked && !isOnTrainingPage) {
      setLocation("/admin/hr/my-training");
    }
  }, [isComplianceLocked, isOnTrainingPage, setLocation]);

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
      } catch {
        return 0;
      }
    },
    refetchInterval: 60000,
    enabled: !!user && isEndorserRole,
  });

  const ADMIN_TRAINING_ROLES = ["super_admin", "admin", "hr", "manager"];

  const { data: trainingAlerts } = useQuery<{ overdue: number; dueSoon: number; total: number }>({
    queryKey: ["/api/onboarding/my-training-alerts"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/my-training-alerts", { credentials: "include" });
        if (!res.ok) return { overdue: 0, dueSoon: 0, total: 0 };
        return res.json();
      } catch {
        return { overdue: 0, dueSoon: 0, total: 0 };
      }
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
      } catch {
        return { value: null };
      }
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const trainingEnabled = trainingFlagData?.value === true || ADMIN_TRAINING_ROLES.includes(user?.role || "");

  const filteredRecruitment = recruitmentMenu.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredMyWorkspace = (myWorkspaceMenu as any[]).filter(item => {
    if (!user?.role || !item.roles.includes(user.role)) return false;
    if (item.trainingGated) return trainingEnabled;
    return true;
  });

  const filteredTeamMgmt = teamManagementMenu.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredAdmin = administrationMenu.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    if (href === "/admin/hr") return location === "/admin/hr";
    return location.startsWith(href);
  };

  const roleInfo = user?.role ? roleLabels[user.role] : roleLabels.employee;

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const breadcrumbLabel = () => {
    const path = location.replace("/admin", "").replace(/^\//, "");
    if (!path) return "Dashboard";
    const parts = path.split("/");
    return parts[parts.length - 1].replace(/-/g, " ");
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <Link href="/" className="flex items-center gap-3">
              <img
                src={logoImage}
                alt={COMPANY.name}
                className="h-8 w-8 rounded-md object-cover"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-primary">Hire'in Admin</span>
                <span className="text-xs text-muted-foreground">Portal</span>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="border-b pb-4">
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs ${roleInfo.color}`} data-testid="badge-user-role">
                    {roleInfo.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {user?.email}
                </p>
              </div>
            </SidebarGroup>

            {filteredRecruitment.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Recruitment</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredRecruitment.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild={!isComplianceLocked}
                          isActive={isActive(item.href)}
                          className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                          data-testid={`nav-recruit-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          {isComplianceLocked ? (
                            <span className="flex items-center gap-2">
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </span>
                          ) : (
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredMyWorkspace.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>My Workspace</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredMyWorkspace.map((item) => {
                      const isTraining = item.href === "/admin/hr/my-training";
                      const alertCount = trainingAlerts?.total ?? 0;
                      const isOverdue = (trainingAlerts?.overdue ?? 0) > 0;
                      const isLockedItem = isComplianceLocked && !isTraining;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild={!isLockedItem}
                            isActive={isActive(item.href)}
                            className={isLockedItem ? "opacity-40 pointer-events-none" : ""}
                            data-testid={`nav-emp-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                          >
                            {isLockedItem ? (
                              <span className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                <span className="flex-1">{item.label}</span>
                              </span>
                            ) : (
                              <Link href={item.href}>
                                <item.icon className="h-4 w-4" />
                                <span className="flex-1">{item.label}</span>
                                {isTraining && alertCount > 0 && (
                                  <span className={`ml-auto text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center ${isOverdue ? "bg-red-500 text-white" : "bg-amber-500 text-white"}`} data-testid="badge-training-alerts">
                                    {alertCount > 9 ? "9+" : alertCount}
                                  </span>
                                )}
                              </Link>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredTeamMgmt.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Team Management</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredTeamMgmt.map((item) => (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild={!isComplianceLocked}
                          isActive={isActive(item.href)}
                          className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                          data-testid={`nav-team-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          {isComplianceLocked ? (
                            <span className="flex items-center gap-2">
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </span>
                          ) : (
                            <Link href={item.href}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {filteredAdmin.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredAdmin.map((item) => {
                      const isTrainingMgmt = item.href === "/admin/hr/training";
                      const endorseBadge = isTrainingMgmt && isEndorserRole && (pendingEndorseCount ?? 0) > 0;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild={!isComplianceLocked}
                            isActive={isActive(item.href)}
                            className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                            data-testid={`nav-admin-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                          >
                            {isComplianceLocked ? (
                              <span className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </span>
                            ) : (
                              <Link href={item.href}>
                                <item.icon className="h-4 w-4" />
                                <span className="flex-1">{item.label}</span>
                                {endorseBadge && (
                                  <span className="ml-auto text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center bg-amber-500 text-white" data-testid="badge-pending-endorsements">
                                    {(pendingEndorseCount ?? 0) > 9 ? "9+" : pendingEndorseCount}
                                  </span>
                                )}
                              </Link>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            <SidebarGroup className="mt-auto">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href="/">
                        <Home className="h-4 w-4" />
                        <span>View Website</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => logout()} data-testid="button-logout">
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between h-14 px-4 border-b bg-background">
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
              <Badge variant="outline" className="text-xs">
                {roleInfo.label}
              </Badge>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6 bg-muted/20">
            {needs2FA ? (
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="max-w-md w-full text-center space-y-6 p-8">
                  <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <ShieldAlert className="h-8 w-8 text-amber-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold" data-testid="text-2fa-required-title">Two-Factor Authentication Required</h2>
                    <p className="text-muted-foreground">
                      For security purposes, all employees must enable two-factor authentication before accessing the portal. Please set up 2FA on your profile to continue.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={() => setLocation("/admin/hr/profile")}
                    data-testid="button-setup-2fa-redirect"
                  >
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
              Click below or interact with the page to stay signed in.
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
  );
}
