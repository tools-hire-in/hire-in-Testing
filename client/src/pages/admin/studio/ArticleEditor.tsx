import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { AIErrorBanner } from "@/components/studio/AIErrorBanner";
import { StudioTip } from "@/components/studio/StudioTip";
import { FieldHelp } from "@/components/studio/FieldHelp";
import { studioPath } from "@/lib/studioBase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code,
  Loader2,
  ArrowLeft,
  Save,
  History,
  RotateCcw,
  ImagePlus,
  Clock3,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wand2,
  Share2,
  Copy,
  AlertTriangle,
  ShieldCheck,
  Download,
  RefreshCw,
  Lock,
  Recycle,
  Zap,
  CheckCircle2,
  XCircle,
  Target,
  Users,
  FileSearch,
  BookOpen,
  HelpCircle,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { COMPLIANCE_MODES, type CanonicalSocialKit } from "@shared/studioAi";
import {
  STUDIO_CONTENT_TYPES,
  STUDIO_CHANNELS,
  getStudioContentType,
  computeReadTime,
} from "@shared/studioContent";
import { STATUS_LABELS, STATUS_BADGE_CLASS } from "./studioConstants";
import { ForcePublishButton } from "./ForcePublishButton";
import { ArticleRegenPanel } from "./ArticleRegenPanel";
import type { StudioArticle, StudioArticleVersion, StudioAuthorProfile, StudioContentIdea } from "@shared/schema";
import { cardVariantsForLayout, cardBudget, type CardBudget } from "@shared/socialCards";

// CMO Copilot v2.1 — simplified generation format options.
// Each format maps to a content type + content goal so the intelligence engine
// fires correctly without requiring the user to fill strategy fields manually.
const FORMAT_OPTIONS = [
  { value: "thought_leadership", label: "Thought Leadership Article", contentType: "thought_leadership", contentGoal: "THOUGHT_LEADERSHIP", platform: "ARTICLE" },
  { value: "educational", label: "Educational / How-To", contentType: "how_to", contentGoal: "EDUCATIONAL", platform: "ARTICLE" },
  { value: "job_marketing", label: "Job Marketing Post", contentType: "job_marketing", contentGoal: "JOB_MARKETING", platform: "ARTICLE" },
  { value: "brand_perspective", label: "Brand Perspective", contentType: "brand_perspective", contentGoal: "BRAND_PERSPECTIVE", platform: "ARTICLE" },
  { value: "insights", label: "Hire'in Insights Article", contentType: "insights", contentGoal: "THOUGHT_LEADERSHIP", platform: "ARTICLE" },
  { value: "linkedin_post", label: "LinkedIn Post", contentType: "linkedin_post", contentGoal: "THOUGHT_LEADERSHIP", platform: "LINKEDIN" },
  { value: "instagram", label: "Instagram", contentType: "instagram", contentGoal: "BRAND_PERSPECTIVE", platform: "INSTAGRAM" },
  { value: "x_post", label: "X / Twitter", contentType: "x_post", contentGoal: "THOUGHT_LEADERSHIP", platform: "X" },
] as const;

// ---------------------------------------------------------------------------
// Psychological Brief constants (Task #1060)
// ---------------------------------------------------------------------------
const PLATFORM_OPTIONS = [
  { value: "ARTICLE", label: "Article" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "X", label: "X / Twitter" },
];

const PLATFORM_CONTENT_INTENTS: Record<string, { value: string; label: string; contentGoal: string; contentType: string }[]> = {
  ARTICLE: [
    { value: "thought_leadership", label: "Thought Leadership", contentGoal: "THOUGHT_LEADERSHIP", contentType: "thought_leadership" },
    { value: "educational", label: "Educational / How-To", contentGoal: "EDUCATIONAL", contentType: "how_to" },
    { value: "job_marketing", label: "Job Marketing", contentGoal: "JOB_MARKETING", contentType: "job_marketing" },
    { value: "brand_perspective", label: "Brand Perspective", contentGoal: "BRAND_PERSPECTIVE", contentType: "brand_perspective" },
    { value: "insights", label: "Hire'in Insights", contentGoal: "THOUGHT_LEADERSHIP", contentType: "insights" },
  ],
  LINKEDIN: [
    { value: "thought_leadership", label: "Thought Leadership", contentGoal: "THOUGHT_LEADERSHIP", contentType: "linkedin_post" },
    { value: "job_marketing", label: "Job Marketing", contentGoal: "JOB_MARKETING", contentType: "job_marketing" },
    { value: "brand_perspective", label: "Brand Perspective", contentGoal: "BRAND_PERSPECTIVE", contentType: "brand_perspective" },
  ],
  INSTAGRAM: [
    { value: "thought_leadership", label: "Thought Leadership", contentGoal: "THOUGHT_LEADERSHIP", contentType: "instagram" },
    { value: "job_marketing", label: "Job Marketing", contentGoal: "JOB_MARKETING", contentType: "job_marketing" },
    { value: "brand_perspective", label: "Brand Perspective", contentGoal: "BRAND_PERSPECTIVE", contentType: "instagram" },
  ],
  X: [
    { value: "thought_leadership", label: "Thought Leadership", contentGoal: "THOUGHT_LEADERSHIP", contentType: "x_post" },
    { value: "job_marketing", label: "Job Marketing", contentGoal: "JOB_MARKETING", contentType: "x_post" },
    { value: "brand_perspective", label: "Brand Perspective", contentGoal: "BRAND_PERSPECTIVE", contentType: "x_post" },
  ],
};

const HOOK_PATTERNS = [
  { value: "curiosity_gap", label: "Curiosity Gap", description: "\"I need to know why\"" },
  { value: "loss_aversion", label: "Loss Aversion", description: "The costly mistake they're making" },
  { value: "insider_contrast", label: "Insider Contrast", description: "Great vs. average behaviour" },
  { value: "unasked_question", label: "Unasked Question", description: "The critical thing they're not asking" },
  { value: "counter_intuitive_number", label: "Counter-intuitive Number", description: "Pattern-from-experience that surprises" },
  { value: "reader_inner_monologue", label: "Reader's Inner Monologue", description: "Validate before instruct" },
  { value: "stakes_flip", label: "Stakes Flip", description: "Reframe who bears the risk" },
  { value: "specific_scene", label: "Specific Scene", description: "Drop the reader into a moment" },
];

const CONTENT_STRUCTURES = [
  { value: "rule_of_three", label: "Rule of Three", description: "Hook + 3 proof points + CTA. Best for LinkedIn and authority content." },
  { value: "pas", label: "PAS (Problem → Agitate → Solution)", description: "Name the pain, make it visceral, then resolve. Best for awareness content." },
  { value: "the_reveal", label: "The Reveal", description: "Setup → Tension → Payoff. Scene-based storytelling. Best for narrative articles." },
  { value: "contrast", label: "Contrast (Before / After)", description: "Wrong way vs. right way. Best for transformation stories and case studies." },
  { value: "the_framework", label: "The Framework", description: "Name a concept, explain mechanics, show application. Best for thought leadership." },
  { value: "listicle", label: "Listicle", description: "Numbered breakdown for scannability. Best for educational posts and carousels." },
];

const DESIRED_EMOTIONS = ["Validated", "Challenged", "Warned", "Curious", "Surprised", "Inspired"];
const ENGAGEMENT_GOALS = ["Save it", "Share it", "Comment their take", "Follow for more", "DM / reach out", "Apply / enquire"];

const HOOK_PATTERN_LABELS: Record<string, string> = Object.fromEntries(HOOK_PATTERNS.map((h) => [h.value, h.label]));

const AUDIENCE_LABELS: Record<string, string> = {
  EMPLOYER_CLIENT: "Employer Client",
  CANDIDATE_PROFESSIONAL: "Candidate / Professional",
  MSP_STAFFING_PARTNER: "MSP / Staffing Partner",
  RECRUITER_OPERATOR: "Recruiter / Operator",
};

const DOMAIN_LABELS: Record<string, string> = {
  // Canonical uppercase enums (persisted by server after v2.1)
  IT_STAFFING: "IT Staffing",
  HEALTHCARE_STAFFING: "Healthcare Staffing",
  GOVERNMENT: "Government",
  GENERAL_STAFFING: "General Staffing",
  // Legacy lowercase values (pre-v2.1 articles)
  it: "IT Staffing",
  it_staffing: "IT Staffing",
  healthcare: "Healthcare Staffing",
  healthcare_staffing: "Healthcare Staffing",
  government: "Government",
  general: "General Staffing",
};

const GOAL_LABELS: Record<string, string> = {
  THOUGHT_LEADERSHIP: "Thought Leadership",
  EDUCATIONAL: "Educational",
  JOB_MARKETING: "Job Marketing",
  BRAND_PERSPECTIVE: "Brand Perspective",
};

