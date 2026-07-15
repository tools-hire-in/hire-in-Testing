import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot,
  ChevronRight,
  ChevronLeft,
  Send,
  Loader2,
  CheckCircle2,
  Target,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  goalProposal?: ParsedGoalProposal | null;
}

interface ParsedGoalProposal {
  title: string;
  owner: string | null;
  target: string | null;
  timeline: string | null;
  milestones: string[];
  subGoals: string[];
  financialTarget: string | null;
}

interface HistoryItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent_detected: string | null;
  created_at: string;
}

interface CeoSignal {
  severity: "critical" | "warning" | "info";
  message: string;
  linkType: string;
  linkId: string | null;
}

interface AuditGap {
  severity: "critical" | "warning" | "info";
  message: string;
  count: number;
  deepLink: string;
  canAssign: boolean;
  category: string;
}

interface AuditData {
  gaps: AuditGap[];
  healthScore: number;
  asOf: string;
}

// ── Starter questions ─────────────────────────────────────────────────────────

const STARTERS = [
  "How are we tracking on placements this quarter?",
  "Who on the team needs my attention right now?",
  "What's blocking our conversion rate?",
  "Create a goal for 30 placements this quarter",
  "What should I focus on this week?",
];

// ── Strip GOAL_PROPOSAL markers from displayed text ───────────────────────────
function stripProposalMarkers(text: string): string {
  return text
    .replace(/\[GOAL_PROPOSAL\][\s\S]*?\[\/GOAL_PROPOSAL\]/g, "")
    .trim();
}

// ── Signal severity icon ──────────────────────────────────────────────────────
function SignalIcon({ severity }: { severity: "critical" | "warning" | "info" }) {
  if (severity === "critical") return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  return <Info className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
}

// ── Signals feed ──────────────────────────────────────────────────────────────
function SignalsFeed({
  onSignalClick,
}: {
  onSignalClick: (msg: string) => void;
}) {
  const [, setLocation] = useLocation();

  const { data, isLoading, refetch } = useQuery<{ signals: CeoSignal[] }>({
    queryKey: ["/api/ceo/copilot/signals"],
    staleTime: 120000,
  });

  if (isLoading) return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" />
      Loading signals…
    </div>
  );

  const signals = data?.signals ?? [];
  if (signals.length === 0) return (
    <div className="px-3 py-2 text-xs text-muted-foreground">
      ✓ No active signals — system looks healthy
    </div>
  );

  return (
    <div className="space-y-1" data-testid="copilot-signals">
      {signals.map((s, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 px-3 py-1.5 text-xs rounded mx-2",
            s.severity === "critical" ? "bg-red-50 dark:bg-red-950/20" :
            s.severity === "warning" ? "bg-amber-50 dark:bg-amber-950/20" :
            "bg-blue-50 dark:bg-blue-950/20"
          )}
          data-testid={`copilot-signal-${i}`}
        >
          <SignalIcon severity={s.severity} />
          <span className="flex-1 leading-tight">{s.message}</span>
          {s.linkId && (
            <button
              className="shrink-0 text-primary underline underline-offset-2 text-[10px] whitespace-nowrap"
              onClick={() => {
                if (s.linkId?.startsWith("/")) {
                  setLocation(s.linkId);
                } else {
                  onSignalClick(`Tell me more about: ${s.message}`);
                }
              }}
              data-testid={`copilot-signal-link-${i}`}
            >
              View →
            </button>
          )}
        </div>
      ))}
      <div className="px-3">
        <button
          className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-foreground"
          onClick={() => refetch()}
          data-testid="copilot-signals-refresh"
        >
          <RefreshCw className="h-2.5 w-2.5" />
          Refresh
        </button>
      </div>
    </div>
  );
}

