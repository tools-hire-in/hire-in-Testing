import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Megaphone } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CommunicationsSection } from "./hr/settings/CommunicationsSection";
import { ReleaseNotesSection } from "./hr/settings/ReleaseNotesSection";

type CommunicationsTab = "whats-new" | "release-notes";

const TABS: { id: CommunicationsTab; label: string; heading: string; description: string }[] = [
  {
    id: "whats-new",
    label: "What's New",
    heading: "What's New",
    description: "Broadcast platform updates to employees",
  },
  {
    id: "release-notes",
    label: "Release Notes",
    heading: "Release Notes",
    description: "Generate and publish AI-powered release notes",
  },
];

export default function Communications() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isHrOrAbove = ["super_admin", "admin", "hr"].includes(user?.role || "");

  const [activeTab, setActiveTab] = useState<CommunicationsTab>(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (tab === "release-notes" || tab === "whats-new") return tab;
    } catch {}
    return "whats-new";
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/admin/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const handleTabChange = (id: CommunicationsTab) => {
    setActiveTab(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState({}, "", url.toString());
    } catch {}
  };

  if (authLoading || !isAuthenticated) return null;

  const activeMeta = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  return (
    <AdminLayout>
      <div className="space-y-6 v2-surface">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-communications-title">
            <Megaphone className="h-5 w-5" />
            Communications
          </h1>
          <p className="text-muted-foreground text-sm">
            Announcements and release notes broadcast to the team
          </p>
        </div>

        {isHrOrAbove ? (
          <>
            <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1 max-w-full" data-testid="tabs-communications">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  data-testid={`nav-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-6 min-w-0">
              <div>
                <h2 className="text-2xl font-bold" data-testid={`text-section-${activeMeta.id}`}>{activeMeta.heading}</h2>
                <p className="text-muted-foreground text-sm">{activeMeta.description}</p>
              </div>
              {activeTab === "whats-new" && <CommunicationsSection />}
              {activeTab === "release-notes" && <ReleaseNotesSection />}
            </div>
          </>
        ) : (
          <div className="rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground" data-testid="text-communications-no-access">
            You don't have access to manage communications.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
