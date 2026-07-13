const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const NAVY_LIGHT = "#2a4d8f";
const ORANGE = "#F47C20";
const ORANGE_LIGHT = "#F96D3E";

/* ─── Global App Header ─────────────────────────────────────────────────── */
function AppHeader() {
  const nav = ["Solutions", "Industries", "Insights", "About", "Careers"];
  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div
            style={{ background: NAVY }}
            className="w-7 h-7 rounded-md flex items-center justify-center"
          >
            <span className="text-white font-black text-sm leading-none">H</span>
          </div>
          <span
            style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }}
            className="font-bold text-base tracking-tight"
          >
            Hire<span style={{ color: ORANGE }}>'in</span>{" "}
            <span className="font-light">Solutions</span>
          </span>
        </div>

        {/* Primary nav */}
        <nav className="flex items-center gap-7">
          {nav.map((item) => (
            <span
              key={item}
              style={{
                color: item === "Insights" ? NAVY : "#6b7280",
                fontFamily: "'Inter', sans-serif",
                borderBottom: item === "Insights" ? `2px solid ${ORANGE}` : "2px solid transparent",
                paddingBottom: 2,
              }}
              className="text-sm font-medium cursor-pointer hover:text-gray-900 transition-colors pb-0.5"
            >
              {item}
            </span>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            style={{ background: NAVY, fontFamily: "'Inter', sans-serif" }}
            className="px-4 py-1.5 rounded-full text-white text-xs font-semibold tracking-wide hover:brightness-110 transition-all"
          >
            Subscribe
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Industry Filter Strip ─────────────────────────────────────────────── */
const FILTERS = [
  { label: "All Insights", active: false },
  { label: "Healthcare", active: true },
  { label: "Technology", active: false },
  { label: "Engineering", active: false },
  { label: "Professional Services", active: false },
  { label: "Talent Strategy", active: false },
  { label: "Leadership", active: false },
];

function IndustryFilterStrip() {
  return (
    <div className="w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center gap-1 py-2.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              style={{
                fontFamily: "'Inter', sans-serif",
                background: f.active ? NAVY : "transparent",
                color: f.active ? "white" : "#6b7280",
                border: f.active ? `1px solid ${NAVY}` : "1px solid transparent",
              }}
              className="flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-medium transition-all hover:bg-gray-50 whitespace-nowrap"
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex-shrink-0 pl-4 border-l border-gray-100">
            <span
              style={{ color: "#9ca3af", fontFamily: "'Inter', sans-serif" }}
              className="text-xs flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
              Filter
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Article Header ─────────────────────────────────────────────────────── */
function ArticleHeader() {
  return (
    <div className="pt-10 pb-8 border-b border-gray-100">
      {/* Category + badges */}
      <div className="flex items-center gap-2.5 mb-5">
        <span
          style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }}
          className="text-xs font-bold uppercase tracking-widest"
        >
          Healthcare · Talent Strategy
        </span>
        <span className="text-gray-200">—</span>
        <span
          style={{
            background: ORANGE + "14",
            color: ORANGE,
            border: `1px solid ${ORANGE}30`,
            fontFamily: "'Inter', sans-serif",
          }}
          className="px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider"
        >
          Executive Insight
        </span>
        <span
          style={{ fontFamily: "'Inter', sans-serif" }}
          className="px-2.5 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-100"
        >
          8 min read
        </span>
      </div>

      {/* Headline */}
      <h1
        style={{
          color: NAVY,
          fontFamily: "'Playfair Display', Georgia, serif",
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
        }}
        className="text-5xl font-bold mb-5 max-w-3xl"
      >
        Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding
      </h1>

      {/* Deck */}
      <p
        style={{ fontFamily: "'Inter', sans-serif" }}
        className="text-xl text-gray-500 leading-relaxed max-w-2xl mb-8 font-light"
      >
        Burnout alone doesn't explain the exodus. A deeper structural misalignment between how healthcare organizations define "retention" and what clinicians actually need is quietly accelerating a workforce crisis that conventional HR metrics consistently miss.
      </p>

      {/* Meta strip */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` }}
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm"
          >
            <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white font-bold text-xs">KS</span>
          </div>
          <div>
            <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-sm font-semibold leading-tight">Kavita Sharma</p>
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-xs text-gray-400 leading-tight">Founder & CEO, Hire'in Solutions</p>
          </div>
        </div>
        <div className="w-px h-7 bg-gray-150" style={{ background: "#e5e7eb" }} />
        <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm text-gray-400">July 11, 2025</span>
        <div className="w-px h-7 bg-gray-100" style={{ background: "#e5e7eb" }} />
        <div className="flex items-center gap-1.5 text-sm text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          4,820
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          38
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            style={{ fontFamily: "'Inter', sans-serif" }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
          <button
            style={{ background: NAVY, fontFamily: "'Inter', sans-serif" }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-white hover:brightness-110 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Save article
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero Visual ───────────────────────────────────────────────────────── */
function HeroImage() {
  return (
    <div
      className="w-full rounded-xl overflow-hidden my-9 relative"
      style={{ height: 400, background: `linear-gradient(140deg, ${NAVY_DARK} 0%, ${NAVY} 45%, ${NAVY_LIGHT} 80%, #3a6aad 100%)` }}
    >
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />
      {/* Pull-quote */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
        <div style={{ background: ORANGE }} className="w-10 h-0.5 rounded-full mb-5" />
        <p
          style={{ fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.35 }}
          className="text-white text-3xl font-semibold max-w-lg opacity-95"
        >
          "Talent doesn't leave organizations. It leaves systems that stopped listening."
        </p>
        <div style={{ background: ORANGE }} className="w-6 h-0.5 rounded-full mt-5" />
      </div>
      {/* Caption */}
      <div className="absolute bottom-4 right-5">
        <span style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }} className="text-xs font-bold uppercase tracking-widest">
          Hire'in Insights
        </span>
      </div>
    </div>
  );
}

/* ─── Article Body ──────────────────────────────────────────────────────── */
function ArticleBody() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        In the past eighteen months, Hire'in Solutions has partnered with 47 hospital systems and integrated delivery networks across the United States. In every engagement, a variation of the same conversation unfolds: senior HR leadership presents data showing 90-day retention rates are holding steady, while department heads describe an unrecognized talent exodus occurring silently at the 14-to-18-month mark.
      </p>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        The gap is not in effort. The investments these organizations are making — sign-on bonuses that have tripled since 2021, expanded EAP programs, wellness stipends, flexible scheduling pilots — are real and often substantial. The gap is structural: healthcare organizations continue to measure retention as a binary outcome (stayed or left) when clinicians experience loyalty as a continuous, dynamically adjusting signal.
      </p>

      <h2
        style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }}
        className="text-3xl font-bold mt-10 mb-4"
      >
        The Misalignment That Metrics Don't Capture
      </h2>

      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        Standard retention analytics track tenure, voluntary turnover rate, and time-to-fill. These are lagging indicators — they tell you a clinician has already decided to leave, often weeks or months after the decision crystallized. What they fail to surface is the progressive erosion of organizational commitment that precedes departure: the nurse who stops volunteering for committee work, the physician who declines to mentor residents, the therapist who quietly reduces their weekend availability.
      </p>
      <p className="text-gray-700 leading-[1.85] text-lg mb-8">
        Each of these behavioral shifts is a data point. Aggregated across a department, they constitute a leading indicator that is both measurable and addressable — if you know to look for it.
      </p>
    </div>
  );
}

