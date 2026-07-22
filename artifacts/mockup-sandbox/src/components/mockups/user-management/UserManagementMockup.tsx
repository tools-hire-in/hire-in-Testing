import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  KeyRound,
  Shield,
  Search,
  Filter,
  Download,
  Plus,
  Mail,
  Building,
  Briefcase,
  Calendar,
  Clock,
  User as UserIcon,
} from "lucide-react";

// Mock Data
type User = {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  designation: string;
  level: string;
  manager: string;
  joiningDate: string;
  shift: string;
  gender: string;
  status: "Active" | "Inactive" | "On Leave";
  twoFactorEnabled: boolean;
  avatarUrl?: string;
};

const MOCK_USERS: User[] = [
  {
    id: "1",
    employeeId: "HIS-1001",
    name: "Sarah Jenkins",
    email: "sarah.j@hirein.com",
    role: "Super Admin",
    department: "IT",
    designation: "Systems Director",
    level: "L5",
    manager: "CEO",
    joiningDate: "Jan 12, 2021",
    shift: "General (9 AM - 6 PM)",
    gender: "Female",
    status: "Active",
    twoFactorEnabled: true,
  },
  {
    id: "2",
    employeeId: "HIS-1042",
    name: "Michael Chen",
    email: "michael.c@hirein.com",
    role: "HR",
    department: "Human Resources",
    designation: "HR Business Partner",
    level: "L3",
    manager: "Sarah Jenkins",
    joiningDate: "Mar 05, 2022",
    shift: "General (9 AM - 6 PM)",
    gender: "Male",
    status: "Active",
    twoFactorEnabled: true,
  },
  {
    id: "3",
    employeeId: "HIS-1089",
    name: "Priya Sharma",
    email: "priya.s@hirein.com",
    role: "Manager",
    department: "Healthcare",
    designation: "Recruitment Manager",
    level: "L4",
    manager: "David Wright",
    joiningDate: "Nov 18, 2022",
    shift: "US East (6 PM - 3 AM)",
    gender: "Female",
    status: "On Leave",
    twoFactorEnabled: true,
  },
  {
    id: "4",
    employeeId: "HIS-1105",
    name: "James Wilson",
    email: "james.w@hirein.com",
    role: "Admin",
    department: "Operations",
    designation: "Operations Lead",
    level: "L3",
    manager: "Sarah Jenkins",
    joiningDate: "Feb 22, 2023",
    shift: "General (9 AM - 6 PM)",
    gender: "Male",
    status: "Inactive",
    twoFactorEnabled: false,
  },
  {
    id: "5",
    employeeId: "HIS-1156",
    name: "Anita Desai",
    email: "anita.d@hirein.com",
    role: "Employee",
    department: "IT",
    designation: "Technical Recruiter",
    level: "L1",
    manager: "Priya Sharma",
    joiningDate: "Jul 10, 2023",
    shift: "US West (9 PM - 6 AM)",
    gender: "Female",
    status: "Active",
    twoFactorEnabled: false,
  },
  {
    id: "6",
    employeeId: "HIS-1201",
    name: "Marcus Johnson",
    email: "marcus.j@hirein.com",
    role: "Employee",
    department: "Healthcare",
    designation: "Sourcing Specialist",
    level: "L2",
    manager: "Priya Sharma",
    joiningDate: "Oct 01, 2023",
    shift: "US East (6 PM - 3 AM)",
    gender: "Male",
    status: "Active",
    twoFactorEnabled: true,
  },
];

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case "Super Admin":
      return "bg-[#1F3A6E] text-white hover:bg-[#1F3A6E]/90";
    case "Admin":
      return "bg-blue-100 text-[#1F3A6E] hover:bg-blue-200 border-none";
    case "HR":
      return "bg-purple-100 text-purple-800 hover:bg-purple-200 border-none";
    case "Manager":
      return "bg-amber-100 text-amber-800 hover:bg-amber-200 border-none";
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 border-none";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "Active":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "Inactive":
      return "text-red-700 bg-red-50 border-red-200";
    case "On Leave":
      return "text-amber-700 bg-amber-50 border-amber-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
};

