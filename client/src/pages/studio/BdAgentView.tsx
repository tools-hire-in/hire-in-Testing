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
} from "lucide-react";

interface BdConversation {
  id: string;
  title: string;
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

function MarkdownProse({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <p key={i} className="mt-3 font-semibold text-foreground">{line.slice(4)}</p>;
        }
        if (line.startsWith("## ")) {
          return <p key={i} className="mt-4 text-base font-bold text-foreground">{line.slice(3)}</p>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <p key={i} className="pl-4 before:content-['•'] before:mr-2 before:text-primary">{line.slice(2)}</p>;
        }
        if (/^\d+\.\s/.test(line)) {
          return <p key={i} className="pl-4">{line}</p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

type ActiveTab = "chat" | "decks";

export default function BdAgentView() {
  const { can } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canUseBd = can("studio.bd_agent");

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
    mutationFn: () =>
      apiRequest("POST", "/api/studio/bd/conversations", { title: "New conversation" }),
    onSuccess: async (res: any) => {
      const conv = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/studio/bd/conversations"] });
      setSelectedConvId(conv.id);
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/studio/bd/conversations", selectedConvId, "messages"] }),
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
                onClick={() => newConvMutation.mutate()}
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
                <p className="text-sm font-semibold leading-none">BD Agent</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Business development strategy & copywriting assistant
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
                    onClick={() => newConvMutation.mutate()}
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
                          newConvMutation.mutate();
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
                      <button
                        className="flex items-center gap-1 pl-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => handleSaveMsg(msg)}
                        data-testid={`button-save-msg-${msg.id}`}
                      >
                        <BookmarkPlus className="h-3 w-3" />
                        Save as content idea
                      </button>
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
    </StudioShell>
  );
}