/* ─── Hire'in Perspective callout ───────────────────────────────────────── */
function HirinPerspective() {
  return (
    <div
      className="rounded-xl p-7 my-8"
      style={{ background: ORANGE + "09", borderLeft: `3px solid ${ORANGE}` }}
    >
      <div className="flex items-start gap-4">
        <div style={{ background: ORANGE }} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-[10px] font-black">H</span>
        </div>
        <div>
          <p style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }} className="text-[10px] font-bold uppercase tracking-widest mb-2">
            The Hire'in Perspective
          </p>
          <p
            style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }}
            className="text-xl font-semibold leading-snug mb-2.5"
          >
            Data-Driven Talent Intelligence Changes the Equation
          </p>
          <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-gray-600 text-base leading-relaxed">
            Organizations that implement longitudinal engagement scoring — tracking behavioral micro-signals monthly rather than through annual surveys — identify at-risk talent 4.2× earlier. This window is the difference between a retention conversation and an exit conversation.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Key Takeaways ─────────────────────────────────────────────────────── */
function KeyTakeaways() {
  const points = [
    "Retention is a continuous signal, not a binary event — track behavioral micro-shifts monthly.",
    "The 14-to-18-month inflection point is consistently underserved by onboarding programs designed to end at 90 days.",
    "Clinicians report that 'being heard on scheduling' matters more to long-term commitment than compensation above market median.",
  ];
  return (
    <div className="rounded-2xl border border-gray-100 p-7 my-8 bg-gray-50/50">
      <p
        style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }}
        className="text-[10px] font-bold uppercase tracking-widest mb-5 flex items-center gap-2"
      >
        <span style={{ background: NAVY }} className="w-3 h-0.5 rounded-full inline-block" />
        Key Takeaways
      </p>
      <ul className="space-y-4">
        {points.map((pt, i) => (
          <li key={i} className="flex items-start gap-4">
            <span
              style={{ background: NAVY, color: "white", minWidth: 26, minHeight: 26, fontFamily: "'Inter', sans-serif" }}
              className="rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
            >
              {i + 1}
            </span>
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-gray-700 text-base leading-relaxed">{pt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Second body section ───────────────────────────────────────────────── */
function ArticleBodyPart2() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }}>
      <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-3xl font-bold mt-10 mb-4">
        The Three Structural Shifts
      </h2>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        Based on our analysis across 47 health system engagements, three organizational design shifts consistently separate systems that retain top clinical talent from those that don't: a move from annual to continuous listening infrastructure, the elevation of frontline managers as retention stakeholders with dedicated analytics, and the formalization of internal mobility pathways for clinicians seeking scope expansion without leaving the organization.
      </p>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        None of these are inexpensive. But each, when implemented with fidelity, returns a measurable reduction in replacement costs that exceeds the investment within 18 months. Given that replacing a single experienced ICU nurse now costs between $85,000 and $120,000 in direct and indirect costs, the business case is not difficult to construct.
      </p>
    </div>
  );
}

