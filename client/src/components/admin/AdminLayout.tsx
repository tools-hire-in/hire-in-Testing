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

// Define menu items with role access
const allMenuItems = [
  { 
    href: "/admin", 
    label: "Dashboard", 
    icon: LayoutDashboard,
    roles: ["super_admin", "admin", "hr", "operations", "employee"]
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
    roles: ["super_admin", "admin", "hr"]
  },
  { 
    href: "/admin/contacts", 
    label: "Contacts", 
    icon: Mail,
    roles: ["super_admin", "admin", "hr"]
  },
  { 
    href: "/admin/users", 
    label: "Team", 
    icon: Users,
    roles: ["super_admin"]
  },
];

// Role display labels
const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-primary text-primary-foreground" },
  admin: { label: "Admin", color: "bg-blue-500 text-white" },
  hr: { label: "HR", color: "bg-green-500 text-white" },
  operations: { label: "Operations", color: "bg-orange-500 text-white" },
  employee: { label: "Employee", color: "bg-gray-500 text-white" },
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Filter menu items based on user role
  const menuItems = allMenuItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const isActive = (href: string) => {
    if (href === "/admin") {
      return location === "/admin";
    }
    return location.startsWith(href);
  };

  const roleInfo = user?.role ? roleLabels[user.role] : roleLabels.employee;

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
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
                <span className="text-xs text-muted-foreground">Dashboard</span>
              </div>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {/* User Info */}
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
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.href)}
                        data-testid={`nav-admin-${item.label.toLowerCase()}`}
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
          {/* Top Bar */}
          <header className="flex items-center justify-between h-14 px-4 border-b bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <nav className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>Admin</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium capitalize">
                  {location.split("/").pop() || "Dashboard"}
                </span>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {roleInfo.label}
              </Badge>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6 bg-muted/20">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
