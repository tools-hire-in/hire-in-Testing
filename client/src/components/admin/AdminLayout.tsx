import { Link, useLocation } from "wouter";
import { useCallback } from "react";
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
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  { 
    href: "/admin/jobs", 
    label: "Jobs", 
    icon: Briefcase,
    roles: ["super_admin", "admin", "operations"]
  },
  { 
    href: "/admin/applications", 
    label: "Applications", 
    icon: FileText,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  { 
    href: "/admin/contacts", 
    label: "Contacts", 
    icon: Mail,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  { 
    href: "/admin/users", 
    label: "Team", 
    icon: Users,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: FileText,
    roles: ["super_admin", "admin"]
  },
];

const hrPortalMenu = [
  {
    href: "/admin/hr",
    label: "My Dashboard",
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/attendance",
    label: "Attendance",
    icon: Clock,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/leaves",
    label: "Leave Management",
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
    href: "/admin/hr/profile",
    label: "My Profile",
    icon: UserCircle,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/tickets",
    label: "Tickets",
    icon: Ticket,
    roles: ["super_admin", "admin", "hr", "operations", "manager", "employee"]
  },
  {
    href: "/admin/hr/team-attendance",
    label: "Team Attendance",
    icon: Clock,
    roles: ["super_admin", "admin", "hr", "manager"]
  },
  {
    href: "/admin/hr/leave-approvals",
    label: "Leave Approvals",
    icon: CalendarCheck,
    roles: ["super_admin", "admin", "hr", "manager"]
  },
  {
    href: "/admin/hr/org-chart",
    label: "Org Chart",
    icon: Network,
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

  const filteredRecruitment = recruitmentMenu.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredHR = hrPortalMenu.filter(item => 
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

            <SidebarGroup>
              <SidebarGroupLabel>Recruitment</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredRecruitment.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        data-testid={`nav-admin-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>HR Portal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredHR.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        data-testid={`nav-hr-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                      >
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

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
