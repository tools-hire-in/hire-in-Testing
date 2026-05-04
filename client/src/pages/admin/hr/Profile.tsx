import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserCircle, Mail, Shield, Calendar, KeyRound, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { EmergencyContactsSection } from "@/components/admin/EmergencyContacts";

interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  totalDays: string;
  usedDays: string;
}

interface LeaveType {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  totalHours: string | null;
}

function TwoFactorSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [setupStep, setSetupStep] = useState<"idle" | "qr" | "verify">("idle");
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  const { data: totpStatus, isLoading: statusLoading } = useQuery<{ totpEnabled: boolean }>({
    queryKey: ["/api/auth/totp/status"],
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/totp/setup");
      return response.json();
    },
    onSuccess: (data) => {
      setQrData(data);
      setSetupStep("qr");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start 2FA setup", variant: "destructive" });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/totp/verify", { code });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "2FA Enabled", description: "Two-factor authentication has been enabled for your account." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/totp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setSetupStep("idle");
      setQrData(null);
      setVerifyCode("");
    },
    onError: (error: any) => {
      toast({ title: "Verification Failed", description: error.message || "Invalid code. Please try again.", variant: "destructive" });
      setVerifyCode("");
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/totp/disable", { code });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "2FA Disabled", description: "Two-factor authentication has been disabled." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/totp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setShowDisable(false);
      setDisableCode("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to disable 2FA", variant: "destructive" });
      setDisableCode("");
    },
  });

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isEnabled = totpStatus?.totpEnabled || false;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
          </div>
          <Badge
            variant={isEnabled ? "default" : "secondary"}
            data-testid="badge-2fa-status"
          >
            {isEnabled ? "Enabled" : "Disabled"}
          </Badge>
        </div>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isEnabled && setupStep === "idle" && (
          <Button
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending}
            data-testid="button-enable-2fa"
          >
            {setupMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="mr-2 h-4 w-4" />
            )}
            Enable 2FA
          </Button>
        )}

        {setupStep === "qr" && qrData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <img
                src={qrData.qrCode}
                alt="TOTP QR Code"
                className="w-48 h-48"
                data-testid="img-qr-code"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Can't scan? Enter this secret manually:
              </p>
              <code className="block text-xs bg-muted p-2 rounded font-mono break-all" data-testid="text-totp-secret">
                {qrData.secret}
              </code>
            </div>
            <Button onClick={() => setSetupStep("verify")} data-testid="button-next-verify">
              Next
            </Button>
          </div>
        )}

        {setupStep === "verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code shown in your authenticator app to confirm setup
            </p>
            <div className="space-y-2">
              <Label htmlFor="verify-code">Verification Code</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-xl tracking-widest font-mono max-w-xs"
                data-testid="input-verify-code"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => verifyMutation.mutate(verifyCode)}
                disabled={verifyCode.length !== 6 || verifyMutation.isPending}
                data-testid="button-verify-2fa"
              >
                {verifyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Verify & Enable
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSetupStep("idle");
                  setVerifyCode("");
                  setQrData(null);
                }}
                data-testid="button-cancel-setup"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isEnabled && !showDisable && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span>Your account is protected with two-factor authentication</span>
            </div>
            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowDisable(true)}
                data-testid="button-show-disable-2fa"
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                Disable 2FA
              </Button>
            )}
          </div>
        )}

        {isEnabled && showDisable && isSuperAdmin && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your authenticator code to confirm disabling 2FA
            </p>
            <div className="space-y-2">
              <Label htmlFor="disable-code">Verification Code</Label>
              <Input
                id="disable-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-xl tracking-widest font-mono max-w-xs"
                data-testid="input-disable-code"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => disableMutation.mutate(disableCode)}
                disabled={disableCode.length !== 6 || disableMutation.isPending}
                data-testid="button-confirm-disable-2fa"
              >
                {disableMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="mr-2 h-4 w-4" />
                )}
                Confirm Disable
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDisable(false);
                  setDisableCode("");
                }}
                data-testid="button-cancel-disable"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  const validTabs = ["profile", "emergency-contacts"];
  const initialTab = requestedTab && validTabs.includes(requestedTab) ? requestedTab : "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: balances } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/hr/leave-balances/my"],
    enabled: isAuthenticated && !!user?.totpEnabled,
  });

  const { data: leaveTypes } = useQuery<LeaveType[]>({
    queryKey: ["/api/hr/leave-types"],
    enabled: isAuthenticated && !!user?.totpEnabled,
  });

  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();
  const startDate = `${currentMonth}-01`;
  const [year, month] = currentMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${currentMonth}-${lastDay}`;

  const { data: monthlyAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/hr/attendance/my", { startDate, endDate }],
    enabled: isAuthenticated && !!user?.totpEnabled,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const getLeaveTypeName = (id: string) => leaveTypes?.find(lt => lt.id === id)?.name || "Unknown";

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    hr: "HR Manager",
    operations: "Operations",
    employee: "Employee",
  };

  const presentDays = monthlyAttendance?.filter(r => ["present", "late", "half_day"].includes(r.status)).length || 0;
  const totalHours = monthlyAttendance?.reduce((s, r) => s + parseFloat(r.totalHours || "0"), 0) || 0;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "profile") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-profile-title">My Profile</h1>
          <p className="text-muted-foreground">Personal information and overview</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-profile">
          <TabsList>
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="emergency-contacts" data-testid="tab-emergency-contacts">Emergency Contacts</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardContent className="p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
                <UserCircle className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-xl font-bold" data-testid="text-profile-name">
                {user?.firstName} {user?.lastName}
              </h2>
              <Badge className="mt-2" data-testid="badge-profile-role">
                {roleLabels[user?.role || "employee"]}
              </Badge>
              <div className="mt-4 space-y-2 text-left">
                {user?.employeeId && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded" data-testid="text-profile-employee-id">{user.employeeId}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-profile-email">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>Role: {roleLabels[user?.role || "employee"]}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Status: {user?.isActive ? "Active" : "Inactive"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">This Month's Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-mono font-bold">{presentDays}</div>
                    <p className="text-xs text-muted-foreground">Days Present</p>
                  </div>
                  <div>
                    <div className="text-2xl font-mono font-bold">{totalHours.toFixed(1)}</div>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                  </div>
                  <div>
                    <div className="text-2xl font-mono font-bold">{presentDays > 0 ? (totalHours / presentDays).toFixed(1) : "0"}</div>
                    <p className="text-xs text-muted-foreground">Avg Hours/Day</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leave Balances ({new Date().getFullYear()})</CardTitle>
              </CardHeader>
              <CardContent>
                {balances && balances.length > 0 ? (
                  <div className="space-y-3">
                    {balances.map((bal) => {
                      const total = parseFloat(bal.totalDays);
                      const used = parseFloat(bal.usedDays);
                      const remaining = total - used;
                      const percent = total > 0 ? (used / total) * 100 : 0;
                      return (
                        <div key={bal.id}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm">{getLeaveTypeName(bal.leaveTypeId)}</span>
                            <span className="text-sm text-muted-foreground">
                              {remaining} remaining / {total} total ({used} used)
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-md h-2">
                            <div
                              className="bg-primary rounded-md h-2 transition-all"
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No leave balances available</p>
                )}
              </CardContent>
            </Card>

            <TwoFactorSection />
          </div>
        </div>
          </TabsContent>
          <TabsContent value="emergency-contacts">
            <EmergencyContactsSection />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
