import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StudioShell } from "@/components/studio/StudioShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import {
  FileText,
  DollarSign,
  Phone,
  Mail,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookmarkPlus,
  Lock,
  ShieldAlert,
  KeyRound,
  Pencil,
  Plus,
  Trash2,
  ChevronUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { FieldHelp } from "@/components/studio/FieldHelp";

// ── Types ──────────────────────────────────────────────────────────────────────

type TemplateId =
  | "bd_proposal_outline"
  | "bd_rate_card_talking_points"
  | "bd_call_prep_brief"
  | "bd_follow_up_sequence";

interface TemplateConfig {
  id: TemplateId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: FieldConfig[];
}

interface FieldConfig {
  key: string;
  label: string;
  type: "input" | "textarea" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: "bd_proposal_outline",
    label: "Proposal Outline",
    description: "Structured proposal: pain points, approach, value props, and next steps.",
    icon: FileText,
    fields: [
      { key: "target_company", label: "Target Company", type: "input", placeholder: "e.g. Sunrise Health System" },
      { key: "contact_role", label: "Contact's Role", type: "input", placeholder: "e.g. VP of Nursing Operations" },
      {
        key: "domain",
        label: "Domain",
        type: "select",
        options: [
          { value: "Healthcare", label: "Healthcare" },
          { value: "IT / Technology", label: "IT / Technology" },
          { value: "Engineering", label: "Engineering" },
          { value: "Professional Services", label: "Professional Services" },
        ],
      },
      {
        key: "engagement_model",
        label: "Engagement Model",
        type: "select",
        options: [
          { value: "Contract", label: "Contract" },
          { value: "Contract-to-Hire", label: "Contract-to-Hire" },
          { value: "Permanent", label: "Permanent" },
          { value: "Mixed", label: "Mixed" },
        ],
      },
      { key: "pain_point", label: "Key Pain Point", type: "textarea", placeholder: "e.g. 12 RN roles open 75+ days; agency they used had high fallout rate" },
      { key: "rate_info", label: "Rates / Numbers (optional)", type: "input", placeholder: "e.g. 22% perm fee; $85/hr contract", optional: true },
      { key: "additional_context", label: "Additional Context (optional)", type: "textarea", placeholder: "Recent news, known stakeholders, previous interactions…", optional: true },
    ],
  },
  {
    id: "bd_rate_card_talking_points",
    label: "Rate Card Talking Points",
    description: "Frame fees as ROI. Includes objection responses for price pushback.",
    icon: DollarSign,
    fields: [
      {
        key: "domain",
        label: "Domain",
        type: "select",
        options: [
          { value: "Healthcare", label: "Healthcare" },
          { value: "IT / Technology", label: "IT / Technology" },
          { value: "Engineering", label: "Engineering" },
          { value: "Professional Services", label: "Professional Services" },
        ],
      },
      { key: "contact_role", label: "Contact's Role", type: "input", placeholder: "e.g. CFO, HR Director, IT Director" },
      { key: "rate_info", label: "Rates / Fees You're Presenting", type: "input", placeholder: "e.g. 20% perm fee; $90/hr contract rate" },
      { key: "target_company", label: "Target Company (optional)", type: "input", placeholder: "e.g. Apex Engineering Group", optional: true },
      { key: "pain_point", label: "Client's Key Pain (optional)", type: "textarea", placeholder: "e.g. Direct hiring taking 90+ days; high turnover post-hire", optional: true },
      { key: "additional_context", label: "Additional Context (optional)", type: "textarea", placeholder: "Any budget constraints, competitor context…", optional: true },
    ],
  },
  {
    id: "bd_call_prep_brief",
    label: "Call Prep Brief",
    description: "Discovery questions, likely objections, and a suggested call flow for a specific account.",
    icon: Phone,
    fields: [
      { key: "target_company", label: "Target Company", type: "input", placeholder: "e.g. Meridian IT Solutions" },
      { key: "contact_role", label: "Contact's Role", type: "input", placeholder: "e.g. VP Engineering" },
      {
        key: "domain",
        label: "Domain",
        type: "select",
        options: [
          { value: "Healthcare", label: "Healthcare" },
          { value: "IT / Technology", label: "IT / Technology" },
          { value: "Engineering", label: "Engineering" },
          { value: "Professional Services", label: "Professional Services" },
        ],
      },
      { key: "pain_point", label: "Known Pain Point (optional)", type: "textarea", placeholder: "e.g. 8 cloud roles open; previous contractor no-showed on start date", optional: true },
      { key: "additional_context", label: "Research Notes (optional)", type: "textarea", placeholder: "Recent funding, expansion news, LinkedIn activity…", optional: true },
    ],
  },
  {
    id: "bd_follow_up_sequence",
    label: "Follow-Up Sequence",
    description: "Multi-touch follow-up copy across email and/or LinkedIn — ready to personalise and send.",
    icon: Mail,
    fields: [
      { key: "target_company", label: "Target Company", type: "input", placeholder: "e.g. PrecisionPath Engineering" },
      { key: "contact_role", label: "Contact's Role", type: "input", placeholder: "e.g. Director of Talent Acquisition" },
      {
        key: "domain",
        label: "Domain",
        type: "select",
        options: [
          { value: "Healthcare", label: "Healthcare" },
          { value: "IT / Technology", label: "IT / Technology" },
          { value: "Engineering", label: "Engineering" },
          { value: "Professional Services", label: "Professional Services" },
        ],
      },
      { key: "pain_point", label: "Key Pain Point (optional)", type: "textarea", placeholder: "e.g. High-volume roles, slow time-to-fill", optional: true },
      { key: "previous_interaction", label: "Previous Interaction (optional)", type: "textarea", placeholder: "e.g. Had a discovery call last week, sent proposal — went quiet", optional: true },
      {
        key: "step_count",
        label: "Number of Touches",
        type: "select",
        options: [
          { value: "3", label: "3 touches" },
          { value: "4", label: "4 touches" },
          { value: "5", label: "5 touches" },
          { value: "6", label: "6 touches" },
        ],
      },
      {
        key: "channels",
        label: "Channels",
        type: "select",
        options: [
          { value: "email", label: "Email only" },
          { value: "LinkedIn", label: "LinkedIn only" },
          { value: "mixed (email + LinkedIn)", label: "Mixed (email + LinkedIn)" },
        ],
      },
      { key: "additional_context", label: "Additional Context (optional)", type: "textarea", placeholder: "Any relevant details, tone preferences…", optional: true },
    ],
  },
];

