import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { StudioShell } from "@/components/studio/StudioShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import BdDecksView from "./BdDecksView";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  Briefcase,
  AlertCircle,
  BookmarkPlus,
  Loader2,
  LayoutTemplate,
  Copy,
  Edit3,
  Globe,
} from "lucide-react";

type BdAgentMode =
  | "account_discovery"
  | "opportunity_qualification"
  | "meeting_preparation"
  | "deck_collaboration"
  | "positioning_objection"
  | "executive_brief"
  | "follow_up_drafting"
  | "general";

const BD_MODE_META: Record<BdAgentMode, { label: string; icon: string }> = {
  account_discovery:        { label: "Account Discovery",         icon: "🔍" },
  opportunity_qualification:{ label: "Opportunity Qualification", icon: "📊" },
  meeting_preparation:      { label: "Meeting Preparation",       icon: "📋" },
  deck_collaboration:       { label: "Deck Collaboration",        icon: "🃏" },
  positioning_objection:    { label: "Positioning & Objection",   icon: "🎯" },
  executive_brief:          { label: "Executive Brief",           icon: "📝" },
  follow_up_drafting:       { label: "Follow-Up Draft",          icon: "✏️" },
  general:                  { label: "General",                   icon: "💬" },
};

const DOMAIN_OPTIONS = [
  { value: "healthcare",          label: "Healthcare" },
  { value: "it",                  label: "IT / Technology" },
  { value: "engineering",         label: "Engineering" },
  { value: "professional_services", label: "Professional Services" },
  { value: "general",             label: "General" },
  { value: "cross_domain",        label: "Cross-Domain" },
];

const DOMAIN_LABELS: Record<string, string> = {
  healthcare:           "Healthcare",
  it:                   "IT",
  engineering:          "Engineering",
  professional_services:"Prof. Services",
  general:              "General",
  cross_domain:         "Cross-Domain",
};

interface BdDeckStub {
  id: string;
  title: string;
  domain: string;
  deck_type: string;
  status: string;
  version: string;
  slides: unknown[];
}

interface BdConversation {
  id: string;
  title: string;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BdMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// Structured section metadata — maps header text → display config
const STRUCTURED_SECTIONS: Record<string, { bg: string; border: string; label: string }> = {
  "BUYER STAGE":      { bg: "bg-blue-50 dark:bg-blue-950/30",   border: "border-blue-200 dark:border-blue-800",   label: "Buyer Stage" },
  "FIT ASSESSMENT":   { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", label: "Fit Assessment" },
  "KEY GAPS":         { bg: "bg-amber-50 dark:bg-amber-950/30",  border: "border-amber-200 dark:border-amber-800",  label: "Key Gaps" },
  "RECOMMENDATION":   { bg: "bg-primary/5",                      border: "border-primary/20",                       label: "Recommendation" },
  "CLAIM STATUS":     { bg: "bg-muted/60",                       border: "border-muted",                            label: "Claim Status" },
  "NEXT BEST ACTION": { bg: "bg-orange-50 dark:bg-orange-950/30",border: "border-orange-200 dark:border-orange-800",label: "Next Best Action" },
};

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }
  return parts;
}

