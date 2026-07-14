import { AnnouncementModal } from "@/components/AnnouncementModal";
import { Link, useLocation } from "wouter";
import { useCallback, useEffect, useState, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePendingRegularizationCount } from "@/hooks/use-pending-regularizations";
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
  Palette,
  GraduationCap,
  AlertTriangle,
  ShieldAlert,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
  HelpCircle,
  Clock,
  ArrowRight,
  CalendarOff,
  MessageCircle,
  FileText,
  ClipboardList,
  Newspaper,
  Inbox,
  Megaphone,
  ShieldCheck,
  CalendarDays,
  Clapperboard,
  ClipboardCheck,
  BarChart3,
  BookOpen,
  Radio,
  LifeBuoy,
  Monitor,
  Headphones,
  Calculator,
  Wrench,
  Sparkles,
  ChevronDown,
  Wallet,
  CalendarCheck,
  FilePlus,
  UserCog,
  Receipt,
  KeyRound,
  DollarSign,
  ArrowUpRight,
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
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useNewLook } from "@/hooks/use-new-look";
import { useToast } from "@/hooks/use-toast";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useStudioV2 } from "@/hooks/use-studio-v2";
import { StudioShell } from "@/components/studio/StudioShell";
import { STUDIO_BASE } from "@/lib/studioBase";
import { useSopAccess } from "@/hooks/use-sop-access";
import { usePermissions } from "@/hooks/use-permissions";
import { COMPANY } from "@/lib/constants";
import { NotificationBell } from "@/components/NotificationBell";
import logoImage from "@assets/HS_logo_500_1769977401589.jpg";

// Context to detect nested AdminLayout (tab rendering)
export const AdminLayoutMounted = createContext(false);

const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: "Super Admin", color: "bg-primary text-primary-foreground" },
  admin: { label: "Admin", color: "bg-blue-500 text-white" },
  hr: { label: "HR", color: "bg-green-500 text-white" },
  finance: { label: "Finance", color: "bg-amber-500 text-white" },
  operations: { label: "Operations", color: "bg-orange-500 text-white" },
  manager: { label: "Manager", color: "bg-purple-500 text-white" },
  recruiter: { label: "Recruiter", color: "bg-cyan-500 text-white" },
  employee: { label: "Employee", color: "bg-gray-500 text-white" },
  executive: { label: "Executive", color: "bg-teal-600 text-white" },
};

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: number;
  badgeColor?: string;
  regCount?: number;
  gated?: boolean;
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

const MY_DESK_SUB_ITEMS = [
  { label: "Dashboard", tab: null, icon: LayoutDashboard },
  { label: "Attendance", tab: "time-card", icon: Clock },
  { label: "Leaves", tab: "leave-balance", icon: Wallet },
  { label: "Holiday Calendar", tab: "leave-calendar", icon: CalendarDays },
  { label: "Payslips", tab: "payslips", icon: Receipt },
  { label: "My SOPs", tab: "my-sops", icon: ShieldCheck, sopOnly: true },
] as const;

const GRACE_ROLES = ["hr", "admin", "super_admin", "manager"];

