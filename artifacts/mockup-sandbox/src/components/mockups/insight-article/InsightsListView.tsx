const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const NAVY_LIGHT = "#2a4d8f";
const ORANGE = "#F47C20";
const ORANGE_LIGHT = "#F96D3E";

/* ─── Shared: App Header ─────────────────────────────────────────────────── */
function AppHeader() {
  const nav = ["Solutions", "Industries", "Insights", "About", "Careers"];
  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div style={{ background: NAVY }} className="w-7 h-7 rounded-md flex items-center justify-center">
            <span className="text-white font-black text-sm leading-none">H</span>
          </div>
          <span style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="font-bold text-base tracking-tight">
            Hire<span style={{ color: ORANGE }}>'in</span>{" "}
            <span className="font-light">Solutions</span>
          </span>
        </div>
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
              className="text-sm font-medium cursor-pointer hover:text-gray-900 transition-colors"
            >
              {item}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-gray-700 transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button style={{ background: NAVY, fontFamily: "'Inter', sans-serif" }} className="px-4 py-1.5 rounded-full text-white text-xs font-semibold tracking-wide hover:brightness-110 transition-all">
            Subscribe
          </button>
        </div>
      </div>
    </header>
  );
}

/* ─── Shared: Industry Filter Strip ─────────────────────────────────────── */
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
        <div className="flex items-center gap-1 py-2.5">
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
            <span style={{ color: "#9ca3af", fontFamily: "'Inter', sans-serif" }} className="text-xs flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
              Filter
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Article data ───────────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Executive Insight": { bg: ORANGE + "14", text: ORANGE, border: ORANGE + "30" },
  "Analysis":          { bg: "#3b82f614", text: "#3b82f6", border: "#3b82f630" },
  "Field Report":      { bg: "#10b98114", text: "#059669", border: "#10b98130" },
  "Case Study":        { bg: "#8b5cf614", text: "#7c3aed", border: "#8b5cf630" },
  "Market Brief":      { bg: "#6b728014", text: "#4b5563", border: "#6b728030" },
  "Opinion":           { bg: "#ec489914", text: "#db2777", border: "#ec489930" },
};

