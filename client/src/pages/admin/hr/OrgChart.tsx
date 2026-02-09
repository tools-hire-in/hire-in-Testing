import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Network, ChevronDown, ChevronRight, User, Building2, Users } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  managerId: string | null;
  departmentId: string | null;
  designation: string | null;
  hierarchyLevel: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  headId: string | null;
  isActive: boolean;
}

interface TreeNode {
  user: OrgUser;
  children: TreeNode[];
}

const LEVEL_LABELS: Record<string, string> = {
  ceo: "CEO",
  vp: "Vice President",
  director: "Director",
  manager: "Manager",
  team_lead: "Team Lead",
  delivery_manager: "Delivery Manager",
  team_member: "Team Member",
};

const LEVEL_COLORS: Record<string, string> = {
  ceo: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  vp: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  director: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  manager: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  team_lead: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  delivery_manager: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  team_member: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const TOP_LEVELS = ["ceo", "vp"];

function OrgNode({ node, departments, depth = 0 }: { node: TreeNode; departments: Department[]; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const dept = departments.find(d => d.id === node.user.departmentId);
  const hasChildren = node.children.length > 0;
  const level = node.user.hierarchyLevel || "team_member";
  const initials = `${node.user.firstName[0] || ""}${node.user.lastName[0] || ""}`;

  return (
    <div className="relative" data-testid={`org-node-${node.user.id}`}>
      <div className="flex items-start gap-2">
        {depth > 0 && (
          <div className="flex flex-col items-center" style={{ minWidth: "20px" }}>
            <div className="w-px h-4 bg-border" />
            <div className="w-3 h-px bg-border" />
          </div>
        )}
        <div className="flex-1">
          <Card
            className={`cursor-pointer transition-colors ${hasChildren ? "hover-elevate" : ""}`}
            onClick={() => hasChildren && setExpanded(!expanded)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Avatar>
                  <AvatarFallback className={LEVEL_COLORS[level]}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" data-testid={`text-org-name-${node.user.id}`}>
                      {node.user.firstName} {node.user.lastName}
                    </span>
                    {hasChildren && (
                      expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {node.user.designation && (
                      <span className="text-sm text-muted-foreground" data-testid={`text-org-designation-${node.user.id}`}>
                        {node.user.designation}
                      </span>
                    )}
                    {dept && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {dept.name}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs no-default-active-elevate">
                      {LEVEL_LABELS[level] || level}
                    </Badge>
                  </div>
                </div>
                {hasChildren && (
                  <Badge variant="outline" className="text-xs no-default-active-elevate">
                    <Users className="h-3 w-3 mr-1" />
                    {node.children.length}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {expanded && hasChildren && (
            <div className="ml-6 mt-1 space-y-1 border-l border-border pl-2">
              {node.children.map((child) => (
                <OrgNode key={child.user.id} node={child} departments={departments} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrgChart() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: orgData, isLoading } = useQuery<{ users: OrgUser[]; departments: Department[] }>({
    queryKey: ["/api/org-tree"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const tree = useMemo(() => {
    if (!orgData) return [];
    const { users } = orgData;
    const nodeMap = new Map<string, TreeNode>();
    users.forEach(u => nodeMap.set(u.id, { user: u, children: [] }));

    const roots: TreeNode[] = [];
    users.forEach(u => {
      const node = nodeMap.get(u.id)!;
      if (u.managerId && nodeMap.has(u.managerId)) {
        nodeMap.get(u.managerId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortLevel = (level: string | null) => {
      const order = ["ceo", "vp", "director", "manager", "team_lead", "delivery_manager", "team_member"];
      return order.indexOf(level || "team_member");
    };
    const sortNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => sortLevel(a.user.hierarchyLevel) - sortLevel(b.user.hierarchyLevel));
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);

    return roots;
  }, [orgData]);

  const topLeaders = useMemo(() => {
    if (!orgData) return [];
    return orgData.users.filter(u => TOP_LEVELS.includes(u.hierarchyLevel || "") && !u.managerId);
  }, [orgData]);

  const deptSummary = useMemo(() => {
    if (!orgData) return [];
    const { users, departments } = orgData;
    return departments.map(d => ({
      ...d,
      memberCount: users.filter(u => u.departmentId === d.id).length,
    }));
  }, [orgData]);

  if (authLoading || !isAuthenticated) return null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-org-chart-title">Organization Chart</h1>
          <p className="text-muted-foreground">Company hierarchy and reporting structure</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <>
            {topLeaders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Leadership</h2>
                <div className="flex flex-wrap gap-3 justify-center">
                  {topLeaders.map(leader => {
                    const initials = `${leader.firstName[0] || ""}${leader.lastName[0] || ""}`;
                    const lvl = leader.hierarchyLevel || "ceo";
                    return (
                      <Card key={leader.id} className="min-w-[200px]" data-testid={`leader-card-${leader.id}`}>
                        <CardContent className="p-4 text-center">
                          <Avatar className="mx-auto mb-2 h-12 w-12">
                            <AvatarFallback className={(LEVEL_COLORS[lvl] || LEVEL_COLORS.ceo) + " text-lg"}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-semibold">{leader.firstName} {leader.lastName}</p>
                          {leader.designation && (
                            <p className="text-sm text-muted-foreground">{leader.designation}</p>
                          )}
                          <Badge variant="secondary" className="mt-2 text-xs no-default-active-elevate">
                            {LEVEL_LABELS[lvl] || lvl}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {deptSummary.length > 0 && (
                  <div className="flex justify-center">
                    <div className="w-px h-8 bg-border" />
                  </div>
                )}
              </div>
            )}

            {deptSummary.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Departments</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {deptSummary.map(d => (
                    <Card key={d.id} data-testid={`dept-summary-${d.id}`}>
                      <CardContent className="p-3 text-center">
                        <Building2 className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.memberCount} member{d.memberCount !== 1 ? "s" : ""}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {tree.length > 0 ? (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Reporting Structure</h2>
                <div className="space-y-2" data-testid="org-tree-container">
                  {tree.map((node) => (
                    <OrgNode key={node.user.id} node={node} departments={orgData?.departments || []} />
                  ))}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Network className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-lg font-medium">No hierarchy configured yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Go to Team Management to assign departments, designations, and managers to employees.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