function MarkdownProse({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect structured section headers: **BUYER STAGE:** or **NEXT BEST ACTION:**
    const sectionMatch = line.match(/^\*\*([A-Z][A-Z\s]+?):\*\*\s*(.*)/);
    if (sectionMatch) {
      const sectionKey = sectionMatch[1].trim();
      const meta = STRUCTURED_SECTIONS[sectionKey];
      if (meta) {
        // Collect all lines until the next structured section or blank separator
        const sectionLines: string[] = [];
        if (sectionMatch[2]) sectionLines.push(sectionMatch[2]);
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          if (nextLine.match(/^\*\*([A-Z][A-Z\s]+?):\*\*/)) break;
          sectionLines.push(nextLine);
          j++;
        }
        // Trim trailing blanks
        while (sectionLines.length && !sectionLines[sectionLines.length - 1].trim()) sectionLines.pop();
        elements.push(
          <div key={`section-${i}`} className={`mt-3 rounded-lg border px-3.5 py-2.5 ${meta.bg} ${meta.border}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-1">{meta.label}</p>
            <div className="space-y-1">
              {sectionLines.map((sl, si) => {
                if (!sl.trim()) return null;
                if (sl.startsWith("- ") || sl.startsWith("• ")) {
                  return <p key={si} className="text-sm pl-3 before:content-['•'] before:mr-2 before:opacity-50">{renderInlineMarkdown(sl.slice(2))}</p>;
                }
                if (/^\d+\.\s/.test(sl)) {
                  return <p key={si} className="text-sm pl-3">{renderInlineMarkdown(sl)}</p>;
                }
                return <p key={si} className="text-sm">{renderInlineMarkdown(sl)}</p>;
              })}
            </div>
          </div>
        );
        i = j;
        continue;
      }
    }

    if (line.startsWith("### ")) {
      elements.push(<p key={i} className="mt-3 font-semibold text-foreground">{line.slice(4)}</p>);
    } else if (line.startsWith("## ")) {
      elements.push(<p key={i} className="mt-4 text-base font-bold text-foreground">{line.slice(3)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(<p key={i} className="pl-4 before:content-['•'] before:mr-2 before:text-primary text-sm">{renderInlineMarkdown(line.slice(2))}</p>);
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(<p key={i} className="pl-4 text-sm">{renderInlineMarkdown(line)}</p>);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{renderInlineMarkdown(line)}</p>);
    }
    i++;
  }

  return <div className="space-y-1.5">{elements}</div>;
}

type ActiveTab = "chat" | "decks";

export default function BdAgentView() {
  const { can, role } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isSuperAdmin = role === "super_admin";

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");

  // Mode indicator — updated from each AI response
  const [lastMode, setLastMode] = useState<BdAgentMode>("general");

  // New conversation dialog state
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [newConvDomain, setNewConvDomain] = useState("general");

  // "Build targeted client deck" modal state
  const [deckSourceMsg, setDeckSourceMsg] = useState<BdMessage | null>(null);
  const [deckClientName, setDeckClientName] = useState("");
  const [deckDomain, setDeckDomain] = useState("healthcare");
  const [deckPositioning, setDeckPositioning] = useState("full_staffing");
  const [deckContext, setDeckContext] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canUseBd = can("studio.bd_agent");

  // Fetch master decks so we can find the right one for the chosen domain
  const { data: masterDecks = [] } = useQuery<BdDeckStub[]>({
    queryKey: ["/api/bd/decks", "master"],
    queryFn: () =>
      fetch("/api/bd/decks?deck_type=master", { credentials: "include" }).then((r) => r.json()),
    enabled: canUseBd,
  });

  const POSITIONING_OPTIONS: { value: string; label: string; description: string }[] = [
    { value: "full_staffing", label: "Full Staffing Partner", description: "End-to-end talent pipeline across all roles" },
    { value: "delivery_partner", label: "Delivery Partner", description: "We own the execution — you focus on your business" },
    { value: "rpo", label: "RPO / Embedded Team", description: "Hire'in team embedded inside your HR function" },
    { value: "domain_specialist", label: "Domain Specialist", description: "Deep domain expertise, not a generalist agency" },
    { value: "cost_efficiency", label: "Cost Efficiency Play", description: "Same quality, significantly lower cost-per-hire" },
    { value: "custom", label: "Custom / Other", description: "Describe your own angle in the context box" },
  ];

  const customizeDeckMutation = useMutation({
    mutationFn: ({
      masterId,
      clientName,
      positioningAngle,
      contextSummary,
    }: {
      masterId: string;
      clientName: string;
      positioningAngle: string;
      contextSummary: string;
    }) =>
      apiRequest("POST", `/api/bd/decks/${masterId}/customize`, {
        client_name: clientName.trim(),
        positioning_angle: positioningAngle,
        context_summary: contextSummary.trim() || null,
      }).then((r: any) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] });
      toast({
        title: "Targeted deck ready!",
        description: "AI has customized every slide for this client. Opening Decks tab to review.",
      });
      setDeckSourceMsg(null);
      setDeckClientName("");
      setDeckDomain("healthcare");
      setDeckPositioning("full_staffing");
      setDeckContext("");
      setActiveTab("decks");
    },
    onError: () => toast({ title: "Failed to build deck", description: "Check your connection and try again.", variant: "destructive" }),
  });

  // Map BUYER STAGE value → best-fit deck positioning angle
  function inferPositioningFromBuyerStage(content: string): string {
    const stageMatch = content.match(/\*\*BUYER STAGE:\*\*\s*([a-z_]+)/i);
    if (!stageMatch) return "full_staffing";
    const stage = stageMatch[1].toLowerCase().trim();
    // Early stages → consultative/problem-framing angles
    if (["problem_identification", "solution_exploration"].includes(stage)) return "delivery_partner";
    // Requirements definition → show we understand the spec
    if (stage === "requirements_definition") return "domain_specialist";
    // Evaluation → prove we reduce risk
    if (stage === "supplier_evaluation") return "domain_specialist";
    // Commercial → cost clarity
    if (stage === "commercial_validation") return "cost_efficiency";
    // Pilot / expansion → operating model
    if (["pilot_or_contracting", "expansion_or_renewal"].includes(stage)) return "rpo";
    return "full_staffing";
  }

  function handleCreateClientDeck(msg: BdMessage) {
    setDeckSourceMsg(msg);
    // Extract structured context from the AI response — pull BUYER STAGE + FIT ASSESSMENT + KEY GAPS + RECOMMENDATION sections
    const content = msg.content;
    const structuredSections = ["BUYER STAGE", "FIT ASSESSMENT", "KEY GAPS", "RECOMMENDATION"];
    const extracted: string[] = [];
    for (const section of structuredSections) {
      const match = content.match(new RegExp(`\\*\\*${section}:\\*\\*([^]*?)(?=\\*\\*[A-Z][A-Z ]+:\\*\\*|$)`, "i"));
      if (match) extracted.push(`${section}:\n${match[1].trim()}`);
    }
    const ctxText = extracted.length > 0
      ? extracted.join("\n\n").slice(0, 800)
      : content.slice(0, 800).trim();
    setDeckContext(ctxText);
    // Detect domain from current conversation
    const currentConv = (conversations as BdConversation[]).find((c) => c.id === selectedConvId);
    setDeckDomain(currentConv?.domain ?? "healthcare");
    setDeckClientName("");
    // Infer positioning angle from buyer stage in the response
    setDeckPositioning(inferPositioningFromBuyerStage(content));
  }

  const { data: conversations = [], isLoading: convsLoading } = useQuery<BdConversation[]>({
    queryKey: ["/api/studio/bd/conversations"],
    enabled: canUseBd,
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<BdMessage[]>({
    queryKey: ["/api/studio/bd/conversations", selectedConvId, "messages"],
    queryFn: () =>
      fetch(`/api/studio/bd/conversations/${selectedConvId}/messages`, { credentials: "include" })
        .then((r) => r.json()),
    enabled: !!selectedConvId && canUseBd,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newConvMutation = useMutation({
    mutationFn: (domain: string) =>
      apiRequest("POST", "/api/studio/bd/conversations", { title: "New conversation", domain }),
    onSuccess: async (res: any) => {
      const conv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/studio/bd/conversations"] });
      setSelectedConvId(conv.id);
      setShowNewConvDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Could not create conversation.", variant: "destructive" }),
  });

  const deleteConvMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/studio/bd/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/bd/conversations"] });
      setSelectedConvId(null);
    },
  });

  const [saveMsg, setSaveMsg] = useState<BdMessage | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveProjectId, setSaveProjectId] = useState("");

  const { data: bdProjects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/bd/projects"],
    enabled: canUseBd,
  });

  useEffect(() => {
    if (bdProjects.length && !activeProjectId) setActiveProjectId(bdProjects[0].id);
  }, [bdProjects, activeProjectId]);

  const saveIdeaMutation = useMutation({
    mutationFn: (body: { title: string; content: string; projectId: string }) =>
      apiRequest("POST", "/api/studio/bd/save-as-idea", body).then((r: any) => r.json()),
    onSuccess: () => {
      toast({ title: "Saved!", description: "Added to your Studio content pipeline." });
      setSaveMsg(null);
    },
    onError: (err: any) =>
      toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  });

  const handleSaveMsg = (msg: BdMessage) => {
    setSaveMsg(msg);
    setSaveTitle(msg.content.split("\n")[0].replace(/^#+\s*/, "").slice(0, 100));
    setSaveProjectId(bdProjects[0]?.id ?? "");
  };

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/studio/bd/conversations/${selectedConvId}/messages`, {
        content,
        ...(activeProjectId ? { projectId: activeProjectId } : {}),
      }).then((r: any) => r.json()),
    onMutate: () => setDraft(""),
    onSuccess: (data: any) => {
      if (data?.mode && BD_MODE_META[data.mode as BdAgentMode]) {
        setLastMode(data.mode as BdAgentMode);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/studio/bd/conversations", selectedConvId, "messages"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to send message.", variant: "destructive" }),
  });

  const handleSend = () => {
    if (!selectedConvId) {
      toast({ description: "Start or select a conversation first." });
      return;
    }
    const content = draft.trim();
    if (!content) return;
    sendMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!canUseBd) {
    return (
      <StudioShell>
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-semibold">Access restricted</p>
          <p className="text-sm text-muted-foreground">BD Agent is available to super admins, admins, and HR managers.</p>
        </div>
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      {/* Tab bar */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border bg-muted/30 p-1 w-fit" data-testid="bd-tab-bar">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-bd-chat"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab("decks")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "decks"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-bd-decks"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Decks
        </button>
      </div>

      {/* Decks tab */}
      {activeTab === "decks" && (
        <div className="min-h-[60vh]">
          <BdDecksView />
        </div>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <div className="flex h-[calc(100vh-10rem)] gap-4">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 flex-col gap-2 lg:flex">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conversations
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={() => setShowNewConvDialog(true)}
                disabled={newConvMutation.isPending}
                data-testid="button-bd-new-conversation"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {convsLoading && (
                <div className="space-y-1.5">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-9 animate-pulse rounded-md bg-muted" />
                  ))}
                </div>
              )}
              {!convsLoading && conversations.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No conversations yet. Start one →
                </p>
              )}
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${
                    selectedConvId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                  onClick={() => setSelectedConvId(conv.id)}
                  data-testid={`conv-item-${conv.id}`}
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  {conv.domain && conv.domain !== "general" && (
                    <span className="shrink-0 text-[9px] font-medium uppercase tracking-wide opacity-50">{DOMAIN_LABELS[conv.domain] ?? conv.domain}</span>
                  )}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConvMutation.mutate(conv.id);
                    }}
                    data-testid={`button-delete-conv-${conv.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Chat area */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border bg-card">
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold leading-none">BD Agent</p>
                  {selectedConvId && (
                    <Badge
                      variant="secondary"
                      className="h-4.5 gap-1 px-1.5 py-0 text-[10px] font-medium"
                      data-testid="badge-bd-mode"
                    >
                      {BD_MODE_META[lastMode].icon} {BD_MODE_META[lastMode].label}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Grounded intelligence engine · {(() => {
                    const conv = (conversations as BdConversation[]).find((c) => c.id === selectedConvId);
                    const d = conv?.domain ?? "general";
                    return <span className="inline-flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" />{DOMAIN_LABELS[d] ?? d}</span>;
                  })()}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {bdProjects.length > 0 && (
                  <Select value={activeProjectId} onValueChange={setActiveProjectId}>
                    <SelectTrigger className="h-7 w-44 text-xs" data-testid="select-bd-project">
                      <SelectValue placeholder="Brand voice: none" />
                    </SelectTrigger>
                    <SelectContent>
                      {bdProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!selectedConvId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewConvDialog(true)}
                    disabled={newConvMutation.isPending}
                    data-testid="button-bd-start-conversation"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New conversation
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {!selectedConvId && (
                <div className="flex flex-col items-center justify-center gap-4 pt-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Bot className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">How can I help with BD today?</p>
                    <p className="mt-1 text-sm text-muted-foreground max-w-md">
                      Ask me about prospecting strategies, objection handling, call prep, proposal framing,
                      or get me to draft follow-up copy. I know Hire'in's positioning and domains cold.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 max-w-xl">
                    {[
                      "How should I approach a mid-size hospital that's currently using a local agency?",
                      "Help me frame Hire'in's rates as value, not cost, for an IT director.",
                      "What discovery questions work best for engineering firms?",
                      "Draft a LinkedIn follow-up for a healthcare prospect who went quiet.",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        className="rounded-lg border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        onClick={() => {
                          setShowNewConvDialog(true);
                          setDraft(prompt);
                        }}
                        data-testid="button-bd-starter-prompt"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedConvId && msgsLoading && (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  data-testid={`message-${msg.id}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <div className="flex max-w-[75%] flex-col gap-1">
                      <div className="rounded-xl bg-muted px-4 py-3 text-sm">
                        <MarkdownProse text={msg.content} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pl-1">
                        <button
                          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => handleSaveMsg(msg)}
                          data-testid={`button-save-msg-${msg.id}`}
                        >
                          <BookmarkPlus className="h-3 w-3" />
                          Save as content idea
                        </button>
                        <button
                          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
                          onClick={() => handleCreateClientDeck(msg)}
                          data-testid={`button-create-deck-${msg.id}`}
                        >
                          <Copy className="h-3 w-3" />
                          Create client deck
                        </button>
                        {isSuperAdmin && (
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-orange-600"
                            onClick={() => setActiveTab("decks")}
                            data-testid={`button-update-master-${msg.id}`}
                            title="Go to Decks tab to edit the master template"
                          >
                            <Edit3 className="h-3 w-3" />
                            Update master
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[75%] rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground">
                      <p className="leading-relaxed">{msg.content}</p>
                    </div>
                  )}
                </div>
              ))}

              {sendMutation.isPending && (
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="rounded-xl bg-muted px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <Separator />

            {/* Input */}
            <div className="flex gap-2 p-3">
              <Textarea
                className="min-h-[60px] max-h-[140px] resize-none flex-1"
                placeholder={
                  selectedConvId
                    ? "Ask about BD strategy, prospects, objections, copy…  ⌘↵ to send"
                    : "Select or start a conversation first"
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!selectedConvId || sendMutation.isPending}
                data-testid="input-bd-message"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!selectedConvId || !draft.trim() || sendMutation.isPending}
                data-testid="button-bd-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Build targeted client deck dialog */}
      <Dialog
        open={!!deckSourceMsg}
        onOpenChange={(o) => {
          if (!o && !customizeDeckMutation.isPending) {
            setDeckSourceMsg(null);
            setDeckClientName("");
            setDeckDomain("healthcare");
            setDeckPositioning("full_staffing");
            setDeckContext("");
          }
        }}
      >
        <DialogContent className="max-w-lg" data-testid="modal-create-client-deck">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Build Targeted Client Deck
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              AI rewrites every slide specifically for this client. The master template stays untouched.
            </p>
          </DialogHeader>

          {customizeDeckMutation.isPending ? (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Loader2 className="h-7 w-7 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">AI is customizing your deck…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rewriting each slide for {deckClientName || "this client"}. Usually takes 15–30 seconds.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              {/* Client name */}
              <div className="space-y-1.5">
                <Label htmlFor="deck-client-name">
                  Client / company name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="deck-client-name"
                  value={deckClientName}
                  onChange={(e) => setDeckClientName(e.target.value)}
                  placeholder="e.g. Apollo Hospitals, Infosys BPM, L&T…"
                  autoFocus
                  data-testid="input-deck-client-name"
                />
              </div>

              {/* Domain */}
              <div className="space-y-1.5">
                <Label>Industry / domain <span className="text-destructive">*</span></Label>
                <Select value={deckDomain} onValueChange={setDeckDomain}>
                  <SelectTrigger data-testid="select-deck-domain"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["healthcare", "it", "engineering", "professional_services"] as const).map((d) => (
                      <SelectItem key={d} value={d}>{DOMAIN_LABELS[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(() => {
                  const domainMasters = masterDecks.filter((m) => m.domain === deckDomain && m.status !== "archived");
                  if (domainMasters.length === 0) {
                    return (
                      <p className="text-xs text-amber-600">
                        No master template for {DOMAIN_LABELS[deckDomain]} yet — a super admin needs to create one in the Decks tab first.
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground">
                      Based on: <strong>{domainMasters[0].title}</strong> · {domainMasters[0].slides.length} slides
                    </p>
                  );
                })()}
              </div>

              {/* Positioning angle */}
              <div className="space-y-1.5">
                <Label>
                  How should we position Hire'in? <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDeckPositioning(opt.value)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        deckPositioning === opt.value
                          ? "border-primary bg-primary/8 text-foreground"
                          : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                      }`}
                      data-testid={`btn-positioning-${opt.value}`}
                    >
                      <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                      <p className="text-[10px] mt-0.5 leading-snug opacity-70">{opt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Context from conversation */}
              <div className="space-y-1.5">
                <Label htmlFor="deck-context">
                  Context from conversation
                  <span className="ml-1 text-muted-foreground text-xs">(pre-filled from agent reply — trim or add to)</span>
                </Label>
                <Textarea
                  id="deck-context"
                  value={deckContext}
                  onChange={(e) => setDeckContext(e.target.value)}
                  placeholder="What's specific about this client? Their pain points, current vendor, budget signals, relationship status…"
                  className="min-h-[90px] resize-none text-xs"
                  data-testid="input-deck-context"
                />
              </div>
            </div>
          )}

          {!customizeDeckMutation.isPending && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeckSourceMsg(null);
                  setDeckClientName("");
                  setDeckDomain("healthcare");
                  setDeckPositioning("full_staffing");
                  setDeckContext("");
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={
                  !deckClientName.trim() ||
                  masterDecks.filter((m) => m.domain === deckDomain && m.status !== "archived").length === 0
                }
                onClick={() => {
                  const master = masterDecks.find((m) => m.domain === deckDomain && m.status !== "archived");
                  if (!master) return;
                  const posLabel = POSITIONING_OPTIONS.find((p) => p.value === deckPositioning)?.label ?? deckPositioning;
                  customizeDeckMutation.mutate({
                    masterId: master.id,
                    clientName: deckClientName,
                    positioningAngle: posLabel,
                    contextSummary: deckContext,
                  });
                }}
                data-testid="button-confirm-create-client-deck"
                className="bg-primary hover:bg-primary/90"
              >
                <Bot className="mr-1.5 h-4 w-4" />
                Build Targeted Deck
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Save message as content idea dialog */}
      <Dialog open={!!saveMsg} onOpenChange={(o) => { if (!o) setSaveMsg(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Content Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="agent-save-title">Topic / title</Label>
              <Input
                id="agent-save-title"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Enter a title for the content idea"
                data-testid="input-agent-save-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-save-project">Studio project</Label>
              {bdProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Studio projects found. Create a project first.</p>
              ) : (
                <Select value={saveProjectId} onValueChange={setSaveProjectId}>
                  <SelectTrigger id="agent-save-project" data-testid="select-agent-save-project">
                    <SelectValue placeholder="Select a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {bdProjects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveMsg(null)}>Cancel</Button>
            <Button
              disabled={!saveTitle.trim() || !saveProjectId || saveIdeaMutation.isPending || bdProjects.length === 0}
              onClick={() =>
                saveIdeaMutation.mutate({
                  title: saveTitle.trim(),
                  content: saveMsg?.content ?? "",
                  projectId: saveProjectId,
                })
              }
              data-testid="button-agent-confirm-save"
            >
              {saveIdeaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Conversation Dialog — domain picker */}
      <Dialog open={showNewConvDialog} onOpenChange={(o) => { if (!o) setShowNewConvDialog(false); }}>
        <DialogContent className="max-w-sm" data-testid="modal-new-conversation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              New BD Conversation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Choose the staffing domain for this conversation. The Agent will load the relevant master
              deck knowledge and adjust its domain ontology accordingly.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Domain</Label>
              <Select value={newConvDomain} onValueChange={setNewConvDomain}>
                <SelectTrigger data-testid="select-new-conv-domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              You can change the domain later from the conversation settings.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewConvDialog(false)}>Cancel</Button>
            <Button
              onClick={() => newConvMutation.mutate(newConvDomain)}
              disabled={newConvMutation.isPending}
              data-testid="button-confirm-new-conversation"
            >
              {newConvMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start conversation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioShell>
  );
}