const ARTICLES = [
  {
    id: 1,
    type: "Executive Insight",
    title: "Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding",
    deck: "Burnout alone doesn't explain the exodus. A deeper structural misalignment is quietly accelerating a workforce crisis that conventional HR metrics consistently miss.",
    author: { name: "Kavita Sharma", role: "Founder & CEO", initials: "KS", color: NAVY },
    date: "Jul 11, 2025",
    readMin: 8,
    impressions: 4820,
    featured: true,
    accentColor: `linear-gradient(140deg, ${NAVY_DARK} 0%, ${NAVY} 55%, ${NAVY_LIGHT} 100%)`,
  },
  {
    id: 2,
    type: "Analysis",
    title: "AI-Augmented Screening: What 18 Months of Data Actually Shows About Quality-of-Hire",
    deck: "Firms that adopted structured AI screening saw 31% improvement in 90-day retention — but only when paired with calibrated human review at the shortlist stage.",
    author: { name: "Ravi Mehta", role: "Senior Analyst", initials: "RM", color: "#4B7BEC" },
    date: "Jul 8, 2025",
    readMin: 11,
    impressions: 3210,
    featured: false,
    accentColor: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
  },
  {
    id: 3,
    type: "Field Report",
    title: "Inside Three Rural Health Systems That Cracked the Nursing Retention Puzzle",
    deck: "A 14-month field study across Missouri, Montana, and Kentucky reveals counterintuitive findings about what drives long-term commitment in underserved markets.",
    author: { name: "Priya Nair", role: "Research Lead", initials: "PN", color: "#059669" },
    date: "Jul 5, 2025",
    readMin: 9,
    impressions: 2840,
    featured: false,
    accentColor: "linear-gradient(135deg, #065f46 0%, #10b981 100%)",
  },
  {
    id: 4,
    type: "Case Study",
    title: "From 42% to 78%: How Memorial Health Rebuilt Its Travel Nurse Pipeline in 11 Months",
    deck: "A strategic partnership redesign, a dedicated internal mobility program, and one crucial policy change produced results that surprised even the leadership team.",
    author: { name: "James Okafor", role: "Client Partner", initials: "JO", color: "#7c3aed" },
    date: "Jun 30, 2025",
    readMin: 7,
    impressions: 2190,
    featured: false,
    accentColor: "linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)",
  },
  {
    id: 5,
    type: "Market Brief",
    title: "Q2 2025 Healthcare Staffing Index: Demand Surges in Radiology and Respiratory Therapy",
    deck: "Hire'in's quarterly staffing demand index now tracks 38 clinical specialties. This quarter's standout: RT vacancies up 47% YoY with no supply-side relief in sight.",
    author: { name: "Kavita Sharma", role: "Founder & CEO", initials: "KS", color: NAVY },
    date: "Jun 24, 2025",
    readMin: 4,
    impressions: 5670,
    featured: false,
    accentColor: `linear-gradient(135deg, #374151 0%, #6b7280 100%)`,
  },
  {
    id: 6,
    type: "Opinion",
    title: "The 'Culture Fit' Trap Is Costing Healthcare Organizations Their Most Effective Clinicians",
    deck: "When 'culture fit' becomes a proxy for familiarity, it systematically filters out experienced candidates who would challenge — and improve — existing care delivery patterns.",
    author: { name: "Aisha Patel", role: "Diversity Strategy", initials: "AP", color: "#db2777" },
    date: "Jun 19, 2025",
    readMin: 6,
    impressions: 1980,
    featured: false,
    accentColor: "linear-gradient(135deg, #831843 0%, #ec4899 100%)",
  },
  {
    id: 7,
    type: "Analysis",
    title: "Geographic Salary Arbitrage in Clinical Hiring: Where It Works and Where It Backfires",
    deck: "Examining 3,400 placements across metro, suburban, and rural markets over 24 months to understand when competitive pay alone is sufficient — and when it isn't.",
    author: { name: "Ravi Mehta", role: "Senior Analyst", initials: "RM", color: "#4B7BEC" },
    date: "Jun 14, 2025",
    readMin: 12,
    impressions: 1540,
    featured: false,
    accentColor: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)",
  },
];

/* ─── Popularity bar ─────────────────────────────────────────────────────── */
const MAX_IMP = 6000;
function PopularityBar({ value }: { value: number }) {
  const pct = Math.round((value / MAX_IMP) * 100);
  const label = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 60 ? ORANGE : pct > 35 ? NAVY_LIGHT : "#9ca3af" }} />
      </div>
      <span style={{ fontFamily: "'Inter', sans-serif", color: "#9ca3af" }} className="text-xs tabular-nums w-8 text-right">{label}</span>
    </div>
  );
}

/* ─── TypeBadge ──────────────────────────────────────────────────────────── */
function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS["Market Brief"];
  return (
    <span
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontFamily: "'Inter', sans-serif" }}
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
    >
      {type}
    </span>
  );
}

/* ─── Featured Hero Card ─────────────────────────────────────────────────── */
function FeaturedCard({ article }: { article: typeof ARTICLES[0] }) {
  return (
    <div className="flex rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all cursor-pointer mb-8">
      {/* Visual */}
      <div className="w-80 flex-shrink-0 relative" style={{ background: article.accentColor, minHeight: 280 }}>
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <div style={{ background: ORANGE }} className="w-8 h-0.5 rounded-full mb-4" />
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.4 }} className="text-white text-xl font-semibold opacity-90">
            Featured
          </p>
          <div style={{ background: ORANGE }} className="w-5 h-0.5 rounded-full mt-4" />
        </div>
        <div className="absolute top-4 left-4">
          <span style={{ background: "rgba(0,0,0,0.3)", color: "white", fontFamily: "'Inter', sans-serif" }} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
            Pinned
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 flex flex-col justify-between bg-white">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TypeBadge type={article.type} />
            <span style={{ color: "#d1d5db" }}>·</span>
            <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-xs text-gray-400">{article.date}</span>
          </div>
          <h2
            style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.2 }}
            className="text-2xl font-bold mb-3"
          >
            {article.title}
          </h2>
          <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-gray-500 text-sm leading-relaxed line-clamp-3">
            {article.deck}
          </p>
        </div>

        <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: article.author.color }}
            >
              <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white text-xs font-bold">{article.author.initials}</span>
            </div>
            <div>
              <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-sm font-semibold leading-tight">{article.author.name}</p>
              <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-xs text-gray-400 leading-tight">{article.author.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {article.readMin} min read
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400" style={{ fontFamily: "'Inter', sans-serif" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {article.impressions.toLocaleString()}
            </div>
            <button
              style={{ background: NAVY, fontFamily: "'Inter', sans-serif" }}
              className="px-4 py-1.5 rounded-full text-white text-xs font-semibold hover:brightness-110 transition-all"
            >
              Read →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Column headers for the list ────────────────────────────────────────── */