export default function UserManagementMockup() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage employee access, roles, and security settings.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 bg-white hidden sm:flex">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button className="gap-2 bg-[#F47C20] hover:bg-[#e06a14] text-white border-none shadow-sm">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by name, email, or ID..." 
                className="w-full pl-9 pr-4 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1F3A6E] focus:border-transparent transition-shadow"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" className="gap-2 w-full sm:w-auto bg-slate-50">
                <Filter className="h-4 w-4" /> Filter
              </Button>
            </div>
          </div>

          {/* Lean Table Area */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-700 py-3 pl-6">Employee</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-3">Role</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-3">Department</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-3">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-3">2FA</TableHead>
                  <TableHead className="font-semibold text-slate-700 py-3 text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_USERS.map((user) => (
                  <TableRow 
                    key={user.id} 
                    className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell className="pl-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-200 shadow-sm">
                          <AvatarFallback className="bg-slate-100 text-slate-700 font-medium">
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 group-hover:text-[#1F3A6E] transition-colors">{user.name}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{user.employeeId}</span>
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="secondary" className={`font-medium ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-sm text-slate-600">{user.department}</div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className={`font-medium ${getStatusColor(user.status)}`}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      {user.twoFactorEnabled ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                          <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">Enabled</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
                          <ShieldAlert className="h-4 w-4" /> <span className="hidden sm:inline">Disabled</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 text-[#1F3A6E] hover:text-[#1F3A6E] hover:bg-blue-50 transition-all font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser(user);
                        }}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
        </div>
      </main>

      {/* Detail Panel Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col gap-0 border-l shadow-2xl bg-slate-50/50">
          {selectedUser && (
            <>
              {/* Sheet Header with Prominent Actions */}
              <div className="bg-white border-b px-6 py-5 shrink-0 shadow-sm relative z-10">
                <SheetHeader className="mb-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 border-2 border-white shadow-md ring-1 ring-slate-100">
                      <AvatarFallback className="text-xl bg-[#1F3A6E] text-white font-medium">
                        {getInitials(selectedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 pt-1">
                      <SheetTitle className="text-2xl text-slate-900 leading-none mb-1">
                        {selectedUser.name}
                      </SheetTitle>
                      <SheetDescription className="flex items-center gap-2 text-slate-500 font-medium">
                        {selectedUser.designation} • {selectedUser.department}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                {/* Highly Visible Action Bar */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button className="flex-1 bg-[#1F3A6E] hover:bg-[#152a53] text-white shadow-sm gap-2 h-10">
                    <UserCog className="h-4 w-4" /> Edit Profile
                  </Button>
                  <div className="flex gap-2 w-full mt-2 sm:mt-0 sm:w-auto sm:flex-1">
                    <Button variant="outline" className="flex-1 gap-2 bg-white h-10 border-slate-300 text-slate-700 hover:bg-slate-50">
                      <KeyRound className="h-4 w-4 text-slate-500" /> Reset Pwd
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2 bg-white h-10 border-slate-300 text-slate-700 hover:bg-slate-50">
                      <Shield className="h-4 w-4 text-slate-500" /> Reset 2FA
                    </Button>
                  </div>
                </div>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Identity Section */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Identity & Contact</h3>
                  <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><UserIcon className="h-4 w-4" /> Employee ID</div>
                          <div className="text-sm font-medium text-slate-900 font-mono mt-1 sm:mt-0">{selectedUser.employeeId}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><Mail className="h-4 w-4" /> Email</div>
                          <div className="text-sm font-medium text-[#1F3A6E] mt-1 sm:mt-0 truncate">{selectedUser.email}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                {/* Role & Access Section */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Role & Organization</h3>
                  <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><Shield className="h-4 w-4" /> System Role</div>
                          <div className="mt-1 sm:mt-0">
                            <Badge variant="secondary" className={`font-medium ${getRoleBadgeColor(selectedUser.role)}`}>
                              {selectedUser.role}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><Building className="h-4 w-4" /> Department</div>
                          <div className="text-sm font-medium text-slate-900 mt-1 sm:mt-0">{selectedUser.department}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><Briefcase className="h-4 w-4" /> Level</div>
                          <div className="text-sm font-medium text-slate-900 mt-1 sm:mt-0">{selectedUser.level}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><UserIcon className="h-4 w-4" /> Manager</div>
                          <div className="text-sm font-medium text-[#1F3A6E] cursor-pointer hover:underline mt-1 sm:mt-0">{selectedUser.manager}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                {/* Employment Section */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Employment Details</h3>
                  <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="divide-y divide-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><Calendar className="h-4 w-4" /> Joining Date</div>
                          <div className="text-sm font-medium text-slate-900 mt-1 sm:mt-0">{selectedUser.joiningDate}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32 flex items-center gap-2"><Clock className="h-4 w-4" /> Shift</div>
                          <div className="text-sm font-medium text-slate-900 mt-1 sm:mt-0">{selectedUser.shift}</div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center py-3 px-4 hover:bg-slate-50 transition-colors">
                          <div className="text-sm text-slate-500 w-32">Status</div>
                          <div className="mt-1 sm:mt-0">
                            <Badge variant="outline" className={`font-medium ${getStatusColor(selectedUser.status)}`}>
                              {selectedUser.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                {/* Security Section */}
                <section className="pb-8">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Security Settings</h3>
                  <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row sm:items-center py-4 px-4 bg-slate-50/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 font-medium text-slate-900">
                            <ShieldCheck className="h-5 w-5 text-slate-500" />
                            Two-Factor Authentication
                          </div>
                          <p className="text-sm text-slate-500 mt-1 ml-7">
                            {selectedUser.twoFactorEnabled 
                              ? "Authenticator app is configured and active." 
                              : "User has not set up 2FA yet."}
                          </p>
                        </div>
                        <div className="mt-3 sm:mt-0">
                          {selectedUser.twoFactorEnabled ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none shadow-none px-3 py-1">Enabled</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none shadow-none px-3 py-1">Disabled</Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