/* ─── CEO Author Card (enterprise quality) ──────────────────────────────── */
function CEOAuthorCard() {
  const expertise = ["Healthcare Workforce Strategy", "Talent Acquisition", "Organizational Design", "Executive Search"];
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: `linear-gradient(140deg, ${NAVY_DARK} 0%, ${NAVY} 55%, ${NAVY_LIGHT} 100%)` }}
    >
      <div className="p-9 relative">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.06]"
          style={{ background: ORANGE, transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-44 h-44 rounded-full opacity-[0.05]"
          style={{ background: "white", transform: "translate(-20%, 30%)" }} />

        <div className="relative flex items-start gap-7">
          {/* Avatar */}
          <div className="flex-shrink-0 relative" style={{ width: 88, height: 88 }}>
            <div
              className="w-full h-full rounded-full flex items-center justify-center shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_LIGHT} 100%)`,
                border: "3px solid rgba(255,255,255,0.2)",
              }}
            >
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif" }} className="text-white font-bold text-2xl">KS</span>
            </div>
            {/* LinkedIn badge */}
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md"
              style={{ background: "#0077B5", border: "2px solid rgba(255,255,255,0.85)" }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ background: ORANGE + "28", color: ORANGE, border: `1px solid ${ORANGE}35`, fontFamily: "'Inter', sans-serif" }}
              >
                Founder & CEO
              </span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Inter', sans-serif" }} className="text-xs">· 32 articles</span>
            </div>
            <h3
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white" }}
              className="text-2xl font-bold mb-0.5"
            >
              Kavita Sharma
            </h3>
            <p style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }} className="text-sm font-semibold mb-4">
              Chief Executive Officer · Hire'in Solutions
            </p>
            <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/70 text-sm leading-relaxed mb-5 max-w-xl">
              Kavita founded Hire'in Solutions after nearly two decades building workforce strategy practices at two Big Four consulting firms and a tenure as VP of Talent Acquisition at a 28,000-employee integrated health system. Advisor to C-suite and Board stakeholders across 120+ organizations. Featured in HBR, SHRM Executive Network, and the Advisory Board Workforce Report. MBA, Wharton · Certified Diversity Executive (CDE).
            </p>
            {/* Expertise chips */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {expertise.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.13)", fontFamily: "'Inter', sans-serif" }}
                >
                  {tag}
                </span>
              ))}
            </div>
            {/* CTAs */}
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                style={{ background: "white", color: NAVY, fontFamily: "'Inter', sans-serif" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                View Profile
              </button>
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.18)", fontFamily: "'Inter', sans-serif" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                Connect on LinkedIn
              </button>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative mt-7 pt-6 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-10">
            {[["12+", "Years of Practice"], ["120+", "Orgs Advised"], ["$2B+", "Workforce Impact"]].map(([val, label]) => (
              <div key={label}>
                <p style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }} className="text-xl font-bold">{val}</p>
                <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/45 text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontFamily: "'Inter', sans-serif" }} className="text-xs flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            kavitasharma-ceo
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Contributor Author Card ───────────────────────────────────────────── */
function ContributorAuthorCard() {
  const areas = ["Clinical Staffing", "Nursing Workforce", "Healthcare Analytics"];
  return (
    <div className="rounded-xl border border-gray-100 p-6 flex items-start gap-5 bg-white hover:shadow-sm transition-all mt-4">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #4B7BEC 0%, #3a5fc7 100%)" }}
      >
        <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white font-bold text-base">RM</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "#4B7BEC12", color: "#4B7BEC", border: "1px solid #4B7BEC20", fontFamily: "'Inter', sans-serif" }}
          >
            Contributing Analyst
          </span>
        </div>
        <h4 style={{ fontFamily: "'Inter', sans-serif" }} className="font-bold text-gray-900 text-base mb-0.5">Ravi Mehta</h4>
        <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-xs text-gray-400 mb-3">Senior Workforce Analyst · Healthcare Practice</p>
        <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm text-gray-600 leading-relaxed mb-3">
          Specialist in healthcare workforce analytics with a focus on nursing pipeline strategy and predictive attrition modeling. MS, Health Policy, Johns Hopkins.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {areas.map((a) => (
            <span key={a} style={{ fontFamily: "'Inter', sans-serif" }} className="px-2.5 py-0.5 rounded-full text-xs bg-gray-50 text-gray-500 border border-gray-100">{a}</span>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ fontFamily: "'Inter', sans-serif" }}>
          <button style={{ color: NAVY }} className="font-semibold hover:underline">View Profile</button>
          <span className="text-gray-200">|</span>
          <button className="text-[#0077B5] font-semibold hover:underline">LinkedIn</button>
          <span className="text-gray-200">|</span>
          <span className="text-gray-400">14 articles</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Related Articles ──────────────────────────────────────────────────── */
function RelatedArticles() {
  const articles = [
    { tag: "Talent Strategy", title: "The Hidden Cost of Mid-Level Manager Burnout in Integrated Health Systems", time: "6 min", author: "Kavita Sharma", color: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` },
    { tag: "Technology", title: "AI-Augmented Screening: What 18 Months of Data Actually Shows", time: "11 min", author: "Ravi Mehta", color: "linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)" },
    { tag: "Engineering", title: "STEM Talent in Healthcare Infrastructure: A Pipeline in Freefall", time: "9 min", author: "Priya Nair", color: "linear-gradient(135deg, #5e35b1 0%, #7c4dff 100%)" },
  ];
  return (
    <section className="mt-12 mb-8 pt-8 border-t border-gray-100">
      <p style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-2xl font-bold mb-6">
        Continue Reading
      </p>
      <div className="grid grid-cols-3 gap-4">
        {articles.map((a, i) => (
          <div key={i} className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group">
            <div className="h-28 relative" style={{ background: a.color }}>
              <div className="absolute bottom-3 left-3">
                <span style={{ fontFamily: "'Inter', sans-serif" }} className="px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-black/25">
                  {a.tag}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h4 style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-700 transition-colors line-clamp-3">
                {a.title}
              </h4>
              <div className="flex items-center justify-between text-xs text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
                <span>{a.author}</span>
                <span>{a.time} read</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────────── */
function SiteFooter() {
  return (
    <footer style={{ background: NAVY_DARK }} className="mt-0 py-8 px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div>
          <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white font-bold text-sm">
            Hire<span style={{ color: ORANGE }}>'in</span> Solutions
          </span>
          <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/35 text-xs mt-1">
            AI-Powered Staffing & Talent Acquisition
          </p>
        </div>
        <div className="flex gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
          {["Privacy", "Terms", "Contact", "Subscribe"].map((l) => (
            <span key={l} className="text-white/40 text-xs hover:text-white cursor-pointer transition-colors">{l}</span>
          ))}
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/25 text-xs">© 2025 Hire'in Solutions</p>
      </div>
    </footer>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export function ArticlePreview() {
  return (
    <div className="min-h-screen bg-white">
      {/* Non-blocking Google Fonts */}
      <link
        rel="stylesheet"
        media="print"
        onLoad={(e: any) => { e.target.media = "all"; }}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap"
      />

      {/* 1 — Global app header */}
      <AppHeader />

      {/* 2 — Industry filter strip */}
      <IndustryFilterStrip />

      {/* 3 — Article content area */}
      <div className="max-w-4xl mx-auto px-8">
        <ArticleHeader />
        <HeroImage />
        <ArticleBody />
        <HirinPerspective />
        <ArticleBodyPart2 />
        <KeyTakeaways />

        {/* Author section */}
        <div className="mt-12 mb-2">
          <div className="flex items-center gap-4 mb-7">
            <div style={{ background: "#e5e7eb" }} className="h-px flex-1" />
            <p style={{ color: "#9ca3af", fontFamily: "'Inter', sans-serif" }} className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
              About the Authors
            </p>
            <div style={{ background: "#e5e7eb" }} className="h-px flex-1" />
          </div>
          <CEOAuthorCard />
          <ContributorAuthorCard />
        </div>

        <RelatedArticles />
      </div>

      <SiteFooter />
    </div>
  );
}
