/**
 * FIELD_HELP_REGISTRY — central content store for all Studio field help popovers.
 *
 * Each entry is looked up by id from the <FieldHelp id="..." /> component.
 * learnMore links route to Guide.tsx or BdGuideView.tsx section anchors.
 */

export interface FieldHelpEntry {
  id: string;
  title: string;
  explanation: string;
  example: string;
  learnMore?: {
    label: string;
    href: string;
  };
}

export const FIELD_HELP_REGISTRY: Record<string, FieldHelpEntry> = {

  // ── BD Agent ────────────────────────────────────────────────────────────────

  "bd-domain": {
    id: "bd-domain",
    title: "Domain",
    explanation:
      "Domain controls the AI's vocabulary, proof points, and buyer assumptions. Healthcare uses clinical language and compliance framing; IT leads with speed-to-productivity; Engineering emphasises technical screening rigour; Professional Services focuses on billability and retention. Choose the domain that matches the buyer's primary function, not your internal team.",
    example:
      "A hospital system with 12 open RN roles → Healthcare. A SaaS startup hiring 5 backend engineers → IT / Technology.",
    learnMore: {
      label: "Domain value priorities in the BD Guide",
      href: "/admin/studio/bd-guide#s5",
    },
  },

  "bd-positioning-angle": {
    id: "bd-positioning-angle",
    title: "Positioning Angle",
    explanation:
      "Positioning angle tells the AI which value story to lead with for this specific client. Pick the angle that matches where the buyer is in their pain journey — early-stage accounts respond to problem framing; evaluation-stage accounts want proof of quality; commercial-stage accounts want cost clarity. Picking the wrong angle makes the output feel generic.",
    example:
      "Buyer has 8 roles open 75+ days and just got burned by a no-show → 'Full Staffing Partner' (speed + reliability). Buyer asking about fee structure on call 1 → 'Cost Efficiency Play' (ROI frame, vacancy cost math).",
    learnMore: {
      label: "Proposal & rate conversations in the BD Guide",
      href: "/admin/studio/bd-guide#s3",
    },
  },

  "bd-context-summary": {
    id: "bd-context-summary",
    title: "Context Summary",
    explanation:
      "This is the signal feed for the AI. The more specific you are, the more specific the output. Include: number of open roles and how long they've been open, the buyer's stated pain, any incumbent vendor information, decision-maker role and seniority, and any timing or budget signals. Vague context produces generic proposals.",
    example:
      "12 RN roles open avg. 75 days. Current vendor (HealthStaff Inc.) delivering 40% fallout rate. Decision-maker: VP of Nursing Ops. Budget approved for Q3. Pain: credentialing delays.",
    learnMore: {
      label: "Prospecting & research in the BD Guide",
      href: "/admin/studio/bd-guide#s1",
    },
  },

  // ── BD Decks ────────────────────────────────────────────────────────────────

  "bd-deck-domain": {
    id: "bd-deck-domain",
    title: "Domain (Deck)",
    explanation:
      "Domain locks the deck's tone, proof points, and industry-specific language. A Healthcare deck leads with compliance, credential screening, and retention; an IT deck leads with speed-to-productivity and technical assessment. Choosing the wrong domain produces slides that feel off-brief to the buyer.",
    example:
      "Pitching to an engineering firm's VP of Operations → Engineering. Pitching to a hospital's Chief Nursing Officer → Healthcare.",
    learnMore: {
      label: "Domain value priorities in the BD Guide",
      href: "/admin/studio/bd-guide#s5",
    },
  },

  "bd-deck-version": {
    id: "bd-deck-version",
    title: "Version",
    explanation:
      "Version tracks the evolution of a master deck. v1 is the initial baseline; v2+ signals a substantive refresh — new proof points, updated positioning, or structural changes. Version is used in approvals and audit history to identify which iteration of the deck a client received.",
    example:
      "v1 — first production deck for Healthcare. v2 — refreshed after Q2 positioning update with new pilot entry point slide.",
  },

  // ── BD Templates ────────────────────────────────────────────────────────────

  "bd-engagement-model": {
    id: "bd-engagement-model",
    title: "Engagement Model",
    explanation:
      "Engagement model tells the AI which commercial structure frames the proposal. Contract buyers want speed and flexibility; Contract-to-Hire buyers want trial-before-commit framing; Permanent buyers want quality and cultural fit. Each model changes the tone, fee justification, and value proposition the AI leads with.",
    example:
      "Healthcare system wants temp RNs for a seasonal surge → Contract. IT firm wants to evaluate a developer before committing → Contract-to-Hire. Professional services firm replacing a departing director → Permanent.",
    learnMore: {
      label: "Proposal structure in the BD Guide",
      href: "/admin/studio/bd-guide#s3",
    },
  },

  "bd-rate-info": {
    id: "bd-rate-info",
    title: "Rates / Numbers",
    explanation:
      "Include enough detail for the AI to frame ROI without exposing your negotiation position. Share the fee structure (percentage or hourly) and any ROI context — vacancy cost estimates, time-to-fill benchmarks — but avoid quoting specific competitor rates or internal margin targets. The AI uses this to build the value frame, not a price list.",
    example:
      "22% perm fee; contract rates $85–95/hr depending on specialisation. Client's internal time-to-fill benchmark is 45 days — we're targeting 21.",
  },

  "bd-client-pain-points": {
    id: "bd-client-pain-points",
    title: "Key Pain Point",
    explanation:
      "Write pain points in the buyer's language, not staffing agency language. Specific, quantified pain produces specific AI output. Generic pain ('they need people') produces generic proposals. The best pain points include a number, a consequence, and ideally something the buyer said in discovery.",
    example:
      "High-volume RN vacancies → weak. '12 RN roles open 75+ days; previous agency had 40% fallout rate at 90-day mark; CNO cited patient-to-nurse ratios as a compliance risk' → strong.",
    learnMore: {
      label: "Discovery call technique in the BD Guide",
      href: "/admin/studio/bd-guide#s2",
    },
  },

  "bd-research-notes": {
    id: "bd-research-notes",
    title: "Research Notes",
    explanation:
      "The four inputs that most improve AI proposal quality: (1) open roles count and how long they've been open, (2) incumbent vendor or current hiring method, (3) any budget or timeline signal, (4) a recent news item or trigger event. Leave any of these blank and the AI fills with generic assumptions.",
    example:
      "8 cloud roles open on LinkedIn (avg 62 days). Currently using direct hire + one PSL vendor. Q3 product launch driving urgency. Raised Series B in May — headcount plan approved.",
    learnMore: {
      label: "Research checklist in the BD Guide",
      href: "/admin/studio/bd-guide#s1",
    },
  },

  // ── Campaigns ────────────────────────────────────────────────────────────────

  "campaign-icp": {
    id: "campaign-icp",
    title: "Ideal Customer Profile (ICP)",
    explanation:
      "ICP is one line that defines exactly who this campaign is trying to reach. Use the format: [role] at [company type] with [signal]. A sharp ICP produces AI content with specific hooks; a vague ICP produces generic content that no one feels spoken to by. Do not confuse ICP with audience — ICP is the target account; audience is the person within it.",
    example:
      "Good: 'VP of Talent Acquisition at mid-size healthcare systems (500–2000 employees) currently hiring clinical staff'. Bad: 'HR professionals in healthcare'.",
    learnMore: {
      label: "Audience-first strategy in the Studio Guide",
      href: "/admin/studio/guide#s10",
    },
  },

  "campaign-funnel-stage": {
    id: "campaign-funnel-stage",
    title: "Funnel Stage",
    explanation:
      "Funnel stage sets the content's job. Awareness: make the problem visible, no pitch. Consideration: compare approaches, introduce Hire'in as a solution. Decision: close the case with proof, urgency, or a specific offer. Retention: deepen relationship with existing clients. Wrong funnel stage = right content, wrong moment.",
    example:
      "Awareness: 'The hidden cost of a 90-day vacancy in IT'. Consideration: 'Contract vs. perm: which model fits a scaling tech team?'. Decision: 'How Hire'in fills clinical roles 2× faster — with 90% retention at 12 months'.",
    learnMore: {
      label: "Running a campaign in the Studio Guide",
      href: "/admin/studio/guide#s4",
    },
  },

  "campaign-primary-cta": {
    id: "campaign-primary-cta",
    title: "Primary CTA",
    explanation:
      "The CTA must be specific enough for the AI to write copy toward it. Vague CTAs ('Contact us', 'Learn more') produce vague AI copy. A good CTA names the next step, the value of taking it, and ideally the friction level. The AI uses this to calibrate closing lines, urgency level, and what the content should make the reader feel right before they act.",
    example:
      "Weak: 'Contact us'. Strong: 'Book a 20-minute discovery call to see if Hire'in is the right fit for your open clinical roles — no pitch, just diagnosis'.",
    learnMore: {
      label: "Content pillars & goals in the Studio Guide",
      href: "/admin/studio/guide#s11",
    },
  },

  // ── Outreach ────────────────────────────────────────────────────────────────

  "outreach-sequence-type": {
    id: "outreach-sequence-type",
    title: "Sequence Type",
    explanation:
      "Sequence type controls the AI's assumed relationship with the recipient and therefore the tone and level of familiarity. Cold: no prior contact — needs a hook, not a relationship callback. Warm: prior interaction (call, email, event) — can reference shared context. Referral: named connection introduced you — lead with that name immediately.",
    example:
      "Cold LinkedIn DM to a CNO who doesn't know Hire'in → Cold. Follow-up after a discovery call last week → Warm. Intro from a mutual connection → Referral.",
  },

  "outreach-audience-type": {
    id: "outreach-audience-type",
    title: "Audience Type",
    explanation:
      "Audience type changes the hook, language register, and pain points the AI leads with. Hiring Managers think in time-to-fill and candidate quality. HR Directors think in compliance, cost-per-hire, and vendor management. Procurement thinks in SLAs, contract terms, and risk. Each needs a different first line.",
    example:
      "Hiring Manager: lead with speed and submission quality. HR Director: lead with process, consistency, and reporting. Procurement: lead with SLA clarity, references, and contract flexibility.",
  },

  "outreach-subject-hook": {
    id: "outreach-subject-hook",
    title: "Subject / Hook",
    explanation:
      "For email: the subject line formula that works is [specific observation] + [implied benefit] — avoid 'I came across your profile' and 'Following up on my last email'. For LinkedIn: the first line of a DM is your headline — it must stand alone, because most people read only that before deciding to click More. Never open with your company name.",
    example:
      "Email: '12 open RN roles — two thoughts'. LinkedIn first line: 'Your ICU roles have been open 60+ days — I have 3 credentialed candidates ready to interview this week.'",
    learnMore: {
      label: "Follow-up & nurture in the BD Guide",
      href: "/admin/studio/bd-guide#s4",
    },
  },

  // ── Content Copilot — Article Editor ────────────────────────────────────────

  "article-compliance-mode": {
    id: "article-compliance-mode",
    title: "Compliance Mode",
    explanation:
      "Compliance mode sets the Safety Gate's strictness. Normal: standard brand and accuracy guardrails. Healthcare Safe: blocks unverifiable clinical claims (retention rates, credential stats). Public Sector Safe: strips any language that could imply contractual commitment or government-specific capability. No Claims: maximum restriction — no statistics or outcome promises of any kind.",
    example:
      "Content about nurse staffing ratios → Healthcare Safe. An RFP response for a government contract → Public Sector Safe. A case study for a regulated financial services client → No Claims.",
    learnMore: {
      label: "Content guardrails in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "article-audience": {
    id: "article-audience",
    title: "Who Is This For?",
    explanation:
      "AUTO_DETECT asks the AI to infer the audience from the topic and content type — it works well for most general staffing content. Override it when you know the specific reader: a piece about credentialing gaps is for Employer/Client; a piece on interview prep is for Candidate/Professional. Audience shapes vocabulary, assumed knowledge, pain points, and the CTA.",
    example:
      "Auto-detect works well for: 'The state of IT hiring in 2025'. Override for: 'How to negotiate a contract rate as a travel nurse' → Candidate / Professional.",
    learnMore: {
      label: "Audience-first strategy in the Studio Guide",
      href: "/admin/studio/guide#s10",
    },
  },

  // ── Content Copilot — Creative Direction (Brief Fields) ──────────────────────

  "article-platform": {
    id: "article-platform",
    title: "Platform",
    explanation:
      "Platform controls format, length, and style. Article: long-form, SEO-friendly, structured headings. LinkedIn: 150–300 word post, hook-first, no headers. Email: subject line + short body, single CTA. Slide: punchy bullets, no prose. Each platform has different word count targets, formatting rules, and what 'good' looks like for AI output.",
    example:
      "Thought leadership piece on talent shortages → Article. Quick observation from a recent client call → LinkedIn. Nurture email to a warm prospect → Email.",
  },

  "article-desired-emotion": {
    id: "article-desired-emotion",
    title: "Desired Reader Emotion",
    explanation:
      "Desired emotion shapes the hook and opening line. The AI uses this to decide the tone of the first 50 words — the part readers actually see before deciding to continue. Urgency produces a 'you're missing something' opening; curiosity produces a 'here's what most people get wrong' framing; confidence produces a reassuring, authoritative voice.",
    example:
      "Content about clinical burnout → Empathy. Content about a faster hiring approach → Urgency or Confidence. Content about an underappreciated market shift → Curiosity.",
    learnMore: {
      label: "The content brief in the Studio Guide",
      href: "/admin/studio/guide#s12",
    },
  },

  "article-hook-pattern": {
    id: "article-hook-pattern",
    title: "Hook Pattern",
    explanation:
      "Hook pattern selects the structural formula for the opening. Contrarian: 'The thing everyone believes is wrong'. Question: 'What if X?' or 'Why does Y keep happening?'. Statistic: leads with a surprising number. Story: opens with a specific scenario or moment. Problem-Agitate-Solve: names the pain, amplifies it, then positions the solution. Leave blank to let the AI decide.",
    example:
      "Contrarian: 'Most staffing agencies are solving the wrong problem.' Question: 'Why do 40% of placed candidates leave within 90 days?' Statistic: '73% of hiring managers say time-to-fill is their top concern — yet most still use a 6-week process.'",
    learnMore: {
      label: "The content brief in the Studio Guide",
      href: "/admin/studio/guide#s12",
    },
  },

  "article-content-structure": {
    id: "article-content-structure",
    title: "Content Structure",
    explanation:
      "Content structure sets the editorial skeleton. Listicle: numbered or bulleted list format — best for LinkedIn and scannable content. Problem-Solution: frames pain, then remedy. How-To: step-by-step instructional. Comparison: side-by-side evaluation (A vs. B). Narrative: story arc with a beginning, middle, and lesson. Leave blank to let the AI choose the best structure for the topic.",
    example:
      "Top 5 mistakes hiring managers make → Listicle. Why your RN turnover is higher than it needs to be → Problem-Solution. How to prep for a staffing partnership conversation → How-To.",
    learnMore: {
      label: "The content brief in the Studio Guide",
      href: "/admin/studio/guide#s12",
    },
  },

  "article-engagement-goal": {
    id: "article-engagement-goal",
    title: "Engagement Goal",
    explanation:
      "Engagement goal tells the AI what the reader should do or feel by the final line. Share: the closing should make them feel the insight is worth passing on. Comment: should end with a question or provocation. Click CTA: the close is a strong, specific call to action. Save: the content is reference material worth bookmarking. This changes the entire closing sequence.",
    example:
      "LinkedIn thought leadership → Share or Comment. Email campaign content → Click CTA. Research-heavy article → Save.",
    learnMore: {
      label: "Content pillars & goals in the Studio Guide",
      href: "/admin/studio/guide#s11",
    },
  },

  // ── Safety Gate — per-finding rule explanations ───────────────────────────

  "safety-JOB_FACT_INVENTED": {
    id: "safety-JOB_FACT_INVENTED",
    title: "Invented Job Fact",
    explanation:
      "The Safety Gate found a specific detail — compensation, shift pattern, or urgency language — that was not present in the facts or context you supplied before generating. The AI invented it. All job-specific claims must come from the user-supplied context; the gate blocks any that it cannot trace back to the source ledger.",
    example:
      "AI wrote '$85/hr' or 'Day shift, Monday–Friday' but no rate or schedule was in your supplied facts. Fix: add the real value to 'Facts or context' and regenerate, or remove the sentence.",
    learnMore: {
      label: "Compliance mode in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "safety-HEALTHCARE_FACT_INVENTED": {
    id: "safety-HEALTHCARE_FACT_INVENTED",
    title: "Healthcare Claim Not Supplied",
    explanation:
      "The Safety Gate detected recency language ('currently licensed', 'recently credentialed') or clinical advice language that was not in your supplied facts, or is categorically prohibited. Healthcare content must never assert credential currency or clinical direction that the user did not explicitly supply. Even if the AI sounds credible, the gate rejects unsupported clinical claims.",
    example:
      "AI wrote 'currently licensed in three states' but no license info was in your facts. Fix: add the credential detail to 'Facts or context', switch to a different compliance mode, or rewrite the sentence.",
    learnMore: {
      label: "Compliance mode in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "safety-IT_FACT_INVENTED": {
    id: "safety-IT_FACT_INVENTED",
    title: "IT Credential Not Supplied",
    explanation:
      "The Safety Gate found a security clearance requirement or a specific certification (AWS Certified, CISSP, etc.) in the generated content that was not present in the facts you supplied. For IT job marketing, every clearance level and named certification must be traceable to the approved job record.",
    example:
      "AI wrote 'Active Secret clearance required' but clearance was not in your supplied facts. Fix: add the clearance level to 'Facts or context' and regenerate, or remove the requirement.",
    learnMore: {
      label: "Compliance mode in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "safety-GOVERNMENT_CLAIM_INVENTED": {
    id: "safety-GOVERNMENT_CLAIM_INVENTED",
    title: "Government Claim Not Verified",
    explanation:
      "The Safety Gate found a government contract vehicle (GSA Schedule, IDIQ, GWAC) or compliance certification (FedRAMP, FISMA, CMMC) that was not in your supplied facts. These claims are high-risk in public sector content — asserting a contract vehicle or certification you do not hold can create legal exposure. The gate blocks all unsupported government-specific claims.",
    example:
      "AI wrote 'FedRAMP Moderate authorized' but no certification was in your facts. Fix: add verified government credentials to 'Facts or context', or remove the claim from the content.",
    learnMore: {
      label: "Compliance mode in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "safety-COMPANY_CLAIM_INVENTED": {
    id: "safety-COMPANY_CLAIM_INVENTED",
    title: "Hire'in Performance Claim Not Supplied",
    explanation:
      "The Safety Gate detected a Hire'in-specific performance claim — a fill rate, placement metric, time-to-fill figure, or superlative ('leading', '#1') — that was not in your supplied facts. Company KPIs and comparative claims must be user-supplied, approved facts. The AI cannot invent them, even as plausible approximations.",
    example:
      "AI wrote 'Hire'in delivers a 94% placement rate' but no rate was in your facts. Fix: add the real, approved metric to 'Facts or context', or remove the company performance claim.",
    learnMore: {
      label: "Compliance mode in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "safety-PLACEHOLDER_LEAKED": {
    id: "safety-PLACEHOLDER_LEAKED",
    title: "Template Placeholder in Output",
    explanation:
      "A template placeholder (like [ROLE_TITLE] or [LOCATION]) was not replaced before the content was generated or surfaced in the output. This usually means the AI used a prompt template fragment that should have been filled in with real data. The content cannot be published until all placeholders are replaced with real values.",
    example:
      "Output contains '[MUST_HAVE_1]' or '[CARE_SETTING]'. Fix: provide the missing job details in 'Facts or context' and regenerate, or manually edit the placeholder out of the content.",
    learnMore: {
      label: "Compliance mode in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },

  "safety-BANNED_PHRASE": {
    id: "safety-BANNED_PHRASE",
    title: "Banned Phrase Detected",
    explanation:
      "The Safety Gate matched a phrase from the Content Craft banned list — expressions that are overused, meaningless to buyers, or inconsistent with Hire'in's brand voice. These include AI-hype words ('unlock', 'delve into'), agency clichés ('people are our greatest asset', 'rockstar', 'ninja'), and hollow opener patterns ('in today's fast-paced world'). The AI self-edit pass should have caught these, but occasionally they slip through.",
    example:
      "AI wrote 'unlock your potential' or 'navigate the complexities of hiring'. Fix: edit the flagged sentence to make the same point with a specific, direct claim instead.",
    learnMore: {
      label: "Content guardrails in the Studio Guide",
      href: "/admin/studio/guide#s13",
    },
  },
};
