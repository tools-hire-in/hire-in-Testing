import { Link, useLocation } from "wouter";
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
  Ticket,
  Settings,
  Network,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    roles: ["super_admin", "admin", "hr", "operations"]
  },
  { 
    href: "/admin/contacts", 
    label: "Contacts", 
    icon: Mail,
    roles: ["super_admin", "admin", "hr", "operations"]
  },
  { 
    href: "/admin/users", 
    label: "Team", 
    icon: Users,
    roles: ["super_admin"]
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
  const [location] = useLocation();
  const { user, logout } = useAuth();

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

          <main className="flex-1 overflow-auto p-6 bg-muted/20">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
