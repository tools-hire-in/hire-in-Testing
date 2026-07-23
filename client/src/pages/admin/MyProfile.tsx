import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { V2PageHeader } from "@/components/admin/V2PageHeader";
import { useNewLook } from "@/hooks/use-new-look";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, ImagePlus, Loader2, RefreshCw, User } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";
import HRProfile from "./hr/Profile";
import MyDocuments from "./hr/MyDocuments";
import OrgChart from "./hr/OrgChart";

const TABS = ["profile", "documents", "org-chart"] as const;
type Tab = typeof TABS[number];

function getTabFromSearch(): Tab {
  try {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.includes(tab as Tab)) return tab as Tab;
    if (tab === "salary-slips") return "profile";
  } catch {}
  return "profile";
}

interface AuthorProfileData {
  id: string;
  displayName: string;
  title: string | null;
  publicTitle: string | null;
  bio: string | null;
  photoUrl: string | null;
  linkedinUrl: string | null;
  specialties: string[] | null;
  profileComplete: boolean;
  isActive: boolean;
}

function AuthorProfileSection() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const lastUploadPath = useRef<string | null>(null);

  const { data: profile, isLoading } = useQuery<AuthorProfileData | null>({
    queryKey: ["/api/me/author-profile"],
  });

  const [fields, setFields] = useState({
    publicTitle: "",
    title: "",
    bio: "",
    linkedinUrl: "",
    specialties: "",
    photoUrl: "",
  });

  useEffect(() => {
    if (profile) {
      setFields({
        publicTitle: profile.publicTitle ?? "",
        title: profile.title ?? "",
        bio: profile.bio ?? "",
        linkedinUrl: profile.linkedinUrl ?? "",
        specialties: (profile.specialties ?? []).join(", "),
        photoUrl: profile.photoUrl ?? "",
      });
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/me/author-profile", {
        publicTitle: fields.publicTitle.trim() || null,
        title: fields.title.trim() || null,
        bio: fields.bio.trim() || null,
        linkedinUrl: fields.linkedinUrl.trim() || null,
        photoUrl: fields.photoUrl.trim() || null,
        specialties: fields.specialties
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/author-profile"] });
      toast({ title: "Author profile saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return null;
  if (!profile) return null;

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card data-testid="card-author-profile">
      <CardHeader className="pb-2">
        <button
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          data-testid="button-toggle-author-profile"
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Author Profile</CardTitle>
            {profile.profileComplete ? (
              <Badge variant="secondary" className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 text-[10px]">
                Incomplete
              </Badge>
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {!open && (
          <p className="mt-1 ml-6 text-xs text-muted-foreground">
            {profile.displayName}
            {profile.publicTitle ? ` · ${profile.publicTitle}` : ""}
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="space-y-4 pt-0">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{profile.displayName}</span> — your public display name is managed by HR. Contact your HR administrator to update it.
          </div>

          {/* Profile photo */}
          <div className="space-y-2">
            <Label className="text-xs">Profile photo</Label>
            <div className="flex items-center gap-3">
              <Avatar className="h-16 w-16 shrink-0">
                {fields.photoUrl && <AvatarImage src={fields.photoUrl} alt={profile.displayName} />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1.5">
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={5242880}
                  buttonClassName="w-full"
                  onGetUploadParameters={async (file) => {
                    const res = await apiRequest("POST", "/api/me/author-photo-upload-url", {
                      name: file.name,
                      size: file.size,
                      contentType: file.type,
                    });
                    const data = await res.json();
                    lastUploadPath.current = data.objectPath;
                    return { method: "PUT" as const, url: data.uploadURL };
                  }}
                  onComplete={() => {
                    if (lastUploadPath.current) {
                      setFields((f) => ({ ...f, photoUrl: lastUploadPath.current! }));
                      toast({ title: "Photo uploaded — click Save to apply" });
                    }
                  }}
                >
                  <span className="inline-flex items-center">
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {fields.photoUrl ? "Replace photo" : "Upload photo"}
                  </span>
                </ObjectUploader>
                <p className="text-[11px] text-muted-foreground">
                  JPG or PNG, max 5 MB. Synced to your HR profile when you save.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ap-public-title" className="text-xs">Public title</Label>
              <Input
                id="ap-public-title"
                value={fields.publicTitle}
                onChange={(e) => setFields((f) => ({ ...f, publicTitle: e.target.value }))}
                placeholder="e.g. Senior Healthcare Recruiter"
                className="h-8 text-sm"
                data-testid="input-author-public-title"
              />
              <p className="text-[11px] text-muted-foreground">Shown on published articles alongside your name.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ap-title" className="text-xs">Internal title / role</Label>
              <Input
                id="ap-title"
                value={fields.title}
                onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Healthcare Staffing Lead"
                className="h-8 text-sm"
                data-testid="input-author-title"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ap-bio" className="text-xs">Author bio</Label>
            <Textarea
              id="ap-bio"
              rows={3}
              value={fields.bio}
              onChange={(e) => setFields((f) => ({ ...f, bio: e.target.value }))}
              placeholder="A brief professional bio for your author page…"
              className="text-sm"
              data-testid="input-author-bio"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ap-linkedin" className="text-xs">LinkedIn URL</Label>
            <Input
              id="ap-linkedin"
              value={fields.linkedinUrl}
              onChange={(e) => setFields((f) => ({ ...f, linkedinUrl: e.target.value }))}
              placeholder="https://linkedin.com/in/yourprofile"
              className="h-8 text-sm"
              data-testid="input-author-linkedin"
            />
            <p className="text-[11px] text-muted-foreground">
              Synced to your HR profile when you save.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ap-specialties" className="text-xs">Specialties</Label>
            <Input
              id="ap-specialties"
              value={fields.specialties}
              onChange={(e) => setFields((f) => ({ ...f, specialties: e.target.value }))}
              placeholder="Healthcare Staffing, Contract Hiring, …"
              className="h-8 text-sm"
              data-testid="input-author-specialties"
            />
            <p className="text-[11px] text-muted-foreground">Comma-separated list of your expertise areas.</p>
          </div>

          {!profile.profileComplete && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              Your author profile is incomplete. Add your public title, bio, and a profile photo to unlock article author sign-off.
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <a
              href="/admin/studio/authors"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              data-testid="link-manage-author-profile"
            >
              <ExternalLink className="h-3 w-3" />
              Manage full profile in Studio
            </a>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              data-testid="button-save-author-profile"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Save Author Profile
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ResetOnboardingSection() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/reset", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
      toast({ title: "Onboarding reset", description: "Your progress has been cleared. Redirecting…" });
      setTimeout(() => setLocation("/admin/onboarding"), 800);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card data-testid="card-reset-onboarding">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Onboarding</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Re-run your onboarding flow from the beginning — useful after a content update or to refresh your knowledge. Your track and role stay the same.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setConfirmOpen(true)}
            data-testid="button-reset-onboarding"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset my onboarding
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your onboarding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clear your onboarding progress and restart the flow from the beginning. Your track content and role will stay the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-onboarding-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmOpen(false); resetMutation.mutate(); }}
              disabled={resetMutation.isPending}
              data-testid="button-reset-onboarding-confirm"
            >
              {resetMutation.isPending ? "Resetting…" : "Yes, reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function MyProfile() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { enabled: newLook } = useNewLook();
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromSearch);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "salary-slips") {
        setLocation("/admin/my-desk?tab=payslips");
      }
    } catch {}
  }, [setLocation]);

  if (authLoading || !isAuthenticated) return null;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as Tab);
    const url = new URL(window.location.href);
    if (tab === "profile") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <AdminLayout>
      <div className="space-y-4 v2-surface">
        {newLook ? (
          <V2PageHeader
            icon={User}
            eyebrow="Profile"
            title="My Profile"
            subtitle="Your profile, documents, and org chart"
            testId="text-myprofile-title"
          />
        ) : (
          <div className="v2-page-head">
            <h1 className="text-2xl font-bold" data-testid="text-myprofile-title">My Profile</h1>
            <p className="text-sm text-muted-foreground">Your profile, documents, and org chart</p>
          </div>
        )}
        <Tabs value={activeTab} onValueChange={handleTabChange} data-testid="tabs-myprofile">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="org-chart" data-testid="tab-org-chart">Org Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-4 space-y-4">
            <HRProfile />
            <AuthorProfileSection />
            <ResetOnboardingSection />
          </TabsContent>
          <TabsContent value="documents" className="mt-4">
            <MyDocuments />
          </TabsContent>
          <TabsContent value="org-chart" className="mt-4">
            <OrgChart />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