function CommandCenterSection({
  isNavActive,
  isComplianceLocked,
  location,
  myDeskBadge,
  serviceDeskBadge,
  canSeeGrace,
  hasSopAccess,
  myPendingRegCount,
}: {
  isNavActive: (item: NavItem) => boolean;
  isComplianceLocked: boolean;
  location: string;
  myDeskBadge: number;
  serviceDeskBadge: number;
  canSeeGrace: boolean;
  hasSopAccess: boolean;
  myPendingRegCount: number;
}) {
  const { open } = useSidebar();

  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_cc_section_open");
      if (stored === null) return location.startsWith("/admin/my-desk") || location.startsWith("/admin/service-desk");
      return stored !== "false";
    } catch { return true; }
  });

  useEffect(() => {
    if ((location.startsWith("/admin/my-desk") || location.startsWith("/admin/service-desk")) && !expanded) {
      setExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("admin_cc_section_open", String(next)); } catch {}
  };

  const serviceDeskItem: NavItem = { href: "/admin/service-desk", label: "Service Desk", icon: Headphones, roles: [], badge: serviceDeskBadge > 0 ? serviceDeskBadge : undefined, badgeColor: "bg-blue-500" };

  const isCCActive = location.startsWith("/admin/my-desk") || location.startsWith("/admin/service-desk");
  const isMyDeskActive = location.startsWith("/admin/my-desk");

  // Determine active sub-item
  const activeTab = (() => {
    try { return new URLSearchParams(window.location.search).get("tab"); } catch { return null; }
  })();

  const isSubItemActive = (tab: string | null) => {
    if (!isMyDeskActive) return false;
    if (tab === null) return !activeTab;
    return activeTab === tab;
  };

  if (!open) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isCCActive} tooltip="My Desk">
                <Link href="/admin/my-desk">
                  <Monitor className="h-4 w-4 shrink-0" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isNavActive(serviceDeskItem)} tooltip="Service Desk" className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}>
                <Link href="/admin/service-desk">
                  <Headphones className="h-4 w-4 shrink-0" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase hover:text-muted-foreground transition-colors"
        data-testid="button-cc-section-toggle"
      >
        <span className="flex items-center gap-1.5">
          <Monitor className="h-3 w-3" />
          Command Center
        </span>
        <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <SidebarGroupContent>
          <SidebarMenu>
            {/* My Desk parent link + sub-items */}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isMyDeskActive && !activeTab}
                data-testid="nav-item-my-desk"
              >
                <Link href="/admin/my-desk" className="flex items-center gap-2 w-full">
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  <span className="flex-1">My Desk</span>
                  {myDeskBadge > 0 && (
                    <span className="ml-auto text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-white bg-amber-500">
                      {myDeskBadge > 9 ? "9+" : myDeskBadge}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* My Desk sub-nav — 5 items */}
            <div className="ml-3 pl-3 border-l border-border/60 space-y-0.5 mb-1">
              {MY_DESK_SUB_ITEMS.filter((i) =>
                (!("sopOnly" in i && i.sopOnly) || hasSopAccess)
              ).map(({ label, tab, icon: Icon }) => {
                const href = tab ? `/admin/my-desk?tab=${tab}` : "/admin/my-desk";
                const isActive = isSubItemActive(tab as string | null);
                // My SOPs stays reachable even when compliance-locked so the user
                // can complete/acknowledge the SOPs that drive the lock.
                const locked = isComplianceLocked && tab !== null && tab !== "my-sops";
                // Badge on the Attendance entry for the user's own pending corrections.
                const attBadge = tab === "time-card" && myPendingRegCount > 0 ? myPendingRegCount : null;

                if (locked) {
                  return (
                    <button
                      key={label}
                      disabled
                      className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs text-muted-foreground/40 cursor-not-allowed"
                      data-testid={`nav-mydesk-sub-${tab}`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span>{label}</span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={label}
                    href={href}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs transition-colors ${
                      isActive
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                    data-testid={`nav-mydesk-sub-${tab ?? "dashboard"}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {attBadge && (
                      <span className="ml-auto text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-white bg-orange-500">
                        {attBadge > 9 ? "9+" : attBadge}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* My Vault — always visible, links to /admin/my-vault */}
              <Link
                href="/admin/my-vault"
                className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs transition-colors ${
                  location.startsWith("/admin/my-vault")
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
                data-testid="nav-mydesk-sub-my-vault"
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">My Vault</span>
              </Link>
            </div>

            {/* Service Desk */}
            <NavItemButton
              item={serviceDeskItem}
              isActive={isNavActive(serviceDeskItem)}
              isLocked={isComplianceLocked}
            />
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

const MY_TEAM_SUB_ITEMS = [
  { label: "Team", tab: null, icon: Users },
  { label: "Attendance", tab: "attendance", icon: Clock },
  { label: "Leave Approvals", tab: "leave-approvals", icon: CalendarCheck },
  { label: "Training", tab: "training-progress", icon: GraduationCap },
  { label: "Month Approval", tab: "attendance-approval", icon: ClipboardCheck },
  { label: "Req. Approvals", tab: "approvals", icon: ClipboardList },
  { label: "SOP Compliance", tab: "sop-compliance", icon: ShieldCheck, sopOnly: true },
] as const;

const NEW_HIRE_SUB_ITEMS = [
  { label: "New Offer Letter", tab: "new-offer-letter", icon: FilePlus },
  { label: "Letters", tab: null, icon: FileText },
  { label: "Onboarding", tab: "onboarding", icon: Users },
  { label: "Users", tab: "users", icon: UserCog },
] as const;

function TeamSection({
  hasTeamAccess,
  hasNewHireAccess,
  hasSopAccess,
  isNavActive,
  isComplianceLocked,
  location,
  myTeamBadge,
  leaveApprovalsCount,
  trainingReqBadge,
  pendingRegCount,
  pendingOfferCount,
}: {
  hasTeamAccess: boolean;
  hasNewHireAccess: boolean;
  hasSopAccess: boolean;
  isNavActive: (item: NavItem) => boolean;
  isComplianceLocked: boolean;
  location: string;
  myTeamBadge: number;
  leaveApprovalsCount: number;
  trainingReqBadge: number;
  pendingRegCount: number;
  pendingOfferCount: number;
}) {
  const { open } = useSidebar();

  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_team_section_open");
      if (stored === null) return location.startsWith("/admin/hr/my-team") || location.startsWith("/admin/new-hire");
      return stored !== "false";
    } catch { return true; }
  });

  useEffect(() => {
    if ((location.startsWith("/admin/hr/my-team") || location.startsWith("/admin/new-hire")) && !expanded) {
      setExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("admin_team_section_open", String(next)); } catch {}
  };

  if (!hasTeamAccess && !hasNewHireAccess) return null;

  const newHireItem: NavItem = { href: "/admin/new-hire", label: "New Hire", icon: UserPlus, roles: [] };

  const isMyTeamActive = location.startsWith("/admin/hr/my-team");

  // Resolve the active section from ?tab=, normalizing legacy nested aliases.
  const activeTab = (() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "exception-review") return "exceptions";
      if (t === "team-attendance") return "attendance";
      return t;
    } catch { return null; }
  })();

  const isSubItemActive = (tab: string | null) => {
    if (!isMyTeamActive) return false;
    // The "Team" destination owns the default view plus MyTeam's own internal tabs.
    if (tab === null) return !activeTab || activeTab === "overview" || activeTab === "corrections" || activeTab === "plans";
    return activeTab === tab;
  };

  const subBadge = (tab: string | null): { count: number; color: string } | null => {
    if (tab === "leave-approvals" && leaveApprovalsCount > 0) return { count: leaveApprovalsCount, color: "bg-blue-500" };
    if (tab === "training-progress" && trainingReqBadge > 0) return { count: trainingReqBadge, color: "bg-amber-500" };
    if (tab === null && pendingRegCount > 0) return { count: pendingRegCount, color: "bg-orange-500" };
    return null;
  };

  const isNewHireActive = location.startsWith("/admin/new-hire");

  const isNewHireSubActive = (tab: string | null) => {
    if (!isNewHireActive) return false;
    // The "Letters" destination owns the default view (incl. legacy "offer-letters" alias).
    if (tab === null) return !activeTab || activeTab === "offer-letters";
    return activeTab === tab;
  };

  const newHireSubBadge = (tab: string | null): { count: number; color: string } | null => {
    if (tab === null && pendingOfferCount > 0) return { count: pendingOfferCount, color: "bg-[#F47C20]" };
    return null;
  };

  if (!open) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {hasTeamAccess && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isMyTeamActive} tooltip="My Team" className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}>
                  <Link href="/admin/hr/my-team">
                    <Users className="h-4 w-4 shrink-0" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {hasNewHireAccess && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isNavActive(newHireItem)} tooltip="New Hire" className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}>
                  <Link href="/admin/new-hire">
                    <UserPlus className="h-4 w-4 shrink-0" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase hover:text-muted-foreground transition-colors"
        data-testid="button-team-section-toggle"
      >
        <span className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          Team
        </span>
        <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
      </button>
      {expanded && (
        <SidebarGroupContent>
          <SidebarMenu>
            {hasTeamAccess && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isSubItemActive(null)}
                    className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                    data-testid="nav-item-my-team"
                  >
                    <Link href="/admin/hr/my-team" className="flex items-center gap-2 w-full">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="flex-1">My Team</span>
                      {myTeamBadge > 0 && (
                        <span className="ml-auto text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-white bg-blue-500">
                          {myTeamBadge > 9 ? "9+" : myTeamBadge}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* My Team sub-nav — single level, replaces in-page nested tabs */}
                <div className="ml-3 pl-3 border-l border-border/60 space-y-0.5 mb-1">
                  {MY_TEAM_SUB_ITEMS.filter((i) =>
                    !("sopOnly" in i && i.sopOnly) || hasSopAccess
                  ).map(({ label, tab, icon: Icon }) => {
                    const href = tab ? `/admin/hr/my-team?tab=${tab}` : "/admin/hr/my-team";
                    const isActive = isSubItemActive(tab as string | null);
                    const badge = subBadge(tab as string | null);
                    return (
                      <Link
                        key={label}
                        href={href}
                        className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs transition-colors ${
                          isActive
                            ? "bg-accent text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                        } ${isComplianceLocked ? "opacity-40 pointer-events-none" : ""}`}
                        data-testid={`nav-myteam-sub-${tab ?? "team"}`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span className={`ml-auto text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-white ${badge.color}`}>
                            {badge.count > 9 ? "9+" : badge.count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            {hasNewHireAccess && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isNewHireSubActive(null)}
                    className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                    data-testid="nav-item-new-hire"
                  >
                    <Link href="/admin/new-hire" className="flex items-center gap-2 w-full">
                      <UserPlus className="h-4 w-4 shrink-0" />
                      <span className="flex-1">New Hire</span>
                      {pendingOfferCount > 0 && (
                        <span className="ml-auto text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-white bg-[#F47C20]">
                          {pendingOfferCount > 9 ? "9+" : pendingOfferCount}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {/* New Hire sub-nav — single level, replaces in-page horizontal tabs */}
                <div className="ml-3 pl-3 border-l border-border/60 space-y-0.5 mb-1">
                  {NEW_HIRE_SUB_ITEMS.map(({ label, tab, icon: Icon }) => {
                    const href = tab ? `/admin/new-hire?tab=${tab}` : "/admin/new-hire";
                    const isActive = isNewHireSubActive(tab as string | null);
                    const badge = newHireSubBadge(tab as string | null);
                    return (
                      <Link
                        key={label}
                        href={href}
                        className={`flex items-center gap-2 w-full px-2 py-1 rounded-md text-xs transition-colors ${
                          isActive
                            ? "bg-accent text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                        } ${isComplianceLocked ? "opacity-40 pointer-events-none" : ""}`}
                        data-testid={`nav-newhire-sub-${tab ?? "letters"}`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span className={`ml-auto text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-white ${badge.color}`}>
                            {badge.count > 9 ? "9+" : badge.count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

function ContentStudioSection({
  hasStudioAccess,
  hasMarketingApproveAccess,
  hasStudioAnalyticsAccess,
  hasCmReviewAccess,
  hasManageAuthorsAccess,
  isSuperAdmin,
  isNavActive,
  isComplianceLocked,
  location,
  cmReviewCount,
}: {
  hasStudioAccess: boolean;
  hasMarketingApproveAccess: boolean;
  hasStudioAnalyticsAccess: boolean;
  hasCmReviewAccess: boolean;
  hasManageAuthorsAccess: boolean;
  isSuperAdmin: boolean;
  isNavActive: (item: NavItem) => boolean;
  isComplianceLocked: boolean;
  location: string;
  cmReviewCount: number;
}) {
  const { open } = useSidebar();
  const { isEnabled } = useFeatureFlags();
  const studioV2Enabled = isEnabled("studio_v2_enabled");

  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_studio_section_open");
      if (stored === null) return location.startsWith("/admin/studio");
      return stored !== "false";
    } catch { return false; }
  });

  useEffect(() => {
    if (location.startsWith("/admin/studio") && !expanded) {
      setExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("admin_studio_section_open", String(next)); } catch {}
  };

  if (!hasStudioAccess) return null;

  if (studioV2Enabled) {
    if (!open) {
      return (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Open Studio"
                  className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                >
                  <a href="/studio" target="_blank" rel="noopener noreferrer">
                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }
    return (
      <SidebarGroup>
        <div className="px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
          Content Studio
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                data-testid="nav-item-open-studio"
              >
                <a href="/studio" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full">
                  <ArrowUpRight className="h-4 w-4 shrink-0" />
                  <span className="flex-1">Open Studio</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const studioSubItems: NavItem[] = [
    { href: "/admin/studio", label: "Dashboard", icon: LayoutDashboard, roles: [] },
    { href: "/admin/studio/articles", label: "Articles", icon: Newspaper, roles: [] },
    { href: "/admin/studio/live", label: "Live Content", icon: Radio, roles: [] },
    { href: "/admin/studio/inbox", label: "Reviewer Inbox", icon: Inbox, roles: [] },
    ...(hasCmReviewAccess ? [{ href: "/admin/studio/cm-review", label: "CM Review", icon: BookOpen, roles: [] }] : []),
    ...(hasMarketingApproveAccess ? [{ href: "/admin/studio/approvals", label: "Marketing Approvals", icon: Megaphone, roles: [] }] : []),
    ...(isSuperAdmin ? [{ href: "/admin/studio/final-approval", label: "Final Sign-Off", icon: ShieldCheck, roles: [] }] : []),
    { href: "/admin/studio/calendar", label: "Publishing Calendar", icon: CalendarDays, roles: [] },
    ...(hasStudioAnalyticsAccess ? [{ href: "/admin/studio/analytics", label: "Content Analytics", icon: BarChart3, roles: [] }] : []),
    { href: "/admin/studio/authors", label: "Authors", icon: Users, roles: [] },
    ...(hasManageAuthorsAccess ? [{ href: "/admin/studio/access", label: "Studio Access", icon: ShieldCheck, roles: [] }] : []),
    { href: "/admin/studio/brand-kit", label: "Brand Kit", icon: Palette, roles: [] },
  ];

  const isStudioActive = location.startsWith("/admin/studio");

  if (!open) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isStudioActive}
                tooltip="Content Studio"
                className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
              >
                <Link href="/admin/studio/articles">
                  <Newspaper className="h-4 w-4 shrink-0" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase hover:text-muted-foreground transition-colors"
        data-testid="button-studio-section-toggle"
      >
        <span>Content Studio</span>
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <SidebarGroupContent>
          <SidebarMenu>
            {studioSubItems.map((item) => {
              const isCmReview = item.href === "/admin/studio/cm-review";
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(item)}
                    className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                    data-testid={`nav-item-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.href} className="flex items-center gap-2 w-full">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {isCmReview && cmReviewCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 rounded-full px-1 text-[10px]">
                          {cmReviewCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

function PayrollSection({
  hasPayrollAccess,
  userRole,
  isNavActive,
  isComplianceLocked,
  location,
}: {
  hasPayrollAccess: boolean;
  userRole: string;
  isNavActive: (item: NavItem) => boolean;
  isComplianceLocked: boolean;
  location: string;
}) {
  const { open } = useSidebar();

  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_payroll_section_open");
      if (stored === null) return location.startsWith("/admin/payroll");
      return stored !== "false";
    } catch { return false; }
  });

  useEffect(() => {
    if (location.startsWith("/admin/payroll") && !expanded) {
      setExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("admin_payroll_section_open", String(next)); } catch {}
  };

  if (!hasPayrollAccess) return null;

  const isExec = userRole === "executive";
  const isHRAdmin = ["super_admin", "admin", "hr"].includes(userRole);

  const payrollSubItems: NavItem[] = [
    { href: "/admin/payroll/executive", label: "Executive Summary", icon: BarChart3, roles: [] },
    ...(!isExec ? [{ href: "/admin/payroll/run", label: "Bulk Payroll Run", icon: DollarSign, roles: [] }] : []),
    ...(isHRAdmin || isExec ? [{ href: "/admin/payroll/setup", label: "Payroll Setup", icon: Settings, roles: [] }] : []),
  ];

  const isPayrollActive = location.startsWith("/admin/payroll");

  if (!open) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isPayrollActive}
                tooltip="Payroll Dashboard"
                className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
              >
                <Link href="/admin/payroll/executive">
                  <DollarSign className="h-4 w-4 shrink-0" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase hover:text-muted-foreground transition-colors"
        data-testid="button-payroll-section-toggle"
      >
        <span>Payroll</span>
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <SidebarGroupContent>
          <SidebarMenu>
            {payrollSubItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isNavActive(item)}
                  className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                  data-testid={`nav-item-${item.label.toLowerCase().replace(/[&\s]+/g, "-")}`}
                >
                  <Link href={item.href} className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

function SettingsSection({
  hasSettingsAccess,
  isNavActive,
  isComplianceLocked,
  location,
}: {
  hasSettingsAccess: boolean;
  isNavActive: (item: NavItem) => boolean;
  isComplianceLocked: boolean;
  location: string;
}) {
  const { open } = useSidebar();

  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem("admin_settings_section_open");
      if (stored === null) return location.startsWith("/admin/settings");
      return stored !== "false";
    } catch { return false; }
  });

  useEffect(() => {
    if (location.startsWith("/admin/settings") && !expanded) {
      setExpanded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try { localStorage.setItem("admin_settings_section_open", String(next)); } catch {}
  };

  if (!hasSettingsAccess) return null;

  const settingsSubItems: NavItem[] = [
    { href: "/admin/settings/leave-attendance", label: "Leave & Attendance", icon: CalendarDays, roles: [] },
    { href: "/admin/settings/organization", label: "Organization", icon: Briefcase, roles: [] },
  ];

  const isSettingsActive = location.startsWith("/admin/settings");

  if (!open) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isSettingsActive}
                tooltip="Settings"
                className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
              >
                <Link href="/admin/settings/leave-attendance">
                  <Settings className="h-4 w-4 shrink-0" />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <button
        onClick={toggleExpanded}
        className="flex items-center justify-between w-full px-2 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase hover:text-muted-foreground transition-colors"
        data-testid="button-settings-section-toggle"
      >
        <span>Settings</span>
        <ChevronRight
          className={`h-3 w-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <SidebarGroupContent>
          <SidebarMenu>
            {settingsSubItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isNavActive(item)}
                  className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                  data-testid={`nav-item-${item.label.toLowerCase().replace(/[&\s]+/g, "-")}`}
                >
                  <Link href={item.href} className="flex items-center gap-2 w-full">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
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
            {!open && item.regCount && item.regCount > 0 ? (
              <span
                className="absolute -bottom-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-1 ring-background"
                data-testid={`badge-nav-reg-dot-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                title={`${item.regCount} pending attendance correction${item.regCount === 1 ? "" : "s"}`}
              />
            ) : null}
          </div>
          <span className="flex-1 group-data-[collapsible=icon]:hidden">{item.label}</span>
          {open && item.regCount && item.regCount > 0 ? (
            <span
              className="ml-auto inline-flex items-center gap-1 text-xs font-bold rounded-full min-w-5 h-5 px-1.5 bg-orange-500 text-white"
              data-testid={`badge-nav-reg-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              title={`${item.regCount} pending attendance correction${item.regCount === 1 ? "" : "s"}`}
            >
              <ClipboardList className="h-3 w-3" />
              {item.regCount > 9 ? "9+" : item.regCount}
            </span>
          ) : null}
          {open && item.badge && item.badge > 0 ? (
            <span
              className={`${item.regCount && item.regCount > 0 ? "ml-1" : "ml-auto"} text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center text-white ${item.badgeColor || "bg-red-500"}`}
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
  const [location] = useLocation();
  const { enabled: studioV2 } = useStudioV2();

  // If already inside an AdminLayout (nested tab rendering), just render children
  if (alreadyMounted) {
    return <>{children}</>;
  }

  // Studio T1 (Task #906): under /studio with the flag ON, existing Studio
  // pages (which wrap themselves in AdminLayout) render inside the standalone
  // StudioShell instead of the HR-portal sidebar chrome.
  if (studioV2 && (location === "/studio" || location.startsWith("/studio/"))) {
    return (
      <AdminLayoutMounted.Provider value={true}>
        <StudioShell>{children}</StudioShell>
      </AdminLayoutMounted.Provider>
    );
  }

  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

function AdminLayoutInner({ children }: AdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { isEnabled } = useFeatureFlags();
  const { enabled: hasSopAccess } = useSopAccess();
  const { can } = usePermissions();
  const SOP_REVIEWER_ROLES = ["super_admin", "admin", "hr", "operations", "manager"];
  const hasSopReviewAccess = hasSopAccess && SOP_REVIEWER_ROLES.includes(user?.role ?? "");
  const { enabled: newLook, available: newLookAvailable, setEnabled: setNewLook, isPending: newLookPending } = useNewLook();
  const { toast } = useToast();
  const notificationsEnabled = isEnabled("notifications_enabled");
  const studioV2Enabled = isEnabled("studio_v2_enabled");

  const enableNewLook = useCallback(() => {
    setNewLook(true);
    toast({
      title: "New look enabled (beta)",
      description: "You're previewing the redesigned portal. Switch back anytime from your profile menu.",
    });
  }, [setNewLook, toast]);

  const disableNewLook = useCallback(() => {
    setNewLook(false);
    toast({
      title: "Classic look restored",
      description: "You're back on the classic portal layout.",
    });
  }, [setNewLook, toast]);

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

  // App tour
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (!user) return;
    try {
      const seen = localStorage.getItem("hr_portal_tour_seen");
      if (!seen) {
        setShowTour(true);
        localStorage.setItem("hr_portal_tour_seen", "1");
      }
    } catch {}
  }, [user?.id]);

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
    location.startsWith("/admin/growth") ||
    location === "/admin/my-desk"; // Command Center overview stays accessible when compliance-locked
  const isOnPolicyGatePage = location === "/admin/policy-gate";

  const userNeeds2FASetup = user && !user.totpEnabled;

  const POLICY_GATE_EXEMPT: string[] = [];
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

  // Guided onboarding (Task #630): signing policies is self-paced and never
  // forced. The policy gate remains reachable from the dashboard checklist, but
  // we no longer hard-redirect new hires there — Punch In/Out and navigation
  // must stay unblocked.

  // Onboarding checklist counts drive unobtrusive nav badges.
  const { data: onboardingChecklist } = useQuery<{
    complete: boolean;
    counts: { personal: number; policies: number; total: number };
  }>({
    queryKey: ["/api/onboarding/checklist"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/checklist", { credentials: "include" });
        if (!res.ok) return { complete: true, counts: { personal: 0, policies: 0, total: 0 } };
        return res.json();
      } catch {
        return { complete: true, counts: { personal: 0, policies: 0, total: 0 } };
      }
    },
    refetchInterval: 300000,
    enabled: !!user,
  });
  const onboardingPersonalBadge = onboardingChecklist?.counts?.personal ?? 0;
  const onboardingPolicyBadge = onboardingChecklist?.counts?.policies ?? 0;

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

  // My own pending leave requests — badge on My Desk sidebar item
  const { data: myPendingLeavesCount } = useQuery<number>({
    queryKey: ["/api/hr/leave-requests/my", "pending-sidebar-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/leave-requests/my", { credentials: "include" });
        if (!res.ok) return 0;
        const data = await res.json();
        return Array.isArray(data) ? data.filter((r: any) => r.status === "pending").length : 0;
      } catch { return 0; }
    },
    refetchInterval: 120000,
    enabled: !!user,
  });

  // Service Desk open requests count — badge on Service Desk sidebar item
  const { data: serviceDeskOpenCount } = useQuery<number>({
    queryKey: ["/api/service-desk/open-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/service-desk/open-count", { credentials: "include" });
        if (!res.ok) return 0;
        const data = await res.json();
        return typeof data?.count === "number" ? data.count : 0;
      } catch { return 0; }
    },
    refetchInterval: 120000,
    enabled: !!user,
    staleTime: 60000,
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

  const hasRecruitmentAccess = ["super_admin", "admin", "operations", "manager", "recruiter"].includes(userRole) && can("admin.jobs");
  const hasTeamAccess = ["super_admin", "admin", "hr", "operations", "manager"].includes(userRole) && can("admin.myTeam.members");
  const hasHRAccess = ["super_admin", "admin", "hr"].includes(userRole) && can("hr.users");
  const hasNewHireAccess = ["super_admin", "admin", "hr", "operations", "manager"].includes(userRole) && can("hr.newHire.onboardingStatus");
  const hasFinanceAccess = ["super_admin", "admin", "finance"].includes(userRole) && can("hr.reports.salary.runs");
  const hasPayrollAccess = can("payroll.executiveDashboard");
  const hasHelpDeskAccess = ["super_admin", "admin", "hr", "operations"].includes(userRole) && can("helpDesk.queue");
  const hasStudioAccess = can("studio.view");
  const hasMarketingApproveAccess = can("studio.marketing_approve");
  const hasStudioAnalyticsAccess = can("studio.view_analytics");
  const hasManageAuthorsAccess = can("studio.manage_authors");
  const hasCmReviewAccess = can("studio.cm_review");
  const isSuperAdmin = userRole === "super_admin";

  const { data: cmReviewCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/studio/cm-review/count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/studio/cm-review/count", { credentials: "include" });
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { return { count: 0 }; }
    },
    enabled: hasCmReviewAccess,
    refetchInterval: 60000,
  });
  const cmReviewCount = cmReviewCountData?.count ?? 0;
  const hasGrowthAccess = trainingEnabled || perfEnabled || isComplianceLocked;

  // Training + perf badge total for My Growth
  const growthBadge = (trainingAlerts?.total ?? 0) + (perfAlerts?.total ?? 0);

  // Training requests actionable count (for manager/hr/admin/super_admin sidebar badge)
  const isTrainingRequestRole = ["super_admin", "manager", "hr", "admin"].includes(userRole);
  const { data: trainingRequestsCount } = useQuery<{ actionable: number }>({
    queryKey: ["/api/onboarding/training-requests/count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/onboarding/training-requests/count", { credentials: "include" });
        if (!res.ok) return { actionable: 0 };
        return res.json();
      } catch { return { actionable: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user && isTrainingRequestRole,
  });
  const trainingReqBadge = (trainingRequestsCount?.actionable ?? 0);

  // Pending regularization (attendance correction) requests for the team (badge in My Team sidebar)
  const pendingRegCount = usePendingRegularizationCount(
    !!user && ["manager", "hr", "admin", "super_admin", "operations"].includes(user?.role || "")
  );

  // Current user's own pending correction requests — badge on Attendance sub-item in My Desk
  const { data: myOwnRegData } = useQuery<{ status: string }[]>({
    queryKey: ["/api/hr/attendance/regularization/my", "sidebar-badge"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/attendance/regularization/my", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch { return []; }
    },
    refetchInterval: 60000,
    staleTime: 60000,
    enabled: !!user,
  });
  const myPendingRegCount = (myOwnRegData || []).filter((r) => r.status === "pending").length;

  // Pending offer letters awaiting approval (New Hire > Letters badge)
  const hasNewHireSidebarAccess = ["super_admin", "admin", "hr", "operations", "manager"].includes(userRole) && can("hr.newHire.onboardingStatus");
  const { data: offerLettersForBadge } = useQuery<any[]>({
    queryKey: ["/api/hr/tools/offer-letters"],
    refetchInterval: 60000,
    enabled: !!user && hasNewHireSidebarAccess,
  });
  const pendingOfferCount = offerLettersForBadge?.filter((l: any) => l.status === "pending_approval").length ?? 0;

  // Combined My Team badge: leave approvals + training requests.
  // Pending regularizations get their own distinct indicator on the Team sub-item
  // so they appear/disappear independently of leave/training signals.
  const myTeamBadge = (leaveApprovalsCount ?? 0) + trainingReqBadge;

  // Training-request management moved to Growth & Learning → Training Mgmt, so its
  // actionable badge now surfaces on the Growth nav item (see growthBadge usage).
  const peopleHRTrainingBadge = ["hr", "admin", "super_admin"].includes(userRole) ? trainingReqBadge : 0;
  // People & HR badge: endorsements only.
  const peopleHRBadge = (pendingEndorseCount ?? 0);

  // HIRD open ticket badge for resolver roles
  const { data: hirdOpenData } = useQuery<{ count: number }>({
    queryKey: ["/api/help-desk/open-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/help-desk/open-count", { credentials: "include" });
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { return { count: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user && ["super_admin", "admin", "hr", "operations"].includes(user?.role || ""),
  });
  const hirdOpenCount = hirdOpenData?.count ?? 0;

  // Salary report pending approval badge (admin/super_admin only)
  const { data: salaryRunPending } = useQuery<{ count: number }>({
    queryKey: ["/api/hr/reports/salary/runs/pending-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/reports/salary/runs/pending-count", { credentials: "include" });
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { return { count: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user && ["admin", "super_admin"].includes(user?.role || ""),
  });
  const salaryPendingCount = salaryRunPending?.count ?? 0;

  // Control Tower: communications awaiting approval (super-admin badge)
  const { data: commsHeld } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/communications/count"],
    refetchInterval: 60000,
    enabled: !!user && user?.role === "super_admin",
  });
  const commsHeldCount = commsHeld?.count ?? 0;

  // Salary advance pending approval badge (managers + final approver)
  const { data: salaryAdvanceStats } = useQuery<{ pendingManager: number; pendingFinal: number; active: number; pendingCeo?: number }>({
    queryKey: ["/api/salary-advances/stats"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/salary-advances/stats", { credentials: "include" });
        if (!res.ok) return { pendingManager: 0, pendingFinal: 0, active: 0, pendingCeo: 0 };
        return res.json();
      } catch { return { pendingManager: 0, pendingFinal: 0, active: 0, pendingCeo: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user && ["manager", "admin", "super_admin", "hr"].includes(user?.role || ""),
  });
  const salaryAdvanceBadge = (salaryAdvanceStats?.pendingManager ?? 0) + (salaryAdvanceStats?.pendingFinal ?? 0) + (salaryAdvanceStats?.pendingCeo ?? 0);

  // SOP review inbox pending count — badge on "My SOP Reviews" sidebar link
  const { data: sopReviewCountData } = useQuery<{ pending: number }>({
    queryKey: ["/api/sops/my-reviews/count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/sops/my-reviews/count", { credentials: "include" });
        if (!res.ok) return { pending: 0 };
        return res.json();
      } catch { return { pending: 0 }; }
    },
    refetchInterval: 120000,
    staleTime: 60000,
    enabled: !!user && hasSopReviewAccess,
  });
  const sopReviewPendingCount = sopReviewCountData?.pending ?? 0;

  // Manual salary-change requests awaiting Super-Admin approval (maker-checker)
  const { data: salaryChangePending } = useQuery<{ count: number }>({
    queryKey: ["/api/hr/salary-changes/pending-count"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/hr/salary-changes/pending-count", { credentials: "include" });
        if (!res.ok) return { count: 0 };
        return res.json();
      } catch { return { count: 0 }; }
    },
    refetchInterval: 60000,
    enabled: !!user && user?.role === "super_admin",
  });
  const salaryChangePendingCount = salaryChangePending?.count ?? 0;

  const personalNavItems: NavItem[] = [
    {
      href: "/admin/profile",
      label: "Profile",
      icon: UserCircle,
      roles: ["all"],
      badge: onboardingPersonalBadge > 0 ? onboardingPersonalBadge : undefined,
      badgeColor: "bg-amber-500",
    },
    ...(hasGrowthAccess ? [{
      href: "/admin/growth",
      label: "Growth & Learning",
      icon: GraduationCap,
      roles: ["all"],
      badge: (growthBadge + peopleHRTrainingBadge + onboardingPolicyBadge) > 0 ? (growthBadge + peopleHRTrainingBadge + onboardingPolicyBadge) : undefined,
      badgeColor: (trainingAlerts?.overdue ?? 0) > 0 ? "bg-red-500" : "bg-amber-500",
    }] : []),
    ...(isEnabled("salary_advance_enabled") ? [{
      href: "/admin/salary-advance",
      label: "Salary Advance",
      icon: Wallet,
      roles: ["all"],
      badge: salaryAdvanceBadge > 0 ? salaryAdvanceBadge : undefined,
      badgeColor: "bg-amber-500",
    }] : []),
  ];

  const orgNavItems: NavItem[] = [
    ...(userRole === "executive" ? [{
      href: "/admin/executive-cockpit",
      label: "Executive Cockpit",
      icon: LayoutDashboard,
      roles: ["executive"],
    }, {
      href: "/admin/service-desk",
      label: "Service Desk",
      icon: LifeBuoy,
      roles: ["executive"],
      badge: (serviceDeskOpenCount ?? 0) > 0 ? serviceDeskOpenCount : undefined,
      badgeColor: "bg-orange-500",
    }] : []),
    ...(hasRecruitmentAccess ? [{
      href: "/admin/recruitment",
      label: "Recruitment",
      icon: Briefcase,
      roles: ["super_admin", "admin", "operations", "manager", "recruiter"],
    }] : []),
    ...(userRole !== "executive" ? [{
      href: "/admin/travel-calculator",
      label: "Travel Calculator",
      icon: Calculator,
      roles: ["all"],
    }] : []),
    ...(hasHRAccess ? [{
      href: "/admin/hr/people",
      label: "People & HR",
      icon: Settings,
      roles: ["super_admin", "admin", "hr"],
      badge: (peopleHRBadge + salaryChangePendingCount) > 0 ? (peopleHRBadge + salaryChangePendingCount) : undefined,
      badgeColor: "bg-amber-500",
    }] : []),
    ...(hasHRAccess ? [{
      href: "/admin/hr/tools",
      label: "HR Tools",
      icon: Wrench,
      roles: ["super_admin", "admin", "hr"],
    }] : []),
    ...(hasHRAccess ? [{
      href: "/admin/communications",
      label: "Communications",
      icon: Megaphone,
      roles: ["super_admin", "admin", "hr"],
    }] : []),
    ...(hasSopAccess ? [{
      href: "/admin/sops",
      label: "SOPs",
      icon: ShieldCheck,
      roles: ["all"],
    }] : []),
    ...(hasSopReviewAccess ? [{
      href: "/admin/sops/my-reviews",
      label: "My SOP Reviews",
      icon: ClipboardCheck,
      roles: ["super_admin", "admin", "hr", "operations", "manager"],
      badge: sopReviewPendingCount > 0 ? sopReviewPendingCount : undefined,
      badgeColor: "bg-blue-500",
    }] : []),
    ...(hasSopAccess ? [{
      href: "/admin/sops/compliance",
      label: "SOP Governance",
      icon: ShieldCheck,
      roles: ["super_admin", "admin", "hr", "operations"],
    }] : []),
    ...(hasHRAccess ? [{
      href: "/admin/training/catalog",
      label: "SOP Training Catalog",
      icon: BookOpen,
      roles: ["super_admin", "admin", "hr"],
    }] : []),
    ...(hasFinanceAccess ? [{
      href: "/admin/finance",
      label: "Finance & Contracts",
      badge: salaryPendingCount > 0 ? salaryPendingCount : undefined,
      icon: FileText,
      roles: ["super_admin", "admin"],
    }] : []),
    // Payroll Dashboard is rendered as a dedicated PayrollSection (expandable) — not here
    ...(hasHelpDeskAccess ? [{
      href: "/admin/help-desk",
      label: "Help Desk",
      icon: LifeBuoy,
      badge: hirdOpenCount > 0 ? hirdOpenCount : undefined,
      badgeColor: "bg-orange-500",
      roles: ["super_admin", "admin", "hr", "operations"],
    }] : []),
    {
      href: "/admin/vault",
      label: "Systems Vault",
      icon: KeyRound,
      roles: ["all"],
    },
    ...(isSuperAdmin ? [{
      href: "/admin/control-tower",
      label: "Control Tower",
      icon: ShieldCheck,
      roles: ["super_admin"],
      badge: commsHeldCount > 0 ? commsHeldCount : undefined,
      badgeColor: "bg-amber-500",
    }] : userRole === "hr" ? [{
      href: "/admin/control-tower",
      label: "Data Maintenance",
      icon: Wrench,
      roles: ["hr"],
    }] : []),
  ];

  const isNavActive = (item: NavItem) => {
    const href = item.href;
    if (href === "/admin/my-desk") return location === "/admin/my-desk" || location.startsWith("/admin/my-desk");
    if (href === "/admin/service-desk") return location === "/admin/service-desk" || location.startsWith("/admin/service-desk");
    if (href === "/admin/profile") return location === "/admin/profile" || location.startsWith("/admin/profile");
    if (href === "/admin/growth") return location === "/admin/growth" || location.startsWith("/admin/growth") || location.startsWith("/admin/performance") || location.startsWith("/admin/hr/my-training");
    if (href === "/admin/salary-advance") return location === "/admin/salary-advance" || location.startsWith("/admin/salary-advance");
    if (href === "/admin/hr/my-team") return location === "/admin/hr/my-team" || location.startsWith("/admin/hr/my-team") || location.startsWith("/admin/hr/team-attendance") || location.startsWith("/admin/hr/leave-approvals") || location.startsWith("/admin/hr/training-progress");
    if (href === "/admin/recruitment") return location === "/admin/recruitment" || location.startsWith("/admin/recruitment") || location === "/admin" || location.startsWith("/admin/jobs") || location.startsWith("/admin/applications") || location.startsWith("/admin/contacts");
    if (href === "/admin/travel-calculator") return location.startsWith("/admin/travel-calculator");
    if (href === "/admin/communications") return location === "/admin/communications" || location.startsWith("/admin/communications");
    if (href === "/admin/new-hire") return location === "/admin/new-hire" || location.startsWith("/admin/new-hire");
    if (href === "/admin/hr/people") return location === "/admin/hr/people" || location.startsWith("/admin/hr/people") || location.startsWith("/admin/users") || location.startsWith("/admin/hr/reports");
    if (href === "/admin/hr/tools") return location === "/admin/hr/tools" || location.startsWith("/admin/hr/tools");
    if (href.startsWith("/admin/settings/")) return location === href || location.startsWith(href);
    if (href === "/admin/help-desk") return location === "/admin/help-desk" || location.startsWith("/admin/help-desk");
    if (href === "/admin/vault") return location === "/admin/vault" || location.startsWith("/admin/vault");
    if (href === "/admin/my-vault") return location === "/admin/my-vault" || location.startsWith("/admin/my-vault");
    if (href === "/admin/finance") return location === "/admin/finance" || location.startsWith("/admin/finance");
    if (href === "/admin/payroll/executive") return location.startsWith("/admin/payroll");
    if (href === "/admin/studio") return location === "/admin/studio";
    if (href === "/admin/studio/articles") return (location.startsWith("/admin/studio/articles") && !location.startsWith("/admin/studio/articles/") || /\/admin\/studio\/articles\/[^/]+\/edit/.test(location));
    if (href === "/admin/studio/live") return location.startsWith("/admin/studio/live");
    if (href === "/admin/studio/inbox") return location.startsWith("/admin/studio/inbox") || /\/admin\/studio\/articles\/[^/]+\/review/.test(location);
    if (href === "/admin/studio/cm-review") return location.startsWith("/admin/studio/cm-review");
    if (href === "/admin/studio/approvals") return location.startsWith("/admin/studio/approvals");
    if (href === "/admin/studio/final-approval") return location.startsWith("/admin/studio/final-approval");
    if (href === "/admin/automated-changes") return location.startsWith("/admin/automated-changes");
    if (href === "/admin/executive-cockpit") return location.startsWith("/admin/executive-cockpit");
    if (href === "/admin/control-tower") return location.startsWith("/admin/control-tower");
    if (href === "/admin/studio/calendar") return location.startsWith("/admin/studio/calendar");
    if (href === "/admin/studio/analytics") return location.startsWith("/admin/studio/analytics");
    if (href === "/admin/studio/authors") return location.startsWith("/admin/studio/authors");
    if (href === "/admin/sops/my-reviews") return location === "/admin/sops/my-reviews" || location.startsWith("/admin/sops/my-reviews");
    return location.startsWith(href);
  };

  const breadcrumbLabel = () => {
    if (location.startsWith("/admin/my-desk")) {
      try {
        const tab = new URLSearchParams(window.location.search).get("tab");
        const tabLabels: Record<string, string> = {
          "time-card": "Attendance",
          "leave-balance": "Leaves",
          "leave-calendar": "Holiday Calendar",
          "my-sops": "My SOPs",
        };
        return tab && tabLabels[tab] ? `My Desk — ${tabLabels[tab]}` : "My Desk";
      } catch { return "My Desk"; }
    }
    if (location.startsWith("/admin/service-desk")) return "Service Desk";
    if (location === "/admin/hr" || location.startsWith("/admin/hr")) {
      const path = location.replace("/admin/hr", "").replace(/^\//, "");
      if (!path) return "My Desk";
      return path.split("/").pop()?.replace(/-/g, " ") || "My Desk";
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
        <div className={`flex h-screen w-full ${newLook ? "app-v2" : ""}`} data-look={newLook ? "v2" : "classic"}>
          <Sidebar collapsible="icon">
            {/* Profile Header */}
            <SidebarHeader className="border-b p-0">
              <Link href="/admin/profile">
                <div className="flex items-center gap-3 p-3 hover:bg-accent rounded-none transition-colors cursor-pointer" data-testid="nav-profile-header">
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center font-semibold text-primary text-sm shrink-0">
                    {user?.firstName?.[0] || "?"}{user?.lastName?.[0] || ""}
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
              {/* COMMAND CENTER — My Desk + Service Desk (hidden for executive; they get a standalone Service Desk item) */}
              {userRole !== "executive" && (
                <CommandCenterSection
                  isNavActive={isNavActive}
                  isComplianceLocked={isComplianceLocked}
                  location={location}
                  myDeskBadge={myPendingLeavesCount ?? 0}
                  serviceDeskBadge={serviceDeskOpenCount ?? 0}
                  canSeeGrace={GRACE_ROLES.includes(user?.role || "")}
                  hasSopAccess={hasSopAccess}
                  myPendingRegCount={myPendingRegCount}
                />
              )}

              {/* PERSONAL section — visible to all */}
              <SidebarGroup>
                <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase px-2 pt-3 pb-1 group-data-[collapsible=icon]:hidden">
                  Personal
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {personalNavItems.map((item) => (
                      <NavItemButton
                        key={item.href}
                        item={item}
                        isActive={isNavActive(item)}
                        isLocked={isComplianceLocked && item.href !== "/admin/growth" && item.href !== "/admin/profile"}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* TEAM — collapsible section with single-level sub-pages */}
              <TeamSection
                hasTeamAccess={hasTeamAccess}
                hasNewHireAccess={hasNewHireAccess}
                hasSopAccess={hasSopAccess}
                isNavActive={isNavActive}
                isComplianceLocked={isComplianceLocked}
                location={location}
                myTeamBadge={myTeamBadge}
                leaveApprovalsCount={leaveApprovalsCount ?? 0}
                trainingReqBadge={trainingReqBadge}
                pendingRegCount={pendingRegCount}
                pendingOfferCount={pendingOfferCount}
              />

              {/* ORGANISATION section — only visible to super_admin, admin, hr */}
              {orgNavItems.length > 0 && ["super_admin", "admin", "hr"].includes(user?.role ?? "") && (
                <SidebarGroup>
                  <SidebarGroupLabel className="text-[10px] font-semibold tracking-widest text-muted-foreground/60 uppercase px-2 pt-3 pb-1 group-data-[collapsible=icon]:hidden">
                    Organisation
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {orgNavItems.map((item) => (
                        <NavItemButton
                          key={item.href}
                          item={item}
                          isActive={isNavActive(item)}
                          isLocked={isComplianceLocked && item.href !== "/admin/growth" && item.href !== "/admin/profile"}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}

              {/* CONTENT STUDIO — collapsible section (classic) or a single
                  "Open Studio" launcher when the standalone shell is enabled */}
              {studioV2Enabled && hasStudioAccess ? (
                <SidebarGroup>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          tooltip="Open Studio"
                          className={isComplianceLocked ? "opacity-40 pointer-events-none" : ""}
                        >
                          <Link href={STUDIO_BASE} data-testid="nav-open-studio">
                            <Clapperboard className="h-4 w-4 shrink-0" />
                            <span className="group-data-[collapsible=icon]:hidden">Open Studio ↗</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ) : (
                <ContentStudioSection
                  hasStudioAccess={hasStudioAccess}
                  hasMarketingApproveAccess={hasMarketingApproveAccess}
                  hasStudioAnalyticsAccess={hasStudioAnalyticsAccess}
                  hasCmReviewAccess={hasCmReviewAccess}
                  hasManageAuthorsAccess={hasManageAuthorsAccess}
                  isSuperAdmin={isSuperAdmin}
                  isNavActive={isNavActive}
                  isComplianceLocked={isComplianceLocked}
                  location={location}
                  cmReviewCount={cmReviewCount}
                />
              )}

              {/* PAYROLL — collapsible section with sub-pages */}
              <PayrollSection
                hasPayrollAccess={hasPayrollAccess}
                userRole={userRole}
                isNavActive={isNavActive}
                isComplianceLocked={isComplianceLocked}
                location={location}
              />

              {/* SETTINGS — collapsible section with sub-category pages */}
              <SettingsSection
                hasSettingsAccess={hasHRAccess}
                isNavActive={isNavActive}
                isComplianceLocked={isComplianceLocked}
                location={location}
              />

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
            {newLook ? (
              <header className="app-v2-header flex items-center justify-between h-14 px-4 shrink-0">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <nav className="flex items-center gap-1 text-sm">
                    <span className="v2-muted">Admin</span>
                    <ChevronRight className="h-4 w-4 v2-muted" />
                    <span className="font-medium capitalize">
                      {breadcrumbLabel()}
                    </span>
                  </nav>
                </div>
                <div className="flex items-center gap-2">
                  {notificationsEnabled && <NotificationBell />}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 rounded-full px-3 border border-[hsl(var(--v2-orange))]/40 text-[hsl(var(--v2-orange))] hover:bg-[hsl(var(--v2-orange))]/10"
                        onClick={disableNewLook}
                        disabled={newLookPending}
                        data-testid="button-new-look-active"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="text-xs hidden sm:inline">New Look</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>You're on the new look — click to switch back to classic</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 v2-muted hover:text-current"
                        onClick={() => setShowTour(true)}
                        data-testid="button-help-tour"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Portal guide</TooltipContent>
                  </Tooltip>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-white/5 transition-colors"
                        data-testid="button-profile-menu"
                      >
                        <div className="w-8 h-8 rounded-full bg-[hsl(var(--v2-orange))]/20 flex items-center justify-center font-semibold text-[hsl(var(--v2-orange))] text-xs shrink-0">
                          {user?.firstName?.[0] || "?"}{user?.lastName?.[0] || ""}
                        </div>
                        <div className="hidden sm:block text-left leading-tight">
                          <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                          <p className="text-[11px] v2-muted">{roleInfo.label}</p>
                        </div>
                        <ChevronDown className="h-4 w-4 v2-muted" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                        <p className="text-xs text-muted-foreground font-normal truncate">{user?.email}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild data-testid="menu-my-profile">
                        <Link href="/admin/profile">
                          <UserCircle className="mr-2 h-4 w-4" />
                          My Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={disableNewLook}
                        disabled={newLookPending}
                        data-testid="button-switch-classic"
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Switch back to classic
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => logout()} data-testid="button-logout-menu">
                        <LogOut className="mr-2 h-4 w-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </header>
            ) : (
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
                  {newLookAvailable && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-400 font-medium"
                          onClick={enableNewLook}
                          disabled={newLookPending}
                          data-testid="button-try-new-look"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span className="text-xs">Try new look</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Preview the redesigned portal — you can switch back anytime.</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => setShowTour(true)}
                        data-testid="button-help-tour"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Portal guide</TooltipContent>
                  </Tooltip>
                </div>
              </header>
            )}

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

        {/* ── APP TOUR DIALOG ── */}
        <Dialog open={showTour} onOpenChange={setShowTour}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-app-tour">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Welcome to Hire'in Solutions Portal
              </DialogTitle>
              <DialogDescription>
                Your quick-start checklist. Click any step to go there directly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 py-1">
              {[
                {
                  num: 1,
                  icon: UserCircle,
                  label: "Set your Shift",
                  href: "/admin/profile",
                  desc: "Go to My Profile → Shift section and pick the shift that matches your working hours (e.g. General 9 AM – 6 PM). Do this before your first punch-in.",
                  tip: "Required — your shift determines how daily hours are calculated.",
                  tipColor: "text-amber-600 dark:text-amber-400",
                  show: true,
                },
                {
                  num: 2,
                  icon: Clock,
                  label: "Punch In, Punch Out & Breaks",
                  href: "/admin/my-desk",
                  desc: "My Desk → Time Card tab. Hit Punch In to start your day. Once punched in, you can log a Lunch break (30 min) and up to 2 Tea breaks (15 min each).",
                  tip: "Try to punch in at the start of each working day — it keeps your hours accurate, and your manager can see your attendance.",
                  tipColor: "text-blue-600 dark:text-blue-400",
                  show: true,
                },
                {
                  num: 3,
                  icon: CalendarOff,
                  label: "Apply for Leave",
                  href: "/admin/my-desk",
                  desc: "My Desk → Time Off tab shows your EL / SL balance and lets you submit a leave request. Your manager is notified to approve or reject it.",
                  tip: (user?.role === "manager" || user?.role === "hr" || user?.role === "operations")
                    ? "You can also approve your team's requests from this tab."
                    : undefined,
                  tipColor: "text-green-600 dark:text-green-400",
                  show: true,
                },
                {
                  num: 4,
                  icon: GraduationCap,
                  label: "Complete your Training",
                  href: "/admin/growth",
                  desc: "My Growth → Training has all your assigned policy documents to read and sign, plus learning modules. Overdue training locks portal access until completed.",
                  tip: user?.role === "manager"
                    ? "My Team → Training tab shows your whole team's completion status."
                    : undefined,
                  tipColor: "text-purple-600 dark:text-purple-400",
                  show: hasGrowthAccess,
                },
                {
                  num: 5,
                  icon: MessageCircle,
                  label: "Attendance Issue? Raise a Correction",
                  href: "/admin/my-desk?tab=time-card&att=corrections",
                  desc: "If a punch was missed or recorded incorrectly, go to My Desk → Attendance → Corrections tab and raise a correction request. Your manager will review and approve it.",
                  tip: undefined,
                  tipColor: "",
                  show: true,
                },
              ].filter(s => s.show).map((step) => (
                <button
                  key={step.num}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-lg border hover:bg-accent hover:border-primary/30 transition-colors group"
                  onClick={() => { setShowTour(false); setLocation(step.href); }}
                  data-testid={`tour-step-${step.num}`}
                >
                  <div className="shrink-0 flex flex-col items-center pt-0.5">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                      {step.num}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <step.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-sm font-semibold">{step.label}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                    {step.tip && (
                      <p className={`text-xs mt-1 font-medium ${step.tipColor}`}>{step.tip}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <p className="text-xs text-muted-foreground flex-1">
                Open this guide anytime via the <HelpCircle className="inline h-3 w-3 mx-0.5" /> button in the top-right.
              </p>
              <Button onClick={() => setShowTour(false)} data-testid="button-close-tour">
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


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
      <AnnouncementModal />
    </AdminLayoutMounted.Provider>
  );
}