// ── System Health / Audit panel ────────────────────────────────────────────────
function SystemHealthPanel({
  onNavigate,
}: {
  onNavigate: (url: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useQuery<AuditData>({
    queryKey: ["/api/ceo/copilot/audit"],
    staleTime: 3600000, // 1 hr
  });

  if (isLoading) return null;
  if (!data) return null;

  const criticals = data.gaps.filter(g => g.severity === "critical");
  const warnings = data.gaps.filter(g => g.severity === "warning");
  const infos = data.gaps.filter(g => g.severity === "info");

  const barColor = data.healthScore >= 80 ? "bg-green-500" : data.healthScore >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="border-b pb-2 mb-2" data-testid="copilot-audit-panel">
      <button
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs hover:bg-muted/50 rounded"
        onClick={() => setExpanded(v => !v)}
        data-testid="copilot-audit-toggle"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground">System Health</span>
          <span className={cn("font-bold", data.healthScore >= 80 ? "text-green-600" : data.healthScore >= 60 ? "text-amber-600" : "text-red-600")}>
            {data.healthScore}%
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${data.healthScore}%` }} />
          </div>
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-3 mt-1 space-y-2" data-testid="copilot-audit-gaps">
          {criticals.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-red-600 mb-1">🔴 Critical ({criticals.length})</p>
              {criticals.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-0.5" data-testid={`audit-gap-critical-${i}`}>
                  <span className="flex-1 text-red-700 dark:text-red-400">{g.message}</span>
                  <button
                    className="text-primary underline underline-offset-2 text-[10px] whitespace-nowrap shrink-0"
                    onClick={() => onNavigate(g.deepLink)}
                  >
                    Fix now →
                  </button>
                </div>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-amber-600 mb-1">🟡 Warnings ({warnings.length})</p>
              {warnings.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-0.5" data-testid={`audit-gap-warning-${i}`}>
                  <span className="flex-1 text-amber-700 dark:text-amber-400">{g.message}</span>
                  <button
                    className="text-primary underline underline-offset-2 text-[10px] whitespace-nowrap shrink-0"
                    onClick={() => onNavigate(g.deepLink)}
                  >
                    Fix now →
                  </button>
                </div>
              ))}
            </div>
          )}
          {infos.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-blue-600 mb-1">ℹ Info ({infos.length})</p>
              {infos.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-0.5" data-testid={`audit-gap-info-${i}`}>
                  <span className="flex-1">{g.message}</span>
                  <button
                    className="text-primary underline underline-offset-2 text-[10px] whitespace-nowrap shrink-0"
                    onClick={() => onNavigate(g.deepLink)}
                  >
                    Fix →
                  </button>
                </div>
              ))}
            </div>
          )}
          {data.gaps.length === 0 && (
            <p className="text-xs text-green-600">✓ All checks passed — system is fully configured</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CopilotPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Collapse state — persisted to localStorage
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem("copilot_panel_expanded") === "true";
    } catch {
      return false;
    }
  });

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingProposal, setPendingProposal] = useState<ParsedGoalProposal | null>(null);
  const [approvedGoalId, setApprovedGoalId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load history on mount
  const { data: history } = useQuery<HistoryItem[]>({
    queryKey: ["/api/ceo/copilot/history"],
    enabled: !!user && user.role === "super_admin" && expanded,
    staleTime: 60000,
  });

  useEffect(() => {
    if (history && history.length > 0 && messages.length === 0) {
      setMessages(
        history.map((h) => ({
          role: h.role,
          content: h.content,
        }))
      );
    }
  }, [history]);

  // Toggle panel
  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("copilot_panel_expanded", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Goal creation mutation
  const createGoalMutation = useMutation({
    mutationFn: async (proposal: ParsedGoalProposal) => {
      const now = new Date();
      const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
      const res = await apiRequest("POST", "/api/ceo/copilot/create-goal", {
        title: proposal.title,
        description: proposal.target,
        milestones: proposal.milestones,
        subGoals: proposal.subGoals,
        financialTarget: proposal.financialTarget,
        targetDate: qEnd.toISOString().slice(0, 10),
      });
      return res.json() as Promise<{ goalId: string; success: boolean }>;
    },
    onSuccess: (data) => {
      setApprovedGoalId(data.goalId);
      setPendingProposal(null);
      queryClient.invalidateQueries({ queryKey: ["/api/ceo/goals"] });
      const confirmMsg = "✅ Done. Goal created and added to your company goal strip. I'll track progress and flag you when something looks off.";
      setMessages((prev) => [...prev, { role: "assistant", content: confirmMsg }]);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create goal", description: err.message, variant: "destructive" });
    },
  });

  // Send message (streaming SSE)
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;

    // Detect audit/system health intent
    if (/audit|what.s missing|what do i need to set up|system health/i.test(text.trim())) {
      const userMsg: ConversationMessage = { role: "user", content: text };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setStreaming(true);
      setStreamingText("Running system audit…");
      try {
        const res = await fetch("/api/ceo/copilot/audit", { credentials: "include" });
        const data: AuditData = await res.json();
        const criticals = data.gaps.filter(g => g.severity === "critical");
        const warnings = data.gaps.filter(g => g.severity === "warning");
        const infos = data.gaps.filter(g => g.severity === "info");
        let reply = `**System Health: ${data.healthScore}%**\n\n`;
        if (criticals.length > 0) {
          reply += `🔴 **Critical (${criticals.length})**\n`;
          criticals.forEach(g => { reply += `• ${g.message}\n`; });
          reply += "\n";
        }
        if (warnings.length > 0) {
          reply += `🟡 **Warnings (${warnings.length})**\n`;
          warnings.forEach(g => { reply += `• ${g.message}\n`; });
          reply += "\n";
        }
        if (infos.length > 0) {
          reply += `ℹ **Info (${infos.length})**\n`;
          infos.forEach(g => { reply += `• ${g.message}\n`; });
        }
        if (data.gaps.length === 0) reply += "✅ All checks passed — system is fully configured.";
        reply += "\n\nSee the System Health panel above for direct fix links.";
        setMessages(prev => [...prev, { role: "assistant", content: reply }]);
        setStreamingText("");
        setStreaming(false);
        return;
      } catch {
        setStreamingText("");
        setStreaming(false);
      }
    }

    // Check for "approve" command
    if (/^(approve|create it|yes|create)$/i.test(text.trim()) && pendingProposal) {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      createGoalMutation.mutate(pendingProposal);
      return;
    }

    const userMsg: ConversationMessage = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    setPendingProposal(null);

    const conversationHistory = history.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ceo/copilot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, conversationHistory }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let goalProposalData: ParsedGoalProposal | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamingText(stripProposalMarkers(accumulated));
            }
            if (parsed.goalProposal) {
              goalProposalData = parsed.goalProposal;
              setPendingProposal(parsed.goalProposal);
            }
            if (parsed.done) {
              const displayText = stripProposalMarkers(accumulated);
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: displayText, goalProposal: goalProposalData },
              ]);
              setStreamingText("");
              accumulated = "";
            }
            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (parseErr) {
            // ignore individual parse errors
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("[copilot] stream error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that request. Please try again.",
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  }, [messages, streaming, pendingProposal, createGoalMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Only render for super_admin
  if (!user || user.role !== "super_admin") return null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-screen z-40 flex flex-col transition-all duration-300 shadow-2xl border-l border-border bg-background",
        expanded ? "w-[380px]" : "w-10"
      )}
      data-testid="copilot-panel"
    >
      {/* Tab / toggle button */}
      <button
        onClick={toggleExpanded}
        className={cn(
          "absolute -left-8 top-1/2 -translate-y-1/2 flex items-center justify-center",
          "w-8 h-16 rounded-l-lg bg-primary text-primary-foreground shadow-lg",
          "hover:bg-primary/90 transition-colors"
        )}
        data-testid="copilot-toggle"
        aria-label={expanded ? "Collapse Copilot" : "Expand Copilot"}
      >
        <div className={cn("flex flex-col items-center gap-1", !expanded && "rotate-0")}>
          {expanded ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!expanded && (
            <span className="text-[8px] font-bold tracking-widest writing-mode-vertical rotate-90 whitespace-nowrap">
              AI
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-border bg-primary text-primary-foreground shrink-0">
            <Bot className="h-4 w-4" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none">CEO Copilot</p>
              <p className="text-[10px] text-primary-foreground/70 mt-0.5">Powered by your live system data</p>
            </div>
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 bg-primary-foreground/20 text-primary-foreground border-0">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Live
            </Badge>
          </div>

          {/* Conversation area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto py-3 space-y-3"
            data-testid="copilot-messages"
          >
            {/* Signals + System Health — shown when no messages yet */}
            {messages.length === 0 && !streaming && (
              <div className="space-y-3" data-testid="copilot-starters">
                {/* Proactive signals feed */}
                <div className="border-b pb-3 mb-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-2">
                    Signals
                  </p>
                  <SignalsFeed onSignalClick={sendMessage} />
                </div>

                {/* System health / audit */}
                <SystemHealthPanel onNavigate={setLocation} />

                {/* Starter questions */}
                <p className="text-xs text-muted-foreground text-center">
                  Ask me anything about the business
                </p>
                {STARTERS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors mx-0"
                    data-testid={`copilot-starter-${i}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "max-w-full rounded-lg px-3 py-2 text-xs leading-relaxed mx-3",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-8"
                    : "bg-muted mr-4"
                )}
                data-testid={`copilot-msg-${idx}`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {/* Inline goal proposal approve button */}
                {msg.role === "assistant" && msg.goalProposal && !approvedGoalId && idx === messages.length - 1 && (
                  <div className="mt-3 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2">
                      <Target className="h-3 w-3" />
                      <span>Goal proposal ready</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => {
                          if (msg.goalProposal) createGoalMutation.mutate(msg.goalProposal);
                        }}
                        disabled={createGoalMutation.isPending}
                        data-testid="copilot-approve-goal"
                      >
                        {createGoalMutation.isPending ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                        )}
                        Approve & Create
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setPendingProposal(null);
                          setMessages((prev) =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, goalProposal: null } : m
                            )
                          );
                        }}
                        data-testid="copilot-decline-goal"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Streaming text */}
            {streaming && streamingText && (
              <div className="bg-muted mx-3 mr-4 rounded-lg px-3 py-2 text-xs leading-relaxed" data-testid="copilot-streaming">
                <p className="whitespace-pre-wrap">{streamingText}</p>
                <span className="inline-block w-1.5 h-3 bg-foreground/50 ml-0.5 animate-pulse rounded-sm" />
              </div>
            )}

            {streaming && !streamingText && (
              <div className="bg-muted mx-3 mr-4 rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2" data-testid="copilot-loading">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border shrink-0 space-y-2">
            {pendingProposal && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-primary/5 border border-primary/20 rounded px-2 py-1">
                <Target className="h-3 w-3 text-primary shrink-0" />
                <span>Goal proposal pending — type <strong>approve</strong> to create it</span>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Ask about the business, or "audit the system"…'
                className="resize-none text-xs min-h-[52px] max-h-[120px]"
                disabled={streaming}
                data-testid="copilot-input"
                rows={2}
              />
              <Button
                size="sm"
                onClick={() => sendMessage(input)}
                disabled={streaming || !input.trim()}
                className="shrink-0 self-end h-8 w-8 p-0"
                data-testid="copilot-send"
              >
                {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </>
      )}

      {!expanded && (
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