function ListHeader() {
  return (
    <div
      className="grid items-center gap-4 px-4 py-2 mb-1 rounded-lg"
      style={{ gridTemplateColumns: "32px 1fr 140px 100px 80px 100px", background: "#f9fafb" }}
    >
      {["#", "Article", "Author", "Type", "Read", "Views"].map((h) => (
        <span
          key={h}
          style={{ fontFamily: "'Inter', sans-serif", color: "#9ca3af" }}
          className="text-[10px] font-bold uppercase tracking-wider"
        >
          {h}
        </span>
      ))}
    </div>
  );
}

/* ─── Article List Row ───────────────────────────────────────────────────── */
function ArticleRow({ article, rank }: { article: typeof ARTICLES[0]; rank: number }) {
  const isHot = article.impressions >= 4000;
  return (
    <div
      className="grid items-center gap-4 px-4 py-4 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50/70 transition-all cursor-pointer group"
      style={{ gridTemplateColumns: "32px 1fr 140px 100px 80px 100px" }}
    >
      {/* Rank */}
      <span
        style={{ fontFamily: "'Inter', sans-serif", color: rank <= 2 ? ORANGE : "#d1d5db" }}
        className="text-sm font-bold tabular-nums"
      >
        {String(rank).padStart(2, "0")}
      </span>

      {/* Title */}
      <div className="min-w-0">
        <h3
          style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.25 }}
          className="text-sm font-bold group-hover:text-blue-700 transition-colors line-clamp-2 mb-1"
        >
          {article.title}
        </h3>
        <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-xs text-gray-400 line-clamp-1 leading-snug">
          {article.deck}
        </p>
      </div>

      {/* Author */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: article.author.color }}
        >
          <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white text-[9px] font-bold">{article.author.initials}</span>
        </div>
        <div className="min-w-0">
          <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-xs font-semibold truncate leading-tight">{article.author.name}</p>
          <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-[10px] text-gray-400 truncate leading-tight">{article.date}</p>
        </div>
      </div>

      {/* Type */}
      <div>
        <TypeBadge type={article.type} />
      </div>

      {/* Read time */}
      <div className="flex items-center gap-1 text-xs text-gray-500" style={{ fontFamily: "'Inter', sans-serif" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        {article.readMin} min
      </div>

      {/* Impressions / popularity */}
      <div className="flex flex-col gap-1">
        <PopularityBar value={article.impressions} />
        {isHot && (
          <span style={{ color: ORANGE, fontFamily: "'Inter', sans-serif" }} className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
            <span>🔥</span> Trending
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Sidebar: Trending Topics ───────────────────────────────────────────── */
function Sidebar() {
  const topics = ["Nursing retention", "AI screening", "Rural healthcare", "Executive search", "Salary benchmarks", "DEI hiring"];
  const topAuthors = [
    { name: "Kavita Sharma", role: "CEO & Founder", initials: "KS", color: NAVY, articles: 32 },
    { name: "Ravi Mehta", role: "Senior Analyst", initials: "RM", color: "#4B7BEC", articles: 14 },
    { name: "Priya Nair", role: "Research Lead", initials: "PN", color: "#059669", articles: 9 },
  ];
  return (
    <aside className="w-64 flex-shrink-0 space-y-6 pl-8 border-l border-gray-100">
      {/* Trending topics */}
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE }} className="w-3 h-0.5 rounded-full inline-block" />
          Trending Topics
        </p>
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <button
              key={t}
              style={{ fontFamily: "'Inter', sans-serif" }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-300 hover:text-gray-800 transition-all"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Top authors */}
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE }} className="w-3 h-0.5 rounded-full inline-block" />
          Top Authors
        </p>
        <div className="space-y-3">
          {topAuthors.map((a) => (
            <div key={a.name} className="flex items-center gap-3 group cursor-pointer">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: a.color }}>
                <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white text-xs font-bold">{a.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-xs font-semibold group-hover:underline truncate">{a.name}</p>
                <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-[10px] text-gray-400">{a.articles} articles</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscribe CTA */}
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 100%)` }}>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif" }} className="text-white font-bold text-base mb-1 leading-tight">
          Get insights in your inbox
        </p>
        <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/60 text-xs mb-4 leading-relaxed">
          Weekly digest of our best healthcare and talent strategy content.
        </p>
        <input
          type="email"
          placeholder="Your work email"
          className="w-full px-3 py-2 rounded-lg text-xs mb-2.5 outline-none border-0"
          style={{ fontFamily: "'Inter', sans-serif", background: "rgba(255,255,255,0.12)", color: "white" }}
        />
        <button
          style={{ background: ORANGE, fontFamily: "'Inter', sans-serif" }}
          className="w-full py-2 rounded-lg text-white text-xs font-bold hover:brightness-110 transition-all"
        >
          Subscribe Free →
        </button>
      </div>

      {/* Article type legend */}
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter', sans-serif" }} className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE }} className="w-3 h-0.5 rounded-full inline-block" />
          Article Types
        </p>
        <div className="space-y-2">
          {Object.entries(TYPE_COLORS).map(([type, c]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.text }} />
              <span style={{ fontFamily: "'Inter', sans-serif", color: "#6b7280" }} className="text-[11px]">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ─── Section meta bar ───────────────────────────────────────────────────── */
function SectionMeta() {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-3xl font-bold leading-tight">
          Healthcare Insights
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-sm text-gray-400 mt-1">
          {ARTICLES.length} articles · sorted by relevance
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* Sort control */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs cursor-pointer hover:border-gray-300 transition-all"
          style={{ fontFamily: "'Inter', sans-serif", color: "#6b7280" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
          Relevance
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        {/* View toggle */}
        <div className="flex items-center rounded-full border border-gray-200 overflow-hidden">
          <button style={{ background: NAVY }} className="p-1.5 text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export function InsightsListView() {
  const [featured, ...rest] = ARTICLES;
  return (
    <div className="min-h-screen bg-white">
      <link
        rel="stylesheet"
        media="print"
        onLoad={(e: any) => { e.target.media = "all"; }}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap"
      />

      <AppHeader />
      <IndustryFilterStrip />

      <div className="max-w-7xl mx-auto px-8 pt-10 pb-16">
        <SectionMeta />

        {/* Featured hero */}
        <FeaturedCard article={featured} />

        {/* Main content + sidebar */}
        <div className="flex gap-0">
          {/* Article list */}
          <div className="flex-1 min-w-0 pr-8">
            <ListHeader />
            <div className="divide-y divide-gray-50">
              {rest.map((article, idx) => (
                <ArticleRow key={article.id} article={article} rank={idx + 2} />
              ))}
            </div>

            {/* Load more */}
            <div className="mt-8 flex items-center justify-center">
              <button
                style={{ color: NAVY, fontFamily: "'Inter', sans-serif", border: `1.5px solid ${NAVY}` }}
                className="px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-navy hover:text-white transition-all flex items-center gap-2 hover:brightness-110"
              >
                Load more articles
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <Sidebar />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ background: NAVY_DARK }} className="py-8 px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span style={{ fontFamily: "'Inter', sans-serif" }} className="text-white font-bold text-sm">
            Hire<span style={{ color: ORANGE }}>'in</span> Solutions
          </span>
          <div className="flex gap-6">
            {["Privacy", "Terms", "Contact", "Subscribe"].map((l) => (
              <span key={l} style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/40 text-xs hover:text-white cursor-pointer transition-colors">{l}</span>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif" }} className="text-white/25 text-xs">© 2025 Hire'in Solutions</p>
        </div>
      </footer>
    </div>
  );
}
