import { useLocation } from "wouter";
import { StudioShell } from "@/components/studio/StudioShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandVoicePanel } from "./BrandVoiceView";
import { StudioAccessPanel } from "@/pages/admin/studio/StudioAccess";
import TemplateSettings from "@/pages/admin/studio/TemplateSettings";

export default function StudioSettingsView() {
  useLocation(); // subscribe to location changes for re-renders
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") ?? "brand-voice";

  function setTab(t: string) {
    window.history.replaceState(null, "", `/studio/settings?tab=${t}`);
    // force wouter to pick up the new URL
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <StudioShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
            Studio Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Brand voice, AI defaults, card templates, and studio access — all in one place.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList data-testid="tabs-studio-settings">
            <TabsTrigger value="brand-voice" data-testid="tab-settings-brand-voice">
              Brand Voice & AI
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-settings-templates">
              Templates
            </TabsTrigger>
            <TabsTrigger value="access" data-testid="tab-settings-access">
              Studio Access
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brand-voice" className="mt-6">
            <BrandVoicePanel />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <TemplateSettings />
          </TabsContent>

          <TabsContent value="access" className="mt-6">
            <StudioAccessPanel />
          </TabsContent>
        </Tabs>
      </div>
    </StudioShell>
  );
}