// Client mirror of the server generic transition map.
// States managed by dedicated endpoints (CM decision, author sign-off,
// marketing approve, publish) show no generic transition buttons here —
// their own UI surfaces handle those actions.
const TRANSITIONS: Record<string, { to: string; label: string; permission: string }[]> = {
  draft: [{ to: "in_review", label: "Submit for Review", permission: "studio.edit_article" }],
  in_review: [
    { to: "pending_cm_review", label: "Submit to CM Review", permission: "studio.review_article" },
    { to: "draft", label: "Send back to Draft", permission: "studio.review_article" },
  ],
  // New gated states — advanced through their own dedicated pages/dialogs.
  pending_cm_review: [],
  pending_author: [],
  author_approved: [],
  pending_marketing: [],
  pending_final_approval: [],
  approved: [],
  scheduled: [{ to: "published", label: "Publish now", permission: "studio.publish_article" }],
  published: [],
  ready_to_export: [],
};

interface EditorState {
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  contentType: string;
  category: string;
  tags: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  coverImageUrl: string;
  authorProfileId: string;
  toneVoice: string;
  audience: string;
  generationBrief: string;
  complianceMode: string;
}

function ArticleEditorInner({ id }: { id: string }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { can } = usePermissions();
  const canEdit = can("studio.edit_article");
  const canGenerate = can("studio.generate_ai_draft");

  const [form, setForm] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [ideaBannerOpen, setIdeaBannerOpen] = useState(true);

  // AI generation modal state.
  const [genOpen, setGenOpen] = useState(false);
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const [repurposeChannels, setRepurposeChannels] = useState<string[]>(["linkedin"]);
  const [genMode, setGenMode] = useState<"topic" | "shape">("topic");
  const [genTopic, setGenTopic] = useState("");
  const [genRawInput, setGenRawInput] = useState("");
  const [genKeyPoints, setGenKeyPoints] = useState("");
  const [genSourceNotes, setGenSourceNotes] = useState("");
  const [genIndustry, setGenIndustry] = useState("");
  const [genCompliance, setGenCompliance] = useState("normal");
  const [genContentGoal, setGenContentGoal] = useState("");
  const [genAudience, setGenAudience] = useState("");
  const [genMarketContext, setGenMarketContext] = useState("COMMERCIAL");
  const [genUserFacts, setGenUserFacts] = useState("");
  const [genTone, setGenTone] = useState("");
  const [riskFlags, setRiskFlags] = useState<string[]>([]);
  const [requiredEdits, setRequiredEdits] = useState<string[]>([]);
  // CMO Copilot v2.1 — simplified generation state
  const [genFormat, setGenFormat] = useState("thought_leadership");
  // Psychological Brief state (Task #1060)
  const [genPlatform, setGenPlatform] = useState("ARTICLE");
  const [genDesiredEmotion, setGenDesiredEmotion] = useState("");
  const [genHookPattern, setGenHookPattern] = useState("");
  const [genContentStructure, setGenContentStructure] = useState("");
  const [genEngagementGoal, setGenEngagementGoal] = useState("");
  const [genCreativeDirectionOpen, setGenCreativeDirectionOpen] = useState(false);
  const [genStrategySummary, setGenStrategySummary] = useState<{
    audience: string;
    domain: string;
    contentGoal: string;
    hookArchetype: string;
    safetyResult: string;
    safetyFailureCount: number;
    platform?: string;
    desiredEmotion?: string;
    hookPatternLabel?: string;
    contentStructureLabel?: string;
  } | null>(null);
  const [safetyFailures, setSafetyFailures] = useState<Array<{
    code: string;
    sentence: string;
    reason: string;
    missingSource?: string;
    recommendedCorrection: string;
    autoCorrectSafe: boolean;
  }>>([]);
  // Brief resolution state (backend only — not surfaced in UI yet)
  const [genStep, setGenStep] = useState<"input" | "brief" | "hooks">("input");
  // Thin-brief override — user explicitly acknowledged the "thin" warning and wants to proceed
  const [genThinBriefOverride, setGenThinBriefOverride] = useState(false);
  const [resolvedBrief, setResolvedBrief] = useState<any>(null);
  const [selectedHookIdx, setSelectedHookIdx] = useState<number>(0);
  // Task #906 defect fix: AI failures surface as a persistent banner with
  // retry + continue-manually, never just a transient toast.
  const [aiError, setAiError] = useState<{ source: "article" | "social"; message: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<EditorState | null>(null);
  const dirtyRef = useRef(false);
  const lastUploadPath = useRef("");

  const { data: article, isLoading } = useQuery<StudioArticle>({
    queryKey: ["/api/admin/studio/articles", id],
    enabled: !!id,
  });

  const linkedIdeaId = (article as any)?.linkedIdeaId as string | undefined;
  const { data: originIdea } = useQuery<StudioContentIdea>({
    queryKey: ["/api/studio/content-ideas", linkedIdeaId],
    enabled: !!linkedIdeaId,
  });

  // If the article already has body content, lock the Generate Draft button so
  // AI cannot silently overwrite an in-progress draft.
  const hasDraft = !!(article?.bodyMarkdown?.trim());

  const { data: authors } = useQuery<StudioAuthorProfile[]>({
    queryKey: [
      "/api/admin/studio/authors",
      { projectId: article?.projectId ?? "" },
    ],
    enabled: !!article?.projectId,
  });

  const { data: editorBrandVoice } = useQuery<{ config: Record<string, unknown> | null }>({
    queryKey: ["/api/studio/projects", article?.projectId, "brand-voice"],
    enabled: !!article?.projectId,
  });

  const { data: versions } = useQuery<StudioArticleVersion[]>({
    queryKey: ["/api/admin/studio/articles", id, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${id}/versions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load versions");
      return res.json();
    },
    enabled: !!id,
  });

  // Pre-generation estimate + brief quality — fires when dialog is open & topic is filled
  const [estimateTopic, setEstimateTopic] = useState("");
  useEffect(() => {
    if (!genOpen) { setEstimateTopic(""); return; }
    const t = setTimeout(() => setEstimateTopic(genTopic.trim()), 600);
    return () => clearTimeout(t);
  }, [genOpen, genTopic]);

  const { data: estimateData } = useQuery<{
    estimatedCostMin: number;
    estimatedCostMax: number;
    inputTokenEstimate: number;
    contentType: string;
    briefQuality: { score: number; tier: string; missingFields: string[] };
    pricingSnapshot: Record<string, unknown>;
  }>({
    queryKey: ["/api/admin/studio/articles", id, "generation-estimate", estimateTopic, genAudience, genUserFacts, genHookPattern, genDesiredEmotion],
    queryFn: async () => {
      const res = await fetch(`/api/admin/studio/articles/${id}/generation-estimate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: estimateTopic,
          audience: genAudience || undefined,
          userSuppliedFacts: genUserFacts || undefined,
          hookPattern: genHookPattern || undefined,
          desiredEmotion: genDesiredEmotion || undefined,
          contentType: article?.contentType,
        }),
      });
      if (!res.ok) throw new Error("estimate failed");
      return res.json();
    },
    enabled: !!id && estimateTopic.length > 4,
    staleTime: 30_000,
  });

  // Article total AI cost — available to all studio roles (detailed breakdown restricted to super_admin)
  const { data: articleCostData } = useQuery<{ totalCostUsd: number; generationCount: number }>({
    queryKey: ["/api/admin/studio/articles", id, "cost"],
    enabled: !!id,
    staleTime: 60_000,
  });

  // Hydrate the form once the article loads.
  useEffect(() => {
    if (article && !form) {
      const next: EditorState = {
        title: article.title ?? "",
        excerpt: article.excerpt ?? "",
        bodyMarkdown: article.bodyMarkdown ?? "",
        contentType: article.contentType ?? "quick_take",
        category: article.category ?? "",
        tags: (article.tags ?? []).join(", "),
        slug: article.slug ?? "",
        seoTitle: article.seoTitle ?? "",
        seoDescription: article.seoDescription ?? "",
        coverImageUrl: article.coverImageUrl ?? "",
        authorProfileId: article.authorProfileId ?? "",
        toneVoice: (article as any).toneVoice ?? "",
        audience: (article as any).audience?.[0] ?? "",
        generationBrief: (article as any).generationBrief ?? "",
        complianceMode: (article as any).complianceMode ?? "normal",
      };
      setForm(next);
      formRef.current = next;
    }
  }, [article, form]);

  // On article load (or refresh after generation): restore the strategy strip and
  // safety findings from the persisted article record so they survive page reload.
  useEffect(() => {
    if (!article) return;
    const art = article as any;
    if (!art.safetyReviewResult && !art.audienceResolved && !art.domainResolved) return;
    setGenStrategySummary({
      audience: art.audienceResolved ? (AUDIENCE_LABELS[art.audienceResolved] ?? art.audienceResolved) : "Auto-detected",
      domain: DOMAIN_LABELS[art.domainResolved] ?? art.domainResolved ?? "General Staffing",
      contentGoal: GOAL_LABELS[art.contentGoal] ?? art.contentGoal ?? "",
      hookArchetype: art.selectedHookArchetype ?? "",
      safetyResult: art.safetyReviewResult ?? "PASS",
      safetyFailureCount: (art.safetyFailuresJsonb as any[] | null)?.length ?? 0,
      desiredEmotion: art.desiredEmotion ?? undefined,
      hookPatternLabel: art.hookPattern ? (HOOK_PATTERN_LABELS[art.hookPattern] ?? art.hookPattern) : undefined,
      contentStructureLabel: art.contentStructure ? (CONTENT_STRUCTURES.find((s) => s.value === art.contentStructure)?.label ?? art.contentStructure) : undefined,
    });
    if (Array.isArray(art.safetyFailuresJsonb) && art.safetyFailuresJsonb.length > 0) {
      setSafetyFailures(art.safetyFailuresJsonb as any[]);
    }
  // Only re-run when the article id changes or after the article is refetched.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, (article as any)?.safetyReviewResult]);

  // Pre-fill AI generation dialog from article state when opened.
  useEffect(() => {
    if (genOpen && article) {
      const art = article as any;
      if (art.audience?.[0]) setGenAudience(art.audience[0]);
      if (art.toneVoice) setGenTone(art.toneVoice);
      if (art.complianceMode) setGenCompliance(art.complianceMode);
      // Derive content goal from contentType if not yet set (RC-1 client mirror)
      if (!genContentGoal && art.contentType) {
        const lower = art.contentType.toLowerCase().replace(/[-\s]/g, "_");
        if (["quick_take", "deep_dive", "thought_leadership", "opinion"].some((s) => lower === s || lower.includes(s))) {
          setGenContentGoal("THOUGHT_LEADERSHIP");
        } else if (["how_to", "insights", "guide", "educational"].some((s) => lower === s || lower.includes(s))) {
          setGenContentGoal("EDUCATIONAL");
        }
      }
      // Task #1060 — auto-fill topic from article title when topic is blank.
      if (!genTopic && art.title?.trim()) {
        setGenTopic(art.title.trim());
      }
      // Restore persisted brief fields if the article has them.
      if (art.desiredEmotion && !genDesiredEmotion) setGenDesiredEmotion(art.desiredEmotion);
      if (art.hookPattern && !genHookPattern) setGenHookPattern(art.hookPattern);
      if (art.contentStructure && !genContentStructure) setGenContentStructure(art.contentStructure);
      if (art.engagementGoal && !genEngagementGoal) setGenEngagementGoal(art.engagementGoal);
      // Seed domain from article's resolved domain (set at creation or after last generation).
      if (art.domainResolved && !genIndustry) setGenIndustry(art.domainResolved);

      // Restore platform from article contentType so the chip group reflects the
      // article's actual platform rather than always showing the ARTICLE default.
      const inferredPlatform = ((): string => {
        const ct = (art.contentType ?? "").toLowerCase();
        if (ct === "linkedin_post") return "LINKEDIN";
        if (ct === "instagram") return "INSTAGRAM";
        if (ct === "x_post") return "X";
        return "ARTICLE";
      })();
      setGenPlatform(inferredPlatform);

      // Restore content intent by matching the article's contentGoal against
      // the intents available for the inferred platform.
      if (art.contentGoal) {
        const platformIntents = PLATFORM_CONTENT_INTENTS[inferredPlatform] ?? PLATFORM_CONTENT_INTENTS.ARTICLE;
        const matchedIntent = platformIntents.find((i) => i.contentGoal === art.contentGoal);
        if (matchedIntent) setGenFormat(matchedIntent.value);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genOpen]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const update = (patch: Partial<EditorState>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    setDirty(true);
  };

  const buildPayload = (state: EditorState, autosave: boolean) => ({
    title: state.title.trim() || "Untitled",
    excerpt: state.excerpt || null,
    bodyMarkdown: state.bodyMarkdown,
    contentType: state.contentType,
    category: state.category.trim() || null,
    tags: state.tags
      ? state.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    slug: state.slug || null,
    seoTitle: state.seoTitle || null,
    seoDescription: state.seoDescription || null,
    coverImageUrl: state.coverImageUrl || null,
    authorProfileId: state.authorProfileId || null,
    toneVoice: state.toneVoice || null,
    audience: state.audience ? [state.audience] : undefined,
    generationBrief: state.generationBrief || null,
    complianceMode: state.complianceMode || null,
    autosave,
  });

  const saveMutation = useMutation({
    mutationFn: async (autosave: boolean) => {
      const state = formRef.current!;
      const res = await apiRequest(
        "PATCH",
        `/api/admin/studio/articles/${id}`,
        buildPayload(state, autosave),
      );
      return res.json();
    },
    onSuccess: () => {
      setDirty(false);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const saveVersionMutation = useMutation({
    mutationFn: async () => {
      // Persist current edits first, then snapshot.
      if (dirtyRef.current) {
        await apiRequest(
          "PATCH",
          `/api/admin/studio/articles/${id}`,
          buildPayload(formRef.current!, false),
        );
        setDirty(false);
        setLastSaved(new Date());
      }
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/versions`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      toast({ title: "Version saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save version", description: err.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/versions/${versionId}/restore`,
        {},
      );
      return res.json();
    },
    onSuccess: (restored: StudioArticle) => {
      const next: EditorState = {
        title: restored.title ?? "",
        excerpt: restored.excerpt ?? "",
        bodyMarkdown: restored.bodyMarkdown ?? "",
        contentType: restored.contentType ?? "quick_take",
        category: restored.category ?? "",
        tags: (restored.tags ?? []).join(", "),
        slug: restored.slug ?? "",
        seoTitle: restored.seoTitle ?? "",
        seoDescription: restored.seoDescription ?? "",
        coverImageUrl: restored.coverImageUrl ?? "",
        authorProfileId: restored.authorProfileId ?? "",
        toneVoice: (restored as any).toneVoice ?? "",
        audience: (restored.audience ?? [])[0] ?? "",
        generationBrief: (restored as any).generationBrief ?? "",
        complianceMode: (restored as any).complianceMode ?? "normal",
      };
      setForm(next);
      formRef.current = next;
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id, "versions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      toast({ title: "Version restored" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not restore", description: err.message, variant: "destructive" });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: async (to: string) => {
      if (dirtyRef.current) {
        await apiRequest(
          "PATCH",
          `/api/admin/studio/articles/${id}`,
          buildPayload(formRef.current!, false),
        );
        setDirty(false);
      }
      // in_review → approve must use the review-decision endpoint, not the generic
      // /transition endpoint (which only allows in_review → draft on the backend).
      if (article?.status === "in_review" && to === "approved") {
        const res = await apiRequest(
          "POST",
          `/api/admin/studio/articles/${id}/review-decision`,
          { decision: "approve" },
        );
        return res.json();
      }
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/transition`, { to });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/stats"] });
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const repurposeMutation = useMutation({
    mutationFn: async (channels: string[]) => {
      const res = await apiRequest("POST", `/api/admin/studio/articles/${id}/repurpose`, { channels });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/studio/content-ideas"] });
      setRepurposeOpen(false);
      toast({
        title: `AI proposed ${data.created} idea(s) from this article`,
        description: "Find them in the pipeline as dashed 'suggested' cards — accept or discard each one.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Repurpose failed", description: err.message, variant: "destructive" });
    },
  });

  const generateArticleMutation = useMutation({
    mutationFn: async () => {
      // Derive content type and goal from the selected intent for the chosen platform.
      const intents = PLATFORM_CONTENT_INTENTS[genPlatform] ?? PLATFORM_CONTENT_INTENTS.ARTICLE;
      const intent = intents.find((i) => i.value === genFormat) ?? intents[0];
      const payload: Record<string, any> = {
        mode: "topic",
        contentType: intent.contentType,
        contentGoal: intent.contentGoal,
        platform: genPlatform,
        audience: genAudience || undefined,
        userSuppliedFacts: genUserFacts || undefined,
        topic: genTopic,
        complianceMode: "normal",
        industry: genIndustry || undefined,
        // Psychological brief fields
        desiredEmotion: genDesiredEmotion || undefined,
        hookPattern: genHookPattern || undefined,
        contentStructure: genContentStructure || undefined,
        engagementGoal: genEngagementGoal || undefined,
      };
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/generate-article`,
        payload,
      );
      return res.json();
    },
    onSuccess: async (data: any) => {
      const draft = data.draft;
      setForm((f) =>
        f
          ? {
              ...f,
              title: draft.title || f.title,
              excerpt: draft.excerpt || f.excerpt,
              bodyMarkdown: draft.body_markdown || f.bodyMarkdown,
              slug: draft.slug || f.slug,
              seoTitle: draft.meta_title || f.seoTitle,
              seoDescription: draft.meta_description || f.seoDescription,
            }
          : f,
      );
      setDirty(true);
      setRiskFlags(data.riskFlags ?? data.qualityReview?.risk_flags ?? []);
      setRequiredEdits(data.qualityReview?.required_edits ?? []);
      setGenOpen(false);
      setAiError(null);

      // Build the strategy summary — use backend-resolved creative direction as the
      // source of truth so values are always shown even when user left them blank.
      const intents = PLATFORM_CONTENT_INTENTS[genPlatform] ?? PLATFORM_CONTENT_INTENTS.ARTICLE;
      const intent = intents.find((i) => i.value === genFormat) ?? intents[0];
      const resolvedAud = data.resolvedAudience;
      const resolvedDom = data.resolvedDomain;
      const resolvedGoal = data.resolvedContentGoal;
      const rcd = data.resolvedCreativeDirection ?? {};
      setGenStrategySummary({
        audience: resolvedAud ? (AUDIENCE_LABELS[resolvedAud] ?? resolvedAud) : "Auto-detected",
        domain: resolvedDom ? (DOMAIN_LABELS[resolvedDom] ?? resolvedDom) : "General Staffing",
        contentGoal: resolvedGoal ? (GOAL_LABELS[resolvedGoal] ?? resolvedGoal) : (GOAL_LABELS[intent.contentGoal] ?? intent.label),
        hookArchetype: draft.hook_archetype_used || "",
        safetyResult: data.safetyReviewResult ?? "PASS",
        safetyFailureCount: (data.safetyFailures ?? []).length,
        platform: genPlatform !== "ARTICLE" ? genPlatform : undefined,
        desiredEmotion: rcd.desiredEmotion || undefined,
        hookPatternLabel: rcd.hookPattern ? (HOOK_PATTERN_LABELS[rcd.hookPattern] ?? rcd.hookPattern) : undefined,
        contentStructureLabel: rcd.contentStructure ? (CONTENT_STRUCTURES.find((s: any) => s.value === rcd.contentStructure)?.label ?? rcd.contentStructure) : undefined,
      });
      setSafetyFailures(data.safetyFailures ?? []);

      // Persist audience, contentGoal, and resolved creative brief back to the article.
      // Use backend-resolved values so even auto-selected fields are saved with source tracking.
      apiRequest("PATCH", `/api/admin/studio/articles/${id}`, {
        ...(genAudience ? { audience: [genAudience] } : {}),
        contentGoal: intent.contentGoal,
        ...(rcd.desiredEmotion ? { desiredEmotion: rcd.desiredEmotion } : {}),
        ...(rcd.hookPattern ? { hookPattern: rcd.hookPattern } : {}),
        ...(rcd.contentStructure ? { contentStructure: rcd.contentStructure } : {}),
        ...(rcd.engagementGoal ? { engagementGoal: rcd.engagementGoal } : {}),
      }).catch(() => {/* non-fatal */});

      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      const flagCount = (data.riskFlags ?? []).length;
      const safetyBadge = data.safetyReviewResult === "BLOCK" ? " · ⚠ Important issue found" :
        data.safetyReviewResult === "REVISE" ? " · Review recommended" : "";
      toast({
        title: "Draft generated",
        description: flagCount > 0
          ? `${flagCount} flag(s) raised — review before publishing.`
          : `Review and save your draft.${safetyBadge}`,
      });
    },
    onError: (err: Error) => {
      setGenOpen(false);
      setAiError({ source: "article", message: err.message });
    },
  });

  const [socialKitSlowWarning, setSocialKitSlowWarning] = useState(false);

  const generateSocialKitMutation = useMutation({
    mutationFn: async () => {
      // Persist current edits so the kit derives from saved content.
      if (dirtyRef.current) {
        await apiRequest(
          "PATCH",
          `/api/admin/studio/articles/${id}`,
          buildPayload(formRef.current!, false),
        );
        setDirty(false);
        setLastSaved(new Date());
      }
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/generate-social-kit`,
        {
          complianceMode: genCompliance,
          industry: genIndustry || undefined,
          contentGoal: genContentGoal || undefined,
          audience: genAudience || undefined,
          marketContext: genMarketContext || undefined,
          userSuppliedFacts: genUserFacts || undefined,
        },
      );
      return res.json();
    },
    onSuccess: (data: any) => {
      setAiError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      const warnCount = (data.warnings ?? []).length;
      toast({
        title: "Social Kit generated",
        description: warnCount > 0 ? `${warnCount} length warning(s) — see the Social Kit tab.` : "See the Social Kit tab.",
      });
    },
    onError: (err: Error) => {
      setAiError({ source: "social", message: err.message });
    },
  });

  // 15-second slow-generation warning for Social Kit (declared after the mutation to avoid TDZ).
  useEffect(() => {
    if (!generateSocialKitMutation.isPending) {
      setSocialKitSlowWarning(false);
      return;
    }
    const t = setTimeout(() => setSocialKitSlowWarning(true), 15000);
    return () => clearTimeout(t);
  }, [generateSocialKitMutation.isPending]);

  const resolveRiskFlagsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/admin/studio/articles/${id}/resolve-risk-flags`,
        {},
      );
      return res.json();
    },
    onSuccess: () => {
      setRiskFlags([]);
      setRequiredEdits([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", id] });
      toast({ title: "Risk flags resolved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not resolve flags", description: err.message, variant: "destructive" });
    },
  });

  const copyText = useCallback(
    (text: string, label: string) => {
      navigator.clipboard?.writeText(text).then(
        () => toast({ title: `${label} copied` }),
        () => toast({ title: "Copy failed", variant: "destructive" }),
      );
    },
    [toast],
  );

  // Auto-save every 60s when dirty.
  useEffect(() => {
    if (!canEdit) return;
    const interval = setInterval(() => {
      if (dirtyRef.current && formRef.current) {
        saveMutation.mutate(true);
      }
    }, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  // Markdown toolbar: wrap or insert syntax around the current selection.
  const applyMarkdown = useCallback(
    (kind: string) => {
      const ta = textareaRef.current;
      if (!ta || !formRef.current) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = formRef.current.bodyMarkdown;
      const selected = value.slice(start, end);
      let inserted = selected;
      let cursorOffset = 0;
      switch (kind) {
        case "bold":
          inserted = `**${selected || "bold text"}**`;
          break;
        case "italic":
          inserted = `*${selected || "italic text"}*`;
          break;
        case "h2":
          inserted = `## ${selected || "Heading"}`;
          break;
        case "ul":
          inserted = (selected || "List item")
            .split("\n")
            .map((l) => `- ${l}`)
            .join("\n");
          break;
        case "ol":
          inserted = (selected || "List item")
            .split("\n")
            .map((l, i) => `${i + 1}. ${l}`)
            .join("\n");
          break;
        case "quote":
          inserted = `> ${selected || "Quote"}`;
          break;
        case "link":
          inserted = `[${selected || "link text"}](https://)`;
          cursorOffset = inserted.length - 1;
          break;
        case "code":
          inserted = selected.includes("\n")
            ? `\`\`\`\n${selected || "code"}\n\`\`\``
            : `\`${selected || "code"}\``;
          break;
      }
      const newValue = value.slice(0, start) + inserted + value.slice(end);
      update({ bodyMarkdown: newValue });
      requestAnimationFrame(() => {
        ta.focus();
        const pos = start + inserted.length - cursorOffset;
        ta.setSelectionRange(pos, pos);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (isLoading || !form || !article) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const contentType = getStudioContentType(form.contentType);
  const readTime = computeReadTime(form.bodyMarkdown, form.contentType);
  const availableTransitions = (TRANSITIONS[article.status] || []).filter((t) =>
    can(t.permission),
  );

  const toolbarButtons = [
    { kind: "bold", icon: Bold, label: "Bold" },
    { kind: "italic", icon: Italic, label: "Italic" },
    { kind: "h2", icon: Heading2, label: "Heading" },
    { kind: "ul", icon: List, label: "Bullet list" },
    { kind: "ol", icon: ListOrdered, label: "Numbered list" },
    { kind: "quote", icon: Quote, label: "Quote" },
    { kind: "link", icon: Link2, label: "Link" },
    { kind: "code", icon: Code, label: "Code" },
  ];

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            onClick={() => setLocation("/admin/studio/articles")}
            className="inline-flex items-center gap-1 hover:text-foreground"
            data-testid="button-back-articles"
          >
            <ArrowLeft className="h-4 w-4" />
            Articles
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate font-medium text-foreground">{form.title || "Untitled"}</span>
          <Badge
            variant="secondary"
            className={STATUS_BADGE_CLASS[article.status] ?? ""}
            data-testid="badge-article-status"
          >
            {STATUS_LABELS[article.status] ?? article.status}
          </Badge>
          {articleCostData && articleCostData.totalCostUsd > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
              title={`${articleCostData.generationCount} AI generation(s)`}
              data-testid="chip-article-cost"
            >
              <DollarSign className="h-3 w-3" />
              {articleCostData.totalCostUsd.toFixed(4)}
            </span>
          )}
          <ArticleRegenPanel
            articleId={article.id}
            articleTitle={article.title ?? ""}
            currentMarkdown={article.bodyMarkdown ?? ""}
            domainResolved={(article as any).domainResolved ?? ""}
            initialBrief={{
              hookPattern: (article as any).hookPattern ?? "",
              desiredEmotion: (article as any).desiredEmotion ?? "",
              contentStructure: (article as any).contentStructure ?? "",
              engagementGoal: (article as any).engagementGoal ?? "",
            }}
            onCommit={(newMarkdown, newTitle) => {
              setForm((f) =>
                f ? { ...f, bodyMarkdown: newMarkdown, ...(newTitle ? { title: newTitle } : {}) } : f
              );
              setDirty(true);
            }}
            badgeOnly
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="text-save-state">
            {saveMutation.isPending
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : lastSaved
                  ? `Saved ${lastSaved.toLocaleTimeString()}`
                  : "All changes saved"}
          </span>
          {canGenerate && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGenOpen(true)}
                        disabled={generateArticleMutation.isPending || hasDraft}
                        data-testid="button-open-generate"
                      >
                        {generateArticleMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : hasDraft ? (
                          <Lock className="mr-2 h-4 w-4" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Generate Draft
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {hasDraft && (
                    <TooltipContent side="bottom" className="max-w-[240px] text-center">
                      This article already has a draft. To use AI generation, start a new article instead.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <div className="flex flex-col items-start gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateSocialKitMutation.mutate()}
                  disabled={generateSocialKitMutation.isPending || !form.bodyMarkdown.trim()}
                  data-testid="button-generate-social-kit"
                >
                  {generateSocialKitMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="mr-2 h-4 w-4" />
                  )}
                  Social Kit
                </Button>
                {socialKitSlowWarning && (
                  <span className="text-xs text-amber-600 dark:text-amber-400" data-testid="text-social-kit-slow-warning">
                    Still generating — AI can take up to a minute for long articles…
                  </span>
                )}
              </div>
            </>
          )}
          {canGenerate && (article.status === "published" || article.status === "approved") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRepurposeOpen(true)}
              disabled={repurposeMutation.isPending}
              data-testid="button-repurpose-article"
            >
              {repurposeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Recycle className="mr-2 h-4 w-4" />
              )}
              Repurpose
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate(false)}
              disabled={saveMutation.isPending || !dirty}
              data-testid="button-save-article"
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          )}
          {availableTransitions.map((t) => (
            <Button
              key={t.to}
              size="sm"
              variant={t.to === "draft" ? "outline" : "default"}
              onClick={() => transitionMutation.mutate(t.to)}
              disabled={transitionMutation.isPending}
              data-testid={`button-transition-${t.to}`}
            >
              {t.label}
            </Button>
          ))}
          {!["published", "archived"].includes(article.status) && (
            <ForcePublishButton
              articleId={id}
              articleTitle={article.title}
              riskFlags={(article as any).riskFlags}
              onDone={() => setLocation("/admin/studio/articles")}
              compact
            />
          )}
        </div>
      </div>

      {aiError && (
        <AIErrorBanner
          message={aiError.message}
          retrying={
            aiError.source === "article"
              ? generateArticleMutation.isPending
              : generateSocialKitMutation.isPending
          }
          onRetry={() => {
            if (aiError.source === "article") setGenOpen(true);
            else generateSocialKitMutation.mutate();
          }}
          onDismiss={() => setAiError(null)}
        />
      )}

      {originIdea && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/30" data-testid="banner-originated-from-idea">
          <button
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30 transition-colors"
            onClick={() => setIdeaBannerOpen((v) => !v)}
            data-testid="button-toggle-idea-banner"
          >
            <BookOpen className="h-4 w-4 shrink-0" />
            <span className="flex-1">Originated from idea: {originIdea.topic}</span>
            {ideaBannerOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          {ideaBannerOpen && (
            <div className="border-t border-indigo-200 dark:border-indigo-800 px-4 py-3 text-xs space-y-2">
              {originIdea.pillar && (
                <div>
                  <span className="font-medium text-indigo-700 dark:text-indigo-400">Pillar: </span>
                  <span className="text-muted-foreground capitalize">{originIdea.pillar}</span>
                </div>
              )}
              {originIdea.brief && (
                <div>
                  <span className="font-medium text-indigo-700 dark:text-indigo-400">Brief: </span>
                  <span className="text-muted-foreground">{originIdea.brief}</span>
                </div>
              )}
              {(originIdea.channels as string[] | null)?.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-indigo-700 dark:text-indigo-400">Channels:</span>
                  {(originIdea.channels as string[]).map((c) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              ) : null}
              {originIdea.scheduledDate && (
                <div>
                  <span className="font-medium text-indigo-700 dark:text-indigo-400">Planned for: </span>
                  <span className="text-muted-foreground">{new Date(`${originIdea.scheduledDate}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 px-2"
                onClick={() => setLocation(studioPath(`?idea=${originIdea.id}`))}
                data-testid="button-view-origin-idea"
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                View in Pipeline
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main editor */}
        <div className="space-y-4">
          <Input
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Article title"
            className="h-auto border-0 px-0 text-2xl font-bold shadow-none focus-visible:ring-0"
            disabled={!canEdit}
            data-testid="input-article-title"
          />

          {riskFlags.length > 0 && (
            <Alert variant="destructive" data-testid="alert-risk-flags">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {riskFlags.length} AI risk flag{riskFlags.length > 1 ? "s" : ""} raised
              </AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc space-y-1 text-sm">
                  {riskFlags.map((f, i) => (
                    <li key={i} data-testid={`text-risk-flag-${i}`}>{f}</li>
                  ))}
                </ul>
                {requiredEdits.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide">Suggested edits</p>
                    <ul className="ml-4 list-disc space-y-1 text-sm">
                      {requiredEdits.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {can("studio.review_article") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => resolveRiskFlagsMutation.mutate()}
                    disabled={resolveRiskFlagsMutation.isPending}
                    data-testid="button-resolve-risk-flags"
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Resolve flags (clears publish block)
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="write">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="write" data-testid="tab-write">
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview" data-testid="tab-preview">
                  Preview
                </TabsTrigger>
                <TabsTrigger value="social" data-testid="tab-social">
                  Social Kit
                </TabsTrigger>
              </TabsList>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                {readTime} min read
              </span>
            </div>

            <TabsContent value="write" className="mt-3 space-y-2">
              {/* CMO Copilot v2.1 — Strategy summary strip (persisted; survives page refresh) */}
              {genStrategySummary && (
                <div className="space-y-1.5" data-testid="div-strategy-summary">
                  {/* One-line summary row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="flex flex-wrap items-center gap-1">
                      <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                      <span className="font-medium text-foreground">Generated for:</span>
                      {genStrategySummary.audience}
                      {genStrategySummary.domain && <>{" · "}{genStrategySummary.domain}</>}
                      {genStrategySummary.contentGoal && <>{" · "}{genStrategySummary.contentGoal}</>}
                      {genStrategySummary.platform && <>{" · "}<span className="font-medium text-foreground">{genStrategySummary.platform}</span></>}
                      {genStrategySummary.desiredEmotion && <>{" · "}Emotion: <span className="font-medium text-foreground">{genStrategySummary.desiredEmotion}</span></>}
                      {genStrategySummary.hookPatternLabel && (
                        <> · Hook: <span className="font-medium text-foreground">{genStrategySummary.hookPatternLabel}</span></>
                      )}
                      {!genStrategySummary.hookPatternLabel && genStrategySummary.hookArchetype && (
                        <> · Hook: <span className="font-medium text-foreground">{genStrategySummary.hookArchetype}</span></>
                      )}
                      {genStrategySummary.contentStructureLabel && (
                        <> · Structure: <span className="font-medium text-foreground">{genStrategySummary.contentStructureLabel}</span></>
                      )}
                    </span>
                    {/* Safety badge */}
                    {genStrategySummary.safetyResult === "BLOCK" ? (
                      <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400" data-testid="badge-safety-block">
                        <XCircle className="h-3.5 w-3.5" /> Important issue found
                      </span>
                    ) : genStrategySummary.safetyResult === "REVISE" ? (
                      <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400" data-testid="badge-safety-revise">
                        <AlertTriangle className="h-3.5 w-3.5" /> Review recommended
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-500" data-testid="badge-safety-clear">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Clear
                      </span>
                    )}
                  </div>
                  {/* Actionable safety findings — shown when there are failures */}
                  {safetyFailures.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20" data-testid="div-safety-findings">
                      <div className="border-b border-amber-200 px-3 py-1.5 dark:border-amber-800/40">
                        <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                          {safetyFailures.length === 1 ? "1 item to review" : `${safetyFailures.length} items to review`}
                        </span>
                      </div>
                      <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
                        {safetyFailures.map((f, i) => (
                          <div key={i} className="px-3 py-2.5 text-xs" data-testid={`div-safety-finding-${i}`}>
                            {/* Flagged phrase */}
                            <p className="mb-1 font-mono text-[11px] leading-relaxed text-amber-900 dark:text-amber-200 line-clamp-2">
                              "{f.sentence}"
                            </p>
                            {/* Why it was flagged */}
                            <p className="text-muted-foreground">
                              <span className="font-medium text-foreground">Why: </span>{f.reason}
                            </p>
                            {/* What to do + help icon */}
                            <div className="mt-0.5 flex items-start gap-1">
                              <p className="flex-1 text-muted-foreground">
                                <span className="font-medium text-foreground">Fix: </span>{f.recommendedCorrection}
                              </p>
                              <FieldHelp id={`safety-${f.code}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                {toolbarButtons.map((b) => (
                  <Button
                    key={b.kind}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title={b.label}
                    disabled={!canEdit}
                    onClick={() => applyMarkdown(b.kind)}
                    data-testid={`button-md-${b.kind}`}
                  >
                    <b.icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={form.bodyMarkdown}
                onChange={(e) => update({ bodyMarkdown: e.target.value })}
                placeholder="Write your article in Markdown…"
                className="min-h-[460px] font-mono text-sm leading-relaxed"
                disabled={!canEdit}
                data-testid="input-article-body"
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-3">
              <Card>
                <CardContent className="p-6">
                  <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="markdown-preview">
                    {form.bodyMarkdown ? (
                      <ReactMarkdown>{form.bodyMarkdown}</ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">Nothing to preview yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social" className="mt-3 space-y-4">
              <BrandedSocialCards article={article} />
              {(() => {
                const kit = (article.socialKitJsonb as CanonicalSocialKit | null) ?? null;
                if (!kit) {
                  return (
                    <Card>
                      <CardContent className="p-6 text-sm text-muted-foreground" data-testid="text-no-social-kit">
                        No Social Kit yet. Click <span className="font-medium">Social Kit</span> above to generate
                        captions, story frames, and cards from this article.
                      </CardContent>
                    </Card>
                  );
                }
                const platformLabels: Record<string, string> = {
                  linkedin: "LinkedIn",
                  instagram: "Instagram",
                  facebook: "Facebook",
                  twitter: "X (Twitter)",
                };
                return (
                  <div className="space-y-4">
                    {(kit.captions ?? []).map((cap) => (
                      <Card key={cap.platform} data-testid={`card-caption-${cap.platform}`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm">
                            {platformLabels[cap.platform] ?? cap.platform}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {cap.text.length} chars
                            </span>
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyText(cap.text, platformLabels[cap.platform] ?? cap.platform)}
                            data-testid={`button-copy-${cap.platform}`}
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="whitespace-pre-wrap text-sm" data-testid={`text-caption-${cap.platform}`}>
                            {cap.text}
                          </p>
                          {(cap.variants ?? []).length > 0 && (
                            <div className="space-y-1.5 border-t pt-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Variants
                              </p>
                              {cap.variants!.map((v, i) => (
                                <div
                                  key={i}
                                  className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs"
                                  data-testid={`variant-${cap.platform}-${i}`}
                                >
                                  <span className="whitespace-pre-wrap">{v}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => copyText(v, "Variant")}
                                    data-testid={`button-copy-variant-${cap.platform}-${i}`}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          {(kit.hashtags?.[cap.platform] ?? []).length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {kit.hashtags![cap.platform].map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}

                    {(kit.thread ?? []).length > 0 && (
                      <Card data-testid="card-thread">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm">Thread</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyText(kit.thread!.join("\n\n"), "Thread")}
                            data-testid="button-copy-thread"
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                          {kit.thread!.map((t, i) => (
                            <p key={i} className="text-sm" data-testid={`text-thread-${i}`}>
                              {i + 1}. {t}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {(kit.story_frames ?? []).length > 0 && (
                      <Card data-testid="card-story-frames">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Story frames</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                          {kit.story_frames!.map((s, i) => (
                            <Badge key={i} variant="secondary" data-testid={`badge-story-${i}`}>
                              {s}
                            </Badge>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {kit.quote_card_text && (
                      <Card data-testid="card-quote">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm">Quote card</CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => copyText(kit.quote_card_text, "Quote")}
                            data-testid="button-copy-quote"
                          >
                            <Copy className="mr-1 h-3 w-3" />
                            Copy
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm italic">{kit.quote_card_text}</p>
                        </CardContent>
                      </Card>
                    )}

                    {(kit.checklist_card_items ?? []).length > 0 && (
                      <Card data-testid="card-checklist">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Checklist card</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="ml-4 list-disc space-y-1 text-sm">
                            {kit.checklist_card_items!.map((c, i) => (
                              <li key={i} data-testid={`text-checklist-${i}`}>{c}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    )}

                    {(kit.suggested_visual_template || kit.suggested_category_badge) && (
                      <p className="text-xs text-muted-foreground" data-testid="text-social-suggestions">
                        Suggested visual: {kit.suggested_visual_template || "n/a"}
                        {kit.suggested_category_badge ? ` · Badge: ${kit.suggested_category_badge}` : ""}
                      </p>
                    )}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </div>

        {/* Metadata sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Content type</Label>
                <Select
                  value={form.contentType}
                  onValueChange={(v) => update({ contentType: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-content-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDIO_CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} · {t.blurb}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contentType && (
                  <p className="text-xs text-muted-foreground">
                    Target {contentType.blurb}. Read time clamps to this range.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => update({ category: e.target.value })}
                  placeholder="e.g. Healthcare, IT, Engineering"
                  disabled={!canEdit}
                  data-testid="input-category"
                />
                <p className="text-xs text-muted-foreground">
                  Routes the review to the matching reviewer pool when submitted.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Author</Label>
                <Select
                  value={form.authorProfileId || "none"}
                  onValueChange={(v) => update({ authorProfileId: v === "none" ? "" : v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger data-testid="select-author">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {(() => {
                      const active = authors?.filter((a) => a.isActive) ?? [];
                      const articleCat = (form.category ?? "").toLowerCase();
                      const employees = active.filter((a) => (a as any).authorType === "employee");
                      const external = active.filter((a) => (a as any).authorType !== "employee");
                      const catMatched = employees.filter((a) =>
                        articleCat &&
                        (a.title?.toLowerCase().includes(articleCat) ||
                         a.bio?.toLowerCase().includes(articleCat)),
                      );
                      const otherEmployees = employees.filter(
                        (a) => !catMatched.find((m) => m.id === a.id),
                      );
                      const teamGroup = [...catMatched, ...otherEmployees];
                      const AuthorOption = ({ a, suffix }: { a: StudioAuthorProfile; suffix?: string }) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 shrink-0">
                              {a.photoUrl && <AvatarImage src={a.photoUrl} alt={a.displayName} />}
                              <AvatarFallback className="text-[10px]">
                                {a.displayName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{a.displayName}{suffix ?? ""}</span>
                          </span>
                        </SelectItem>
                      );
                      return (
                        <>
                          {teamGroup.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>Team</SelectLabel>
                              {teamGroup.map((a) => (
                                <AuthorOption key={a.id} a={a} suffix={catMatched.find((m) => m.id === a.id) ? " ★" : ""} />
                              ))}
                            </SelectGroup>
                          )}
                          {external.length > 0 && (
                            <SelectGroup>
                              <SelectLabel>External</SelectLabel>
                              {external.map((a) => (
                                <AuthorOption key={a.id} a={a} />
                              ))}
                            </SelectGroup>
                          )}
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
                {/* Profile-incomplete warning: shown when the selected author's profile
                    is not yet complete, blocking progression to author sign-off. */}
                {form.authorProfileId &&
                  (() => {
                    const ap = authors?.find((a) => a.id === form.authorProfileId);
                    const incomplete = ap && !(ap as any).profileComplete;
                    const relevantStatus = ["in_review", "pending_cm_review"].includes(article.status);
                    if (!incomplete || !relevantStatus) return null;
                    return (
                      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm" data-testid="alert-author-profile-incomplete">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div>
                          <p className="font-medium text-amber-800 dark:text-amber-300">Author profile incomplete</p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                            {ap?.displayName ?? "This author"} must fill in their public title, bio, and photo before the article can be sent for author sign-off. Ask them to complete their profile in the Authors panel.
                          </p>
                        </div>
                      </div>
                    );
                  })()
                }
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  rows={3}
                  value={form.excerpt}
                  onChange={(e) => update({ excerpt: e.target.value })}
                  placeholder="Short summary…"
                  disabled={!canEdit}
                  data-testid="input-excerpt"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => update({ tags: e.target.value })}
                  placeholder="comma, separated"
                  disabled={!canEdit}
                  data-testid="input-tags"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => update({ slug: e.target.value })}
                  placeholder="url-slug"
                  disabled={!canEdit}
                  data-testid="input-slug"
                />
              </div>
            </CardContent>
          </Card>

          {/* Brief & Strategy sidebar card */}
          <Card data-testid="card-brief-strategy">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Brief &amp; Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="brief-audience" className="text-xs">Audience</Label>
                <Select
                  value={form.audience || "none"}
                  onValueChange={(v) => update({ audience: v === "none" ? "" : v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="brief-audience" className="h-8 text-sm" data-testid="select-brief-audience">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    <SelectItem value="AUTO_DETECT">Auto-detect from context</SelectItem>
                    <SelectItem value="EMPLOYER_CLIENT">Employer / Client</SelectItem>
                    <SelectItem value="MSP_STAFFING_PARTNER">MSP / Staffing Partner</SelectItem>
                    <SelectItem value="CANDIDATE_PROFESSIONAL">Candidate / Professional</SelectItem>
                    <SelectItem value="RECRUITER_OPERATOR">Recruiter / Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brief-tone" className="text-xs">Tone</Label>
                <Select
                  value={form.toneVoice || "none"}
                  onValueChange={(v) => update({ toneVoice: v === "none" ? "" : v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="brief-tone" className="h-8 text-sm" data-testid="select-brief-tone">
                    <SelectValue placeholder="Brand default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brand default (AUTO)</SelectItem>
                    <SelectItem value="AUTHORITATIVE">Authoritative &amp; Expert</SelectItem>
                    <SelectItem value="CONVERSATIONAL">Conversational &amp; Warm</SelectItem>
                    <SelectItem value="EDUCATIONAL">Educational &amp; Informative</SelectItem>
                    <SelectItem value="INSPIRATIONAL">Inspirational &amp; Motivating</SelectItem>
                    <SelectItem value="PRACTICAL">Practical &amp; Actionable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brief-brief" className="text-xs">Generation brief</Label>
                <Textarea
                  id="brief-brief"
                  rows={3}
                  value={form.generationBrief}
                  onChange={(e) => update({ generationBrief: e.target.value })}
                  placeholder="Key points, angles, or facts the AI must include…"
                  disabled={!canEdit}
                  className="text-sm"
                  data-testid="input-brief-brief"
                />
                <p className="text-[11px] text-muted-foreground">
                  Saved as key points for AI generation. Specific beats generic.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brief-compliance" className="flex items-center gap-1.5 text-xs">Compliance mode <FieldHelp id="article-compliance-mode" /></Label>
                <Select
                  value={form.complianceMode || "normal"}
                  onValueChange={(v) => update({ complianceMode: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="brief-compliance" className="h-8 text-sm" data-testid="select-brief-compliance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLIANCE_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.complianceMode && form.complianceMode !== "normal" && (
                  <p className="text-[11px] text-muted-foreground">{getComplianceBlurb(form.complianceMode)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Featured image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.coverImageUrl ? (
                <img
                  src={form.coverImageUrl}
                  alt="Cover"
                  className="aspect-video w-full rounded-md border object-cover"
                  data-testid="img-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                  No image yet
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760}
                    buttonClassName="w-full"
                    onGetUploadParameters={async (file) => {
                      const res = await apiRequest("POST", "/api/admin/studio/upload-url", {
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
                        update({ coverImageUrl: lastUploadPath.current });
                        toast({ title: "Image uploaded" });
                      }
                    }}
                  >
                    <span className="inline-flex items-center">
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {form.coverImageUrl ? "Replace image" : "Upload image"}
                    </span>
                  </ObjectUploader>
                  {form.coverImageUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => update({ coverImageUrl: "" })}
                      data-testid="button-remove-cover"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="seo-title">SEO title</Label>
                <Input
                  id="seo-title"
                  value={form.seoTitle}
                  onChange={(e) => update({ seoTitle: e.target.value })}
                  disabled={!canEdit}
                  data-testid="input-seo-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-desc">SEO description</Label>
                <Textarea
                  id="seo-desc"
                  rows={2}
                  value={form.seoDescription}
                  onChange={(e) => update({ seoDescription: e.target.value })}
                  disabled={!canEdit}
                  data-testid="input-seo-description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" />
                Versions
              </CardTitle>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveVersionMutation.mutate()}
                  disabled={saveVersionMutation.isPending}
                  data-testid="button-save-version"
                >
                  {saveVersionMutation.isPending && (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  )}
                  Snapshot
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {!versions || versions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No versions saved yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs ${(v as any).superseded ? "opacity-50" : ""}`}
                      data-testid={`version-${v.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">v{v.versionNo}</span>
                          {(v as any).regenMode && (
                            <span className="rounded bg-blue-100 text-blue-700 px-1 py-0 text-[10px] font-medium capitalize">
                              {(v as any).regenMode === "rework" ? "rework" : "regen"}
                            </span>
                          )}
                          {(v as any).superseded && (
                            <span className="rounded bg-gray-100 text-gray-500 px-1 py-0 text-[10px]">superseded</span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => restoreMutation.mutate(v.id)}
                          disabled={restoreMutation.isPending}
                          data-testid={`button-restore-${v.id}`}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regen panel — shown when article has content */}
          {article && article.bodyMarkdown && (
            <ArticleRegenPanel
              articleId={article.id}
              articleTitle={article.title ?? ""}
              currentMarkdown={article.bodyMarkdown ?? ""}
              domainResolved={(article as any).domainResolved ?? ""}
              initialBrief={{
                hookPattern: (article as any).hookPattern ?? "",
                desiredEmotion: (article as any).desiredEmotion ?? "",
                contentStructure: (article as any).contentStructure ?? "",
                engagementGoal: (article as any).engagementGoal ?? "",
              }}
              onCommit={(newMarkdown, newTitle) => {
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        bodyMarkdown: newMarkdown,
                        ...(newTitle ? { title: newTitle } : {}),
                      }
                    : f
                );
                setDirty(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Repurpose-to-ideas modal — channel picker. */}
      <Dialog open={repurposeOpen} onOpenChange={setRepurposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Recycle className="h-5 w-5" />
              Repurpose article
            </DialogTitle>
            <DialogDescription>
              Pick the channels to repurpose this article into. The AI proposes one suggested
              idea per channel — nothing is published until you accept it in the pipeline.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Channels</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STUDIO_CHANNELS.map((c) => (
                <Badge
                  key={c}
                  variant={repurposeChannels.includes(c) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() =>
                    setRepurposeChannels((prev) =>
                      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                    )
                  }
                  data-testid={`badge-repurpose-channel-${c}`}
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepurposeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => repurposeMutation.mutate(repurposeChannels)}
              disabled={!repurposeChannels.length || repurposeMutation.isPending}
              data-testid="button-confirm-repurpose"
            >
              {repurposeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Repurpose into {repurposeChannels.length || "no"} idea(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generate Draft modal — Psychological Brief (Task #1060) */}
      <Dialog open={genOpen} onOpenChange={(open) => {
        setGenOpen(open);
        if (!open) { setGenStep("input"); setResolvedBrief(null); setGenThinBriefOverride(false); }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Generate draft
            </DialogTitle>
            <DialogDescription>
              Tell the AI what you want to write and where it will live. The AI selects hook, structure and tone automatically — or open Creative direction to override.
            </DialogDescription>
          </DialogHeader>

          {editorBrandVoice && !editorBrandVoice.config && (
            <StudioTip
              id="editor-default-voice"
              title="No Brand Voice configured"
              body="Drafts will use a generic default voice. Configure Brand Voice to sound like Hire'in from the first word."
              action={{ label: "Configure Brand Voice", href: studioPath("/settings/brand-voice") }}
            />
          )}

          <div className="space-y-4">
            {/* 1. Platform */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">Platform <span className="text-destructive">*</span> <FieldHelp id="article-platform" /></Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setGenPlatform(p.value);
                      const validIntents = (PLATFORM_CONTENT_INTENTS[p.value] ?? PLATFORM_CONTENT_INTENTS.ARTICLE).map((i) => i.value);
                      if (!validIntents.includes(genFormat)) setGenFormat(validIntents[0] ?? "thought_leadership");
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors${genPlatform === p.value ? " border-primary bg-primary text-primary-foreground" : " border-input bg-background hover:bg-muted"}`}
                    data-testid={`button-platform-${p.value.toLowerCase()}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Content intent */}
            <div className="space-y-2">
              <Label>Content intent <span className="text-destructive">*</span></Label>
              <Select value={genFormat} onValueChange={setGenFormat}>
                <SelectTrigger data-testid="select-gen-intent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(PLATFORM_CONTENT_INTENTS[genPlatform] ?? PLATFORM_CONTENT_INTENTS.ARTICLE).map((i) => (
                    <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Topic — required */}
            <div className="space-y-2">
              <Label htmlFor="gen-topic">Topic or instruction <span className="text-destructive">*</span></Label>
              <Textarea
                id="gen-topic"
                rows={2}
                value={genTopic}
                onChange={(e) => setGenTopic(e.target.value)}
                placeholder="e.g. Why IT hiring managers reject technically qualified candidates — and what recruiters miss in the intake call"
                data-testid="input-gen-topic"
                autoFocus
              />
            </div>

            {/* 4. Audience — optional */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Who is this for?
                <span className="font-normal text-muted-foreground">(optional)</span>
                <FieldHelp id="article-audience" />
              </Label>
              <Select value={genAudience || "AUTO_DETECT"} onValueChange={(v) => setGenAudience(v === "AUTO_DETECT" ? "" : v)}>
                <SelectTrigger data-testid="select-gen-audience">
                  <SelectValue placeholder="Let AI decide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO_DETECT">Let AI decide</SelectItem>
                  <SelectItem value="EMPLOYER_CLIENT">Employer / Client</SelectItem>
                  <SelectItem value="CANDIDATE_PROFESSIONAL">Candidate / Professional</SelectItem>
                  <SelectItem value="MSP_STAFFING_PARTNER">MSP / Staffing Partner</SelectItem>
                  <SelectItem value="RECRUITER_OPERATOR">Recruiter / Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 5. Facts — optional */}
            <div className="space-y-2">
              <Label htmlFor="gen-facts">
                Facts or context
                <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="gen-facts"
                rows={2}
                value={genUserFacts}
                onChange={(e) => setGenUserFacts(e.target.value)}
                placeholder="Job details, recruiter notes, a leadership POV, or any specific facts to include."
                data-testid="input-gen-facts"
              />
            </div>

            {/* Creative direction — collapsible advanced section */}
            <div className="rounded-md border">
              <button
                type="button"
                onClick={() => setGenCreativeDirectionOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                data-testid="button-toggle-creative-direction"
              >
                <span className="flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Creative direction</span>
                  <span className="text-xs text-muted-foreground">— optional, AI decides if left blank</span>
                </span>
                {genCreativeDirectionOpen
                  ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </button>

              {genCreativeDirectionOpen && (
                <div className="space-y-4 border-t px-3 pb-3 pt-3">
                  {/* Desired emotion */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm">Desired reader emotion</Label>
                      <FieldHelp id="article-desired-emotion" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setGenDesiredEmotion("")}
                        className={`rounded-md border px-3 py-1.5 text-xs transition-colors${!genDesiredEmotion ? " border-primary bg-primary text-primary-foreground" : " border-input bg-background hover:bg-muted"}`}
                        data-testid="button-emotion-auto"
                      >
                        Let AI decide
                      </button>
                      {DESIRED_EMOTIONS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setGenDesiredEmotion(genDesiredEmotion === e ? "" : e)}
                          className={`rounded-md border px-3 py-1.5 text-xs transition-colors${genDesiredEmotion === e ? " border-primary bg-primary text-primary-foreground" : " border-input bg-background hover:bg-muted"}`}
                          data-testid={`button-emotion-${e.toLowerCase().replace(/\s/g, "-")}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hook pattern */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm">Hook pattern <FieldHelp id="article-hook-pattern" /></Label>
                    <Select
                      value={genHookPattern || "__auto__"}
                      onValueChange={(v) => setGenHookPattern(v === "__auto__" ? "" : v)}
                    >
                      <SelectTrigger data-testid="select-gen-hook">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Let AI decide</SelectItem>
                        {HOOK_PATTERNS.map((h) => (
                          <SelectItem key={h.value} value={h.value}>
                            {h.label} — {h.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Content structure */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm">Content structure <FieldHelp id="article-content-structure" /></Label>
                    <Select
                      value={genContentStructure || "__auto__"}
                      onValueChange={(v) => setGenContentStructure(v === "__auto__" ? "" : v)}
                    >
                      <SelectTrigger data-testid="select-gen-structure">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">Let AI decide</SelectItem>
                        {CONTENT_STRUCTURES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {genContentStructure && (
                      <p className="text-xs text-muted-foreground">
                        {CONTENT_STRUCTURES.find((s) => s.value === genContentStructure)?.description}
                      </p>
                    )}
                  </div>

                  {/* Engagement goal */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm">Engagement goal <FieldHelp id="article-engagement-goal" /></Label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setGenEngagementGoal("")}
                        className={`rounded-md border px-3 py-1.5 text-xs transition-colors${!genEngagementGoal ? " border-primary bg-primary text-primary-foreground" : " border-input bg-background hover:bg-muted"}`}
                        data-testid="button-goal-auto"
                      >
                        Let AI decide
                      </button>
                      {ENGAGEMENT_GOALS.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGenEngagementGoal(genEngagementGoal === g ? "" : g)}
                          className={`rounded-md border px-3 py-1.5 text-xs transition-colors${genEngagementGoal === g ? " border-primary bg-primary text-primary-foreground" : " border-input bg-background hover:bg-muted"}`}
                          data-testid={`button-goal-${g.toLowerCase().replace(/[^a-z]/g, "-")}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Brief quality + cost estimate panel — appears when topic is filled */}
          {genTopic.trim().length > 4 && estimateData && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              {/* Brief quality header row */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Brief quality</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    estimateData.briefQuality.tier === "ready"
                      ? "bg-green-100 text-green-700"
                      : estimateData.briefQuality.tier === "fair"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                  data-testid="badge-brief-quality"
                >
                  {estimateData.briefQuality.score}/100 — {estimateData.briefQuality.tier.charAt(0).toUpperCase() + estimateData.briefQuality.tier.slice(1)}
                </span>
              </div>

              {/* Thin-brief warning banner */}
              {estimateData.briefQuality.tier === "thin" && !genThinBriefOverride && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5" data-testid="banner-thin-brief">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-red-700">Brief is too thin to generate high-quality content</p>
                    <p className="text-xs text-red-600">
                      AI drafts from thin briefs tend to be generic and require heavy edits. Fill in the missing fields below, then generate.
                    </p>
                  </div>
                </div>
              )}

              {/* Missing fields */}
              {estimateData.briefQuality.missingFields.length > 0 && (
                <ul className="space-y-0.5">
                  {estimateData.briefQuality.missingFields.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-1 text-xs text-muted-foreground">
                      <span className="mt-0.5 shrink-0 text-red-400">+</span>
                      <span>Add: {s}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Cost estimate */}
              <div className="flex items-center justify-between border-t pt-2 mt-1">
                <span className="text-xs text-muted-foreground">Estimated cost</span>
                <span className="text-xs tabular-nums font-medium" data-testid="text-estimate-cost">
                  ${estimateData.estimatedCostMin.toFixed(4)}–${estimateData.estimatedCostMax.toFixed(4)}
                </span>
              </div>
            </div>
          )}

          {/* Thin-brief gate: split footer */}
          {genTopic.trim().length > 4 && estimateData?.briefQuality?.tier === "thin" && !genThinBriefOverride ? (
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setGenOpen(false)}
                data-testid="button-fill-brief"
                className="w-full sm:w-auto"
              >
                Fill brief first
              </Button>
              <Button
                variant="ghost"
                onClick={() => setGenThinBriefOverride(true)}
                data-testid="button-generate-anyway"
                className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
              >
                Generate anyway (poor quality)
              </Button>
            </DialogFooter>
          ) : (
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)} data-testid="button-cancel-generate">
                Cancel
              </Button>
              <Button
                onClick={() => generateArticleMutation.mutate()}
                disabled={generateArticleMutation.isPending || !genTopic.trim()}
                data-testid="button-run-generate"
              >
                {generateArticleMutation.isPending ? (
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
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ref declared below to keep hook order stable
}

function getComplianceBlurb(value: string): string {
  return COMPLIANCE_MODES.find((m) => m.value === value)?.blurb ?? "";
}

// Holds the most recent presigned upload object path between request + complete.
const lastUploadPath = { current: "" as string };

export default function ArticleEditor() {
  const params = useParams();
  const id = params.id as string;
  return (
    <AdminLayout>
      <ArticleEditorInner id={id} key={id} />
    </AdminLayout>
  );
}

const CARD_LAYOUT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "checklist", label: "Checklist" },
  { value: "quote", label: "Quote" },
];

interface GeneratedCard {
  layout: string;
  platform: string;
  url: string;
  width: number;
  height: number;
}

function budgetSummary(b: CardBudget): string {
  const parts: string[] = [];
  if (b.title) parts.push(`Title ≤${b.title}`);
  if (b.quote) parts.push(`Quote ≤${b.quote}`);
  if (b.supporting) parts.push(`Body ≤${b.supporting}`);
  if (b.category) parts.push(`Tag ≤${b.category}`);
  if (b.tipTitle) parts.push(`Tip title ≤${b.tipTitle}`);
  if (b.tipDesc) parts.push(`Tip text ≤${b.tipDesc}`);
  if (b.maxTips) parts.push(`${b.maxTips} tips max`);
  return parts.join(" · ");
}

function BrandedSocialCards({ article }: { article: StudioArticle }) {
  const { toast } = useToast();
  const stored = (article.socialCardsJsonb as { layout?: string; cards?: GeneratedCard[] } | null) ?? null;
  const [layout, setLayout] = useState<string>(article.cardLayout ?? stored?.layout ?? "standard");
  const cards = stored?.cards ?? [];
  const variants = cardVariantsForLayout(layout as any);

  const regenerate = useMutation({
    mutationFn: async () =>
      apiRequest("POST", `/api/admin/studio/articles/${article.id}/regenerate-cards`, { layout }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studio/articles", article.id] });
      toast({ title: "Social cards regenerated" });
    },
    onError: (e: any) => {
      toast({ title: "Could not regenerate cards", description: e?.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-branded-social-cards">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-sm">Branded Social Cards</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Auto-generated when the article is approved. Pick a layout and regenerate any time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={layout} onValueChange={setLayout}>
            <SelectTrigger className="h-8 w-[140px]" data-testid="select-card-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_LAYOUT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} data-testid={`option-layout-${o.value}`}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            data-testid="button-regenerate-cards"
          >
            {regenerate.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 rounded-md border bg-muted/30 p-3" data-testid="section-char-budgets">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Character budgets for the {layout} layout
          </p>
          <ul className="space-y-1">
            {variants.map((v) => {
              const summary = budgetSummary(cardBudget(layout, v.platform));
              return (
                <li
                  key={v.platform}
                  className="flex flex-wrap items-baseline gap-x-2 text-xs"
                  data-testid={`budget-${v.platform}`}
                >
                  <span className="font-medium">{v.platform}</span>
                  <span className="text-muted-foreground">
                    {summary || "No specific limits"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {cards.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="text-no-cards">
            No cards generated yet. Approve the article or click Regenerate.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <div
                key={`${c.layout}-${c.platform}`}
                className="rounded-lg border p-2"
                data-testid={`card-social-${c.platform}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{c.platform}</span>
                  <a href={c.url} download data-testid={`link-download-${c.platform}`}>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </div>
                <div className="overflow-hidden rounded-md border bg-muted/30">
                  <img
                    src={c.url}
                    alt={`${c.layout} ${c.platform}`}
                    className="w-full"
                    style={{ aspectRatio: `${c.width} / ${c.height}` }}
                    data-testid={`img-card-${c.platform}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