// ── Output renderers ──────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs hover:bg-muted transition-colors"
      data-testid="button-copy-output"
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StrList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 space-y-1.5 text-sm">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="leading-relaxed">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function ObjList({ items }: { items: { objection: string; response: string }[] }) {
  return (
    <div className="mt-2 space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-semibold text-foreground">"{item.objection}"</p>
          <p className="mt-1.5 text-muted-foreground">{item.response}</p>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, text }: { title: string; children: React.ReactNode; text?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b pb-4 last:border-b-0">
      <button
        className="flex w-full items-center gap-2 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
        data-testid={`section-toggle-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-semibold">{title}</span>
        {text && (
          <span className="ml-auto">
            <CopyButton text={text} />
          </span>
        )}
      </button>
      {open && <div className="pl-6">{children}</div>}
    </div>
  );
}

function ProposalOutput({ data }: { data: any }) {
  const fullText = [
    data.title,
    "\nExecutive Summary\n" + data.executive_summary,
    "\nClient Pain Points\n" + (data.client_pain_points || []).join("\n- "),
    "\nOur Approach\n" + data.our_approach,
    "\nEngagement Model\n" + data.engagement_model_notes,
    "\nValue Propositions\n" + (data.value_propositions || []).join("\n- "),
    "\nNext Steps\n" + (data.next_steps || []).join("\n- "),
    "\nCustomisation Notes\n" + data.customization_notes,
  ].join("\n\n");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <p className="text-base font-bold">{data.title}</p>
        <CopyButton text={fullText} />
      </div>
      <Section title="Executive Summary" text={data.executive_summary}>
        <p className="text-sm leading-relaxed">{data.executive_summary}</p>
      </Section>
      <Section title="Client Pain Points" text={(data.client_pain_points || []).join("\n")}>
        <StrList items={data.client_pain_points || []} />
      </Section>
      <Section title="Our Approach" text={data.our_approach}>
        <p className="text-sm leading-relaxed">{data.our_approach}</p>
      </Section>
      <Section title="Engagement Model Notes" text={data.engagement_model_notes}>
        <p className="text-sm leading-relaxed">{data.engagement_model_notes}</p>
      </Section>
      <Section title="Value Propositions" text={(data.value_propositions || []).join("\n")}>
        <StrList items={data.value_propositions || []} />
      </Section>
      <Section title="Next Steps" text={(data.next_steps || []).join("\n")}>
        <StrList items={data.next_steps || []} />
      </Section>
      <Section title="Customisation Notes" text={data.customization_notes}>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.customization_notes}</p>
      </Section>
    </div>
  );
}

function RateCardOutput({ data }: { data: any }) {
  const fullText = [
    "Key Messages\n" + (data.key_messages || []).join("\n- "),
    "\nValue Framing\n" + data.value_framing,
    "\nObjection Responses\n" + (data.objection_responses || []).map((o: any) => `"${o.objection}"\n${o.response}`).join("\n\n"),
    "\nClosing Line\n" + data.closing_line,
  ].join("\n\n");
  return (
    <div className="space-y-1">
      <div className="flex justify-end pb-2"><CopyButton text={fullText} /></div>
      <Section title="Key Messages" text={(data.key_messages || []).join("\n")}>
        <StrList items={data.key_messages || []} />
      </Section>
      <Section title="Value Framing" text={data.value_framing}>
        <p className="text-sm leading-relaxed">{data.value_framing}</p>
      </Section>
      <Section title="Objection Responses">
        <ObjList items={data.objection_responses || []} />
      </Section>
      <Section title="Closing Line" text={data.closing_line}>
        <p className="text-sm leading-relaxed font-medium">{data.closing_line}</p>
      </Section>
    </div>
  );
}

function CallPrepOutput({ data }: { data: any }) {
  const fullText = [
    "Call Objective: " + data.call_objective,
    "\nCompany Context\n" + data.company_context,
    "\nDiscovery Questions\n" + (data.discovery_questions || []).map((q: string, i: number) => `${i + 1}. ${q}`).join("\n"),
    "\nLikely Objections\n" + (data.likely_objections || []).map((o: any) => `"${o.objection}"\n${o.response}`).join("\n\n"),
    "\nPositioning Angles\n" + (data.positioning_angles || []).join("\n- "),
    "\nSuggested Call Flow\n" + (data.suggested_call_flow || []).map((s: string, i: number) => `${i + 1}. ${s}`).join("\n"),
    "\nFollow-Up Note\n" + data.follow_up_note,
  ].join("\n\n");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-semibold">Objective: {data.call_objective}</p>
        <CopyButton text={fullText} />
      </div>
      <Section title="Company Context" text={data.company_context}>
        <p className="text-sm leading-relaxed">{data.company_context}</p>
      </Section>
      <Section title="Discovery Questions" text={(data.discovery_questions || []).join("\n")}>
        <ol className="mt-1.5 space-y-1.5 text-sm list-decimal pl-5">
          {(data.discovery_questions || []).map((q: string, i: number) => <li key={i}>{q}</li>)}
        </ol>
      </Section>
      <Section title="Likely Objections">
        <ObjList items={data.likely_objections || []} />
      </Section>
      <Section title="Positioning Angles" text={(data.positioning_angles || []).join("\n")}>
        <StrList items={data.positioning_angles || []} />
      </Section>
      <Section title="Suggested Call Flow" text={(data.suggested_call_flow || []).join("\n")}>
        <ol className="mt-1.5 space-y-1.5 text-sm list-decimal pl-5">
          {(data.suggested_call_flow || []).map((s: string, i: number) => <li key={i}>{s}</li>)}
        </ol>
      </Section>
      <Section title="Follow-Up Note" text={data.follow_up_note}>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.follow_up_note}</p>
      </Section>
    </div>
  );
}

function FollowUpOutput({ data }: { data: any }) {
  const touches = data.touches || [];
  const fullText = [
    data.sequence_summary,
    ...touches.map((t: any) =>
      `Touch ${t.step} — ${t.channel} (${t.timing_note})\nSubject/Hook: ${t.subject_or_hook}\n\n${t.body}\n\nPurpose: ${t.purpose}`
    ),
  ].join("\n\n---\n\n");
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm text-muted-foreground leading-relaxed">{data.sequence_summary}</p>
        <CopyButton text={fullText} />
      </div>
      {touches.map((t: any) => (
        <Section key={t.step} title={`Touch ${t.step} — ${t.channel} (${t.timing_note})`} text={`${t.subject_or_hook}\n\n${t.body}`}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.subject_or_hook}
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.body}</p>
          <p className="mt-2 text-xs italic text-muted-foreground">Purpose: {t.purpose}</p>
        </Section>
      ))}
    </div>
  );
}

function OutputPanel({ contentType, output }: { contentType: TemplateId; output: any }) {
  if (contentType === "bd_proposal_outline") return <ProposalOutput data={output} />;
  if (contentType === "bd_rate_card_talking_points") return <RateCardOutput data={output} />;
  if (contentType === "bd_call_prep_brief") return <CallPrepOutput data={output} />;
  if (contentType === "bd_follow_up_sequence") return <FollowUpOutput data={output} />;
  return <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(output, null, 2)}</pre>;
}

// ── Form ──────────────────────────────────────────────────────────────────────

function TemplateForm({
  config,
  projectId,
  onResult,
}: {
  config: TemplateConfig;
  projectId: string;
  onResult: (contentType: TemplateId, output: any) => void;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  const setVal = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  const mutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      fetch(`/api/studio/bd/generate/${config.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...body, ...(projectId ? { projectId } : {}) }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Generation failed");
        return json;
      }),
    onSuccess: (data) => onResult(config.id, data.output),
    onError: (err: any) =>
      toast({ title: "Generation failed", description: err?.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const required = config.fields.filter((f) => !f.optional).map((f) => f.key);
    const missing = required.filter((k) => !values[k]?.trim());
    if (missing.length) {
      toast({ description: `Please fill in: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    mutation.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {config.fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`field-${field.key}`} className="flex items-center gap-1.5">
            {field.label}
            {field.optional && <span className="ml-0 text-xs text-muted-foreground">(optional)</span>}
            {field.key === "engagement_model" && <FieldHelp id="bd-engagement-model" />}
            {field.key === "rate_info" && <FieldHelp id="bd-rate-info" />}
            {field.key === "pain_point" && <FieldHelp id="bd-client-pain-points" />}
            {field.key === "additional_context" && field.label.toLowerCase().includes("research") && <FieldHelp id="bd-research-notes" />}
          </Label>
          {field.type === "select" && field.options ? (
            <Select
              value={values[field.key] || ""}
              onValueChange={(v) => setVal(field.key, v)}
            >
              <SelectTrigger id={`field-${field.key}`} data-testid={`select-${field.key}`}>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((o) => (
                  <SelectItem key={o.value} value={o.value} data-testid={`option-${field.key}-${o.value}`}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.type === "textarea" ? (
            <Textarea
              id={`field-${field.key}`}
              value={values[field.key] || ""}
              onChange={(e) => setVal(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="min-h-[80px]"
              data-testid={`textarea-${field.key}`}
            />
          ) : (
            <Input
              id={`field-${field.key}`}
              value={values[field.key] || ""}
              onChange={(e) => setVal(field.key, e.target.value)}
              placeholder={field.placeholder}
              data-testid={`input-${field.key}`}
            />
          )}
        </div>
      ))}
      <Button type="submit" disabled={mutation.isPending} className="w-full" data-testid="button-generate-bd-template">
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate
          </>
        )}
      </Button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

// ── Master Edit types ──────────────────────────────────────────────────────────

interface MasterDeck {
  id: string;
  title: string;
  domain: string;
  deck_type: string;
  status: string;
  is_locked: boolean;
  locked_at: string | null;
  updated_at: string;
  slides: Array<{ title: string; bullets: string[]; speaker_notes: string }>;
}

export default function BdTemplatesView() {
  const { can, role } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>("bd_proposal_outline");
  const [result, setResult] = useState<{ contentType: TemplateId; output: any } | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveProjectId, setSaveProjectId] = useState("");

  const canUseBd = can("studio.bd_agent");
  const isSuperAdmin = role === "super_admin";

  // ── Master Edit state ──────────────────────────────────────────────────────
  const [masterEditOpen, setMasterEditOpen] = useState(false);
  const [masterEditDeck, setMasterEditDeck] = useState<MasterDeck | null>(null);
  const [masterEditStep, setMasterEditStep] = useState<"totp" | "slides">("totp");
  const [totpCode, setTotpCode] = useState("");
  const [totpVerified, setTotpVerified] = useState(false);
  const [masterEditSlides, setMasterEditSlides] = useState<Array<{ title: string; bullets: string; speaker_notes: string }>>([]);
  const [masterEditTitle, setMasterEditTitle] = useState("");
  const [masterChangesSummary, setMasterChangesSummary] = useState("");

  const { data: bdProjects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/studio/bd/projects"],
    enabled: canUseBd,
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => {
    if (bdProjects.length && !selectedProjectId) setSelectedProjectId(bdProjects[0].id);
  }, [bdProjects, selectedProjectId]);

  // Master decks query (only fetched for super_admin)
  const { data: allDecks = [] } = useQuery<MasterDeck[]>({
    queryKey: ["/api/bd/decks"],
    enabled: isSuperAdmin && canUseBd,
  });
  const masterDecks = allDecks.filter((d) => d.deck_type === "master");

  // TOTP preflight verify mutation
  const totpVerifyMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest("POST", "/api/bd/decks/verify-totp", { totp_code: code }).then((r: any) => r.json()),
    onSuccess: () => {
      setTotpVerified(true);
      setMasterEditStep("slides");
    },
    onError: (err: any) => {
      const msg = err?.message || "Verification failed";
      if (msg.includes("TOTP_INVALID") || msg.toLowerCase().includes("invalid totp")) {
        toast({ title: "Invalid code", description: "That code didn't match. Check your authenticator and try again.", variant: "destructive" });
      } else if (msg.includes("TOTP_NOT_CONFIGURED")) {
        toast({ title: "2FA not configured", description: "Your account doesn't have TOTP set up. Go to Security settings first.", variant: "destructive" });
      } else {
        toast({ title: "Verification failed", description: msg, variant: "destructive" });
      }
    },
  });

  // TOTP-gated master edit mutation
  const masterEditMutation = useMutation({
    mutationFn: (body: {
      deckId: string;
      totp_code: string;
      slides: Array<{ title: string; bullets: string[]; speaker_notes: string }>;
      title?: string;
      changes_summary?: string;
    }) =>
      apiRequest("POST", `/api/bd/decks/${body.deckId}/master-edit`, {
        totp_code: body.totp_code,
        slides: body.slides,
        title: body.title,
        changes_summary: body.changes_summary,
      }).then((r: any) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bd/decks"] });
      toast({ title: "Master deck updated", description: "Slides have been saved and the audit log updated." });
      setMasterEditOpen(false);
      resetMasterEditState();
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to save master deck";
      if (msg.includes("TOTP_INVALID") || msg.toLowerCase().includes("invalid totp")) {
        toast({ title: "TOTP expired", description: "Your code expired. Re-enter your current authenticator code.", variant: "destructive" });
      } else {
        toast({ title: "Save failed", description: msg, variant: "destructive" });
      }
    },
  });

  function resetMasterEditState() {
    setMasterEditDeck(null);
    setMasterEditStep("totp");
    setTotpCode("");
    setTotpVerified(false);
    setMasterEditSlides([]);
    setMasterEditTitle("");
    setMasterChangesSummary("");
  }

  function openMasterEdit(deck: MasterDeck) {
    setMasterEditDeck(deck);
    setMasterEditTitle(deck.title);
    setMasterEditSlides(
      (deck.slides || []).map((s) => ({
        title: s.title,
        bullets: (s.bullets || []).join("\n"),
        speaker_notes: s.speaker_notes || "",
      }))
    );
    setMasterEditStep("totp");
    setTotpCode("");
    setTotpVerified(false);
    setMasterChangesSummary("");
    setMasterEditOpen(true);
  }

  function handleMasterSave() {
    if (!masterEditDeck) return;
    const parsedSlides = masterEditSlides.map((s) => ({
      title: s.title.trim(),
      bullets: s.bullets.split("\n").map((b) => b.trim()).filter(Boolean),
      speaker_notes: s.speaker_notes.trim(),
    }));
    masterEditMutation.mutate({
      deckId: masterEditDeck.id,
      totp_code: totpCode.trim(),
      slides: parsedSlides,
      title: masterEditTitle.trim() || undefined,
      changes_summary: masterChangesSummary.trim() || undefined,
    });
  }

  const saveIdeaMutation = useMutation({
    mutationFn: (body: { title: string; content: string; contentType: string; projectId: string }) =>
      apiRequest("POST", "/api/studio/bd/save-as-idea", body).then((r: any) => r.json()),
    onSuccess: () => {
      toast({ title: "Saved!", description: "Added to your Studio content pipeline." });
      setSaveOpen(false);
    },
    onError: (err: any) =>
      toast({ title: "Save failed", description: err?.message, variant: "destructive" }),
  });

  if (!canUseBd) {
    return (
      <StudioShell>
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <p className="text-lg font-semibold">Access restricted</p>
          <p className="text-sm text-muted-foreground">BD Templates are available to super admins, admins, and HR managers.</p>
        </div>
      </StudioShell>
    );
  }

  const activeConfig = TEMPLATES.find((t) => t.id === activeTemplate)!;

  const handleResult = (contentType: TemplateId, output: any) => {
    setResult({ contentType, output });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <StudioShell>
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-bd-templates-title">
              BD Templates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-generated proposals, rate card talking points, call prep briefs, and follow-up sequences.
              All copy is for manual use — never auto-sent.
            </p>
          </div>
          {bdProjects.length > 0 && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="text-xs text-muted-foreground">Brand voice project</p>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="h-8 w-48 text-xs" data-testid="select-bd-template-project">
                  <SelectValue placeholder="Select project…" />
                </SelectTrigger>
                <SelectContent>
                  {bdProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Template picker */}
        <aside className="space-y-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => { setActiveTemplate(tpl.id); setResult(null); }}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                activeTemplate === tpl.id
                  ? "border-primary/40 bg-primary/5"
                  : "hover:bg-muted/60"
              }`}
              data-testid={`button-template-${tpl.id}`}
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                activeTemplate === tpl.id ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <tpl.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-snug">{tpl.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{tpl.description}</p>
              </div>
            </button>
          ))}
        </aside>

        {/* Form + output */}
        <div className="space-y-6">
          {/* Form card */}
          <div className="rounded-xl border bg-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <activeConfig.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{activeConfig.label}</p>
                <p className="text-xs text-muted-foreground">{activeConfig.description}</p>
              </div>
            </div>
            <Separator className="mb-4" />
            <TemplateForm config={activeConfig} projectId={selectedProjectId} onResult={handleResult} />
          </div>

          {/* Output card */}
          {result && result.contentType === activeTemplate && (
            <div className="rounded-xl border bg-card p-5" data-testid="bd-template-output">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Generated</Badge>
                  <p className="text-xs text-muted-foreground">
                    Copy is for manual use — personalise before sending.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => {
                    setSaveTitle(activeConfig.label);
                    setSaveProjectId(bdProjects[0]?.id ?? "");
                    setSaveOpen(true);
                  }}
                  data-testid="button-bd-save-as-idea"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save as content idea
                </Button>
              </div>
              <Separator className="mb-4" />
              <OutputPanel contentType={result.contentType} output={result.output} />
            </div>
          )}
        </div>
      </div>

      {/* Master Decks — super_admin only */}
      {isSuperAdmin && (
        <div className="mt-10">
          <Separator className="mb-6" />
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-sm">Master Deck Governance</p>
              <p className="text-xs text-muted-foreground">
                Locked master templates — edits require TOTP verification. All changes are audit-logged.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 dark:border-amber-800/30 dark:bg-amber-950/10">
            <div className="p-4 space-y-3">
              {masterDecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No master decks found.</p>
              ) : (
                masterDecks.map((deck) => (
                  <div
                    key={deck.id}
                    className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
                    data-testid={`master-deck-row-${deck.domain}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Lock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">{deck.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-xs capitalize px-1.5 py-0">{deck.domain}</Badge>
                          <Badge
                            variant={deck.is_locked ? "secondary" : "outline"}
                            className={`text-xs px-1.5 py-0 ${deck.is_locked ? "text-amber-700 bg-amber-100 border-amber-200" : ""}`}
                          >
                            {deck.is_locked ? "Locked" : "Unlocked"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{(deck.slides || []).length} slides</span>
                          {deck.updated_at && (
                            <span className="text-xs text-muted-foreground" data-testid={`text-master-last-edited-${deck.domain}`}>
                              · Last edited {new Date(deck.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 h-8 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => openMasterEdit(deck)}
                      data-testid={`button-master-edit-${deck.domain}`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Edit (TOTP)
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Master Edit Tool dialog */}
      <Dialog
        open={masterEditOpen}
        onOpenChange={(v) => {
          if (!v) { setMasterEditOpen(false); resetMasterEditState(); }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-600" />
              Master Deck Edit — {masterEditDeck?.title ?? ""}
            </DialogTitle>
          </DialogHeader>

          {masterEditStep === "totp" && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">TOTP verification required</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    This master deck is governance-locked. Enter your authenticator code to proceed.
                    All changes are permanently logged.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="master-totp">Authenticator code (6 digits)</Label>
                <Input
                  id="master-totp"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="font-mono text-center tracking-widest text-lg w-40"
                  data-testid="input-master-totp"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && totpCode.length === 6 && !totpVerifyMutation.isPending) {
                      totpVerifyMutation.mutate(totpCode);
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Code expires every 30 seconds. Enter it and click Verify before it rotates.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setMasterEditOpen(false); resetMasterEditState(); }}>Cancel</Button>
                <Button
                  disabled={totpCode.length !== 6 || totpVerifyMutation.isPending}
                  onClick={() => totpVerifyMutation.mutate(totpCode)}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="button-master-totp-continue"
                >
                  {totpVerifyMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
                  ) : (
                    "Verify & Continue"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {masterEditStep === "slides" && masterEditDeck && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="master-title">Deck title</Label>
                <Input
                  id="master-title"
                  value={masterEditTitle}
                  onChange={(e) => setMasterEditTitle(e.target.value)}
                  placeholder="Deck title"
                  data-testid="input-master-title"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Slides ({masterEditSlides.length})</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() =>
                      setMasterEditSlides((prev) => [
                        ...prev,
                        { title: "", bullets: "", speaker_notes: "" },
                      ])
                    }
                    data-testid="button-add-slide"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add slide
                  </Button>
                </div>

                {masterEditSlides.map((slide, idx) => (
                  <div key={idx} className="rounded-lg border bg-muted/20 p-3 space-y-2" data-testid={`slide-editor-${idx}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Slide {idx + 1} of {masterEditSlides.length}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          disabled={idx === 0}
                          onClick={() =>
                            setMasterEditSlides((prev) => {
                              const next = [...prev];
                              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                              return next;
                            })
                          }
                          title="Move slide up"
                          data-testid={`button-slide-up-${idx}`}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          disabled={idx === masterEditSlides.length - 1}
                          onClick={() =>
                            setMasterEditSlides((prev) => {
                              const next = [...prev];
                              [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                              return next;
                            })
                          }
                          title="Move slide down"
                          data-testid={`button-slide-down-${idx}`}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() =>
                            setMasterEditSlides((prev) => prev.filter((_, i) => i !== idx))
                          }
                          data-testid={`button-remove-slide-${idx}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Title</Label>
                      <Input
                        value={slide.title}
                        onChange={(e) =>
                          setMasterEditSlides((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s))
                          )
                        }
                        placeholder="Slide title"
                        className="h-8 text-sm"
                        data-testid={`input-slide-title-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Bullets (one per line)</Label>
                      <Textarea
                        value={slide.bullets}
                        onChange={(e) =>
                          setMasterEditSlides((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, bullets: e.target.value } : s))
                          )
                        }
                        placeholder="Bullet 1&#10;Bullet 2&#10;Bullet 3"
                        className="min-h-[80px] text-sm"
                        data-testid={`textarea-slide-bullets-${idx}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Speaker notes</Label>
                      <Textarea
                        value={slide.speaker_notes}
                        onChange={(e) =>
                          setMasterEditSlides((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, speaker_notes: e.target.value } : s))
                          )
                        }
                        placeholder="Notes for the presenter…"
                        className="min-h-[60px] text-sm"
                        data-testid={`textarea-slide-notes-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="master-changes-summary">Changes summary (required for audit log)</Label>
                <Textarea
                  id="master-changes-summary"
                  value={masterChangesSummary}
                  onChange={(e) => setMasterChangesSummary(e.target.value)}
                  placeholder="Describe what was changed and why…"
                  className="min-h-[60px]"
                  data-testid="textarea-master-changes-summary"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Your TOTP code ({totpCode}) will be verified server-side when you save. All changes are permanently logged.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setMasterEditOpen(false); resetMasterEditState(); }}>Cancel</Button>
                <Button
                  disabled={masterEditMutation.isPending || !masterChangesSummary.trim()}
                  onClick={handleMasterSave}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  data-testid="button-master-save"
                >
                  {masterEditMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  ) : (
                    <><Pencil className="mr-2 h-4 w-4" />Save Master Deck</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save as content idea dialog */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as Content Idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="save-title">Topic / title</Label>
              <Input
                id="save-title"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Enter a title for the content idea"
                data-testid="input-save-idea-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="save-project">Studio project</Label>
              {bdProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Studio projects found. Create a project first.</p>
              ) : (
                <Select value={saveProjectId} onValueChange={setSaveProjectId}>
                  <SelectTrigger id="save-project" data-testid="select-save-project">
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
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button
              disabled={!saveTitle.trim() || !saveProjectId || saveIdeaMutation.isPending || bdProjects.length === 0}
              onClick={() =>
                saveIdeaMutation.mutate({
                  title: saveTitle.trim(),
                  content: JSON.stringify(result?.output ?? {}, null, 2),
                  contentType: "other",
                  projectId: saveProjectId,
                })
              }
              data-testid="button-bd-confirm-save"
            >
              {saveIdeaMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </StudioShell>
  );
}
