import { useState } from "react";

const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const NAVY_LIGHT = "#2a4d8f";
const ORANGE = "#F47C20";

/* ─── Logo + Header ────────────────────────────────────────────────────── */
function AppHeader() {
  const nav = [
    { label: "Home" }, { label: "About" },
    { label: "Services", dropdown: true }, { label: "Capability Decks", dropdown: true },
    { label: "Contracts" }, { label: "Jobs" }, { label: "Insights", active: true }, { label: "Contact" },
  ];
  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <img src={`${import.meta.env.BASE_URL}hirein-logo.svg`} alt="Hire'in Solutions" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, display: "block" }} />
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", color: NAVY, fontWeight: 700, fontSize: 17, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              Hire<span style={{ color: ORANGE }}>'in</span> Solutions
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", color: "#9ca3af", fontSize: 9, letterSpacing: "0.06em", lineHeight: 1, marginTop: 2, textTransform: "uppercase" }}>
              A Rayomind Company&nbsp;|&nbsp;Est. 2014
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-5 flex-1">
          {nav.map((item) => (
            <span key={item.label} className="flex items-center gap-0.5 cursor-pointer whitespace-nowrap transition-colors"
              style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: item.active ? 600 : 500, color: item.active ? NAVY : "#4b5563", borderBottom: item.active ? `2px solid ${ORANGE}` : "2px solid transparent", paddingBottom: 2 }}>
              {item.label}
              {item.dropdown && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}><polyline points="6 9 12 15 18 9" /></svg>}
            </span>
          ))}
        </nav>
        <button className="flex items-center gap-2 flex-shrink-0 hover:brightness-110 transition-all"
          style={{ background: ORANGE, color: "white", fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>
          Get a Quote
        </button>
      </div>
    </header>
  );
}

const TOPIC_FILTERS = [
  { label: "All Insights", active: false }, { label: "Healthcare", active: true },
  { label: "Technology", active: false }, { label: "Engineering", active: false },
  { label: "Professional Services", active: false }, { label: "Talent Strategy", active: false }, { label: "Leadership", active: false },
];

/* ─── Data ───────────────────────────────────────────────────────────────── */
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Executive Insight": { bg: ORANGE + "14", text: ORANGE, border: ORANGE + "30" },
  "Analysis": { bg: "#3b82f614", text: "#3b82f6", border: "#3b82f630" },
  "Field Report": { bg: "#10b98114", text: "#059669", border: "#10b98130" },
  "Case Study": { bg: "#8b5cf614", text: "#7c3aed", border: "#8b5cf630" },
  "Market Brief": { bg: "#6b728014", text: "#4b5563", border: "#6b728030" },
  "Opinion": { bg: "#ec489914", text: "#db2777", border: "#ec489930" },
};

const ARTICLES = [
  { id: 1, type: "Executive Insight", title: "Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding", deck: "Burnout alone doesn't explain the exodus. A deeper structural misalignment is quietly accelerating a workforce crisis.", author: { name: "Kavita Sharma", role: "Founder & CEO", initials: "KS", color: NAVY }, date: "Jul 11, 2025", readMin: 8, impressions: 4820, gradient: `linear-gradient(140deg,${NAVY_DARK} 0%,${NAVY} 55%,${NAVY_LIGHT} 100%)` },
  { id: 2, type: "Analysis", title: "AI-Augmented Screening: What 18 Months of Data Actually Shows About Quality-of-Hire", deck: "Firms that adopted structured AI screening saw 31% improvement in 90-day retention.", author: { name: "Ravi Mehta", role: "Senior Analyst", initials: "RM", color: "#4B7BEC" }, date: "Jul 8, 2025", readMin: 11, impressions: 5670, gradient: "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)" },
  { id: 3, type: "Field Report", title: "Inside Three Rural Health Systems That Cracked the Nursing Retention Puzzle", deck: "A 14-month field study across Missouri, Montana, and Kentucky reveals counterintuitive findings.", author: { name: "Priya Nair", role: "Research Lead", initials: "PN", color: "#059669" }, date: "Jul 5, 2025", readMin: 9, impressions: 2840, gradient: "linear-gradient(135deg,#065f46 0%,#10b981 100%)" },
  { id: 4, type: "Case Study", title: "From 42% to 78%: How Memorial Health Rebuilt Its Travel Nurse Pipeline in 11 Months", deck: "A strategic partnership redesign and internal mobility program produced surprising results.", author: { name: "James Okafor", role: "Client Partner", initials: "JO", color: "#7c3aed" }, date: "Jun 30, 2025", readMin: 7, impressions: 2190, gradient: "linear-gradient(135deg,#4c1d95 0%,#8b5cf6 100%)" },
  { id: 5, type: "Market Brief", title: "Q2 2025 Healthcare Staffing Index: Demand Surges in Radiology and Respiratory Therapy", deck: "RT vacancies up 47% YoY with no supply-side relief in sight.", author: { name: "Kavita Sharma", role: "Founder & CEO", initials: "KS", color: NAVY }, date: "Jun 24, 2025", readMin: 4, impressions: 3210, gradient: "linear-gradient(135deg,#374151 0%,#6b7280 100%)" },
  { id: 6, type: "Opinion", title: "The 'Culture Fit' Trap Is Costing Healthcare Organizations Their Most Effective Clinicians", deck: "When 'culture fit' becomes a proxy for familiarity, it systematically filters out experienced candidates.", author: { name: "Aisha Patel", role: "Diversity Strategy", initials: "AP", color: "#db2777" }, date: "Jun 19, 2025", readMin: 6, impressions: 1980, gradient: "linear-gradient(135deg,#831843 0%,#ec4899 100%)" },
  { id: 7, type: "Analysis", title: "Geographic Salary Arbitrage in Clinical Hiring: Where It Works and Where It Backfires", deck: "Examining 3,400 placements across metro, suburban, and rural markets over 24 months.", author: { name: "Ravi Mehta", role: "Senior Analyst", initials: "RM", color: "#4B7BEC" }, date: "Jun 14, 2025", readMin: 12, impressions: 1540, gradient: "linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)" },
];

/* ─── Carousel data ──────────────────────────────────────────────────────── */
const CAROUSEL_CARDS = [
  {
    badge: "📌  Featured",
    badgeBg: "rgba(255,255,255,0.18)",
    label: "EDITOR'S PICK",
    article: ARTICLES[0],
  },
  {
    badge: "🔥  Trending",
    badgeBg: `${ORANGE}33`,
    label: "MOST READ THIS WEEK",
    article: ARTICLES[1],
  },
  {
    badge: "⭐  Latest",
    badgeBg: "rgba(255,255,255,0.13)",
    label: "JUST PUBLISHED",
    article: ARTICLES[2],
  },
];

/* ─── Featured Carousel ─────────────────────────────────────────────────── */
function FeaturedCarousel() {
  const [active, setActive] = useState(0);
  const prev = () => setActive((i) => (i - 1 + CAROUSEL_CARDS.length) % CAROUSEL_CARDS.length);
  const next = () => setActive((i) => (i + 1) % CAROUSEL_CARDS.length);
  const card = CAROUSEL_CARDS[active];
  const art = card.article;

  return (
    <div className="mb-10">
      {/* Section label row */}
      <div className="flex items-center gap-4 mb-5">
        <div style={{ background: ORANGE }} className="w-5 h-0.5 rounded-full flex-shrink-0" />
        <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-[11px] font-bold uppercase tracking-[0.16em] whitespace-nowrap">
          Top Picks
        </p>
        <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {CAROUSEL_CARDS.map((_, i) => (
            <button key={i} onClick={() => setActive(i)}
              style={{ width: i === active ? 18 : 6, height: 6, borderRadius: 3, background: i === active ? NAVY : "#d1d5db", transition: "all 0.2s", border: "none", cursor: "pointer", padding: 0 }} />
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all" style={{ minHeight: 260 }}>
        <div className="flex h-full" style={{ minHeight: 260 }}>

          {/* Left — gradient image panel */}
          <div className="relative flex-shrink-0 flex flex-col justify-between p-7"
            style={{ width: 320, background: art.gradient }}>
            <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

            {/* Badge + label */}
            <div className="relative flex flex-col gap-2">
              <span style={{ fontFamily: "'Inter',sans-serif", background: card.badgeBg, backdropFilter: "blur(6px)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
                className="self-start px-3 py-1 rounded-full text-[11px] font-bold">
                {card.badge}
              </span>
              <span style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em" }}
                className="text-[9px] font-bold uppercase">
                {card.label}
              </span>
            </div>

            {/* Bottom author mini */}
            <div className="relative flex items-center gap-2.5 mt-auto pt-5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ background: art.author.color, border: "2px solid rgba(255,255,255,0.3)" }}>
                <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-white text-[10px] font-bold">{art.author.initials}</span>
              </div>
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", color: "white" }} className="text-xs font-semibold leading-tight">{art.author.name}</p>
                <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.55)" }} className="text-[10px] leading-tight">{art.author.role}</p>
              </div>
            </div>
          </div>

          {/* Right — content panel */}
          <div className="flex-1 bg-white flex flex-col justify-between p-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TypeBadge type={art.type} />
                <span style={{ color: "#d1d5db" }}>·</span>
                <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-xs text-gray-400">{art.date}</span>
                <span style={{ color: "#d1d5db" }}>·</span>
                <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-xs text-gray-400 flex items-center gap-1">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {art.readMin} min read
                </span>
              </div>
              <h2 style={{ color: NAVY, fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1.2 }}
                className="text-2xl font-bold mb-3 leading-snug">{art.title}</h2>
              <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-gray-500 text-sm leading-relaxed line-clamp-3">{art.deck}</p>
            </div>

            <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-5">
              <div className="flex items-center gap-1.5 text-sm text-gray-400" style={{ fontFamily: "'Inter',sans-serif" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                {art.impressions.toLocaleString()} views
              </div>
              <div className="flex items-center gap-2.5">
                {/* Prev / Next */}
                <button onClick={prev}
                  style={{ border: "1.5px solid #e5e7eb", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "white", cursor: "pointer", color: "#6b7280" }}
                  className="hover:border-gray-300 hover:text-gray-900 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button onClick={next}
                  style={{ border: "1.5px solid #e5e7eb", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "white", cursor: "pointer", color: "#6b7280" }}
                  className="hover:border-gray-300 hover:text-gray-900 transition-all">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                <button style={{ background: NAVY, fontFamily: "'Inter',sans-serif" }}
                  className="px-5 py-2 rounded-full text-white text-sm font-semibold hover:brightness-110 transition-all">
                  Read article →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail strip — quick-jump */}
      <div className="flex gap-3 mt-3">
        {CAROUSEL_CARDS.map((c, i) => (
          <button key={i} onClick={() => setActive(i)}
            className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left"
            style={{ border: i === active ? `1.5px solid ${NAVY}` : "1.5px solid #e5e7eb", background: i === active ? NAVY + "06" : "white", cursor: "pointer" }}>
            <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: c.article.gradient }}>
              <span style={{ fontFamily: "'Inter',sans-serif", color: "white", fontSize: 8, fontWeight: 800 }}>{i + 1}</span>
            </div>
            <div className="min-w-0">
              <p style={{ fontFamily: "'Inter',sans-serif", color: i === active ? NAVY : "#6b7280", fontSize: 11, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                {c.article.title}
              </p>
              <p style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af", fontSize: 9, marginTop: 1 }}>{c.badge}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared components ──────────────────────────────────────────────────── */
function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS["Market Brief"];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, fontFamily: "'Inter',sans-serif" }}
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{type}</span>
  );
}

function PopularityBar({ value }: { value: number }) {
  const MAX = 6000;
  const pct = Math.round((value / MAX) * 100);
  const label = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 60 ? ORANGE : pct > 35 ? NAVY_LIGHT : "#9ca3af" }} />
      </div>
      <span style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af" }} className="text-xs tabular-nums w-8 text-right">{label}</span>
    </div>
  );
}

/* ─── List header ────────────────────────────────────────────────────────── */
function ListHeader() {
  return (
    <div className="grid items-center gap-4 px-4 py-2 mb-1 rounded-lg" style={{ gridTemplateColumns: "32px 1fr 150px 110px 70px 100px", background: "#f9fafb" }}>
      {["#", "Article", "Author", "Type", "Read", "Views"].map(h => (
        <span key={h} style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af" }} className="text-[10px] font-bold uppercase tracking-wider">{h}</span>
      ))}
    </div>
  );
}

/* ─── List row — author name wraps (no truncate) ────────────────────────── */
function ArticleRow({ article, rank }: { article: typeof ARTICLES[0]; rank: number }) {
  const isHot = article.impressions >= 4500;
  return (
    <div className="grid items-start gap-4 px-4 py-4 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50/70 transition-all cursor-pointer group"
      style={{ gridTemplateColumns: "32px 1fr 150px 110px 70px 100px" }}>

      <span style={{ fontFamily: "'Inter',sans-serif", color: rank <= 2 ? ORANGE : "#d1d5db" }}
        className="text-sm font-bold tabular-nums pt-0.5">{String(rank).padStart(2, "0")}</span>

      <div className="min-w-0">
        <h3 style={{ color: NAVY, fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1.25 }}
          className="text-sm font-bold group-hover:text-blue-700 transition-colors line-clamp-2 mb-1">{article.title}</h3>
        <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-xs text-gray-400 line-clamp-1 leading-snug">{article.deck}</p>
      </div>

      {/* Author — wraps, no truncate */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5" style={{ background: article.author.color }}>
          <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-white text-[9px] font-bold">{article.author.initials}</span>
        </div>
        <div className="min-w-0">
          <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }}
            className="text-xs font-semibold leading-tight break-words">{article.author.name}</p>
          <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-[10px] text-gray-400 leading-tight mt-0.5">{article.date}</p>
        </div>
      </div>

      <div className="pt-0.5"><TypeBadge type={article.type} /></div>

      <div className="flex items-center gap-1 text-xs text-gray-500 pt-0.5" style={{ fontFamily: "'Inter',sans-serif" }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
        {article.readMin} min
      </div>

      <div className="flex flex-col gap-1 pt-0.5">
        <PopularityBar value={article.impressions} />
        {isHot && <span style={{ color: ORANGE, fontFamily: "'Inter',sans-serif" }} className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
          <span>🔥</span>Trending
        </span>}
      </div>
    </div>
  );
}

/* ─── Sidebar ────────────────────────────────────────────────────────────── */
function Sidebar() {
  const topics = ["Nursing retention", "AI screening", "Rural healthcare", "Executive search", "Salary benchmarks", "DEI hiring"];
  const topAuthors = [
    { name: "Kavita Sharma", role: "CEO & Founder", initials: "KS", color: NAVY, articles: 32 },
    { name: "Ravi Mehta", role: "Senior Analyst", initials: "RM", color: "#4B7BEC", articles: 14 },
    { name: "Priya Nair", role: "Research Lead", initials: "PN", color: "#059669", articles: 9 },
  ];
  return (
    <aside className="w-64 flex-shrink-0 space-y-6 pl-8 border-l border-gray-100">
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE }} className="w-3 h-0.5 rounded-full inline-block" />Trending Topics
        </p>
        <div className="flex flex-wrap gap-1.5">
          {topics.map(t => (
            <button key={t} style={{ fontFamily: "'Inter',sans-serif" }}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100 hover:border-gray-300 transition-all">{t}</button>
          ))}
        </div>
      </div>
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE }} className="w-3 h-0.5 rounded-full inline-block" />Top Authors
        </p>
        <div className="space-y-3">
          {topAuthors.map(a => (
            <div key={a.name} className="flex items-center gap-3 cursor-pointer group">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: a.color }}>
                <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-white text-xs font-bold">{a.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-xs font-semibold group-hover:underline truncate">{a.name}</p>
                <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-[10px] text-gray-400">{a.articles} articles</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-5" style={{ background: `linear-gradient(135deg,${NAVY_DARK} 0%,${NAVY} 100%)` }}>
        <p style={{ fontFamily: "'Playfair Display',Georgia,serif" }} className="text-white font-bold text-base mb-1 leading-tight">Get insights in your inbox</p>
        <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-white/60 text-xs mb-4 leading-relaxed">Weekly digest of our best healthcare and talent strategy content.</p>
        <input type="email" placeholder="Your work email" className="w-full px-3 py-2 rounded-lg text-xs mb-2.5 outline-none border-0"
          style={{ fontFamily: "'Inter',sans-serif", background: "rgba(255,255,255,0.12)", color: "white" }} />
        <button style={{ background: ORANGE, fontFamily: "'Inter',sans-serif" }} className="w-full py-2 rounded-lg text-white text-xs font-bold hover:brightness-110 transition-all">Subscribe Free →</button>
      </div>
      <div>
        <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <span style={{ background: ORANGE }} className="w-3 h-0.5 rounded-full inline-block" />Article Types
        </p>
        <div className="space-y-2">
          {Object.entries(TYPE_COLORS).map(([type, c]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.text }} />
              <span style={{ fontFamily: "'Inter',sans-serif", color: "#6b7280" }} className="text-[11px]">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ─── Standard Site Footer ───────────────────────────────────────────────── */
function SiteFooter() {
  const footerNav = {
    Solutions: ["Healthcare Staffing", "IT Staffing", "Engineering Talent", "Professional Services", "Executive Search"],
    Company: ["About Us", "Insights", "Careers", "Contact", "Partners"],
    Legal: ["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"],
  };
  const socials = [
    { label: "LinkedIn", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
    { label: "Twitter", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.859L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
    { label: "Facebook", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg> },
  ];
  return (
    <footer style={{ background: NAVY_DARK, borderTop: `3px solid ${ORANGE}` }}>
      <div className="max-w-7xl mx-auto px-8 pt-14 pb-10">
        <div className="grid grid-cols-5 gap-10">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={`${import.meta.env.BASE_URL}hirein-logo.svg`} alt="Hire'in Solutions" style={{ width: 38, height: 38, borderRadius: 8, flexShrink: 0, display: "block" }} />
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", color: "white", fontWeight: 700, fontSize: 16 }}>Hire<span style={{ color: ORANGE }}>'in</span> Solutions</p>
                <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.07em", textTransform: "uppercase", marginTop: 1 }}>A Rayomind Company | Est. 2014</p>
              </div>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7, marginBottom: 18, maxWidth: 280 }}>
              AI-powered staffing and talent acquisition for Healthcare, IT, Engineering, and Professional Services organizations.
            </p>
            <div className="flex items-center gap-2">
              {socials.map(s => (
                <button key={s.label} title={s.label}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:brightness-110"
                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  {s.icon}
                </button>
              ))}
            </div>
          </div>
          {Object.entries(footerNav).map(([section, links]) => (
            <div key={section}>
              <p style={{ fontFamily: "'Inter',sans-serif", color: "white", fontWeight: 700, fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>{section}</p>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.45)", fontSize: 13, textDecoration: "none" }}
                      className="hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
            © 2025 Hire'in Solutions, a Rayomind Company. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service", "Cookie Settings"].map(l => (
              <a key={l} href="#" style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.3)", fontSize: 12, textDecoration: "none" }}
                className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export function InsightsListView() {
  return (
    <div className="bg-white flex flex-col" style={{ minHeight: "100vh" }}>
      <link rel="stylesheet" media="print" onLoad={(e: any) => { e.target.media = "all"; }}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Inter:wght@300;400;500;600;700&display=swap" />

      <AppHeader />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-8 pt-10 pb-16">

          {/* Page title + inline topic filters — single content block, no second header */}
          <div className="mb-8">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h1 style={{ color: NAVY, fontFamily: "'Playfair Display',Georgia,serif" }} className="text-3xl font-bold leading-tight">Insights</h1>
                <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-sm text-gray-400 mt-1">{ARTICLES.length} articles</p>
              </div>
            </div>
            {/* Filter chips — inline, part of content, not a header */}
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af", fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginRight: 4, flexShrink: 0 }}>Topic</span>
              {TOPIC_FILTERS.map((f) => (
                <button key={f.label}
                  style={{
                    fontFamily: "'Inter',sans-serif",
                    fontSize: 12,
                    fontWeight: f.active ? 600 : 500,
                    color: f.active ? NAVY : "#6b7280",
                    background: f.active ? NAVY + "0d" : "transparent",
                    border: f.active ? `1.5px solid ${NAVY}40` : "1.5px solid #e5e7eb",
                    borderRadius: 20,
                    padding: "4px 12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}>
                  {f.active && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Featured carousel */}
          <FeaturedCarousel />

          {/* Divider */}
          <div className="flex items-center gap-4 mb-5">
            <div style={{ background: ORANGE }} className="w-5 h-0.5 rounded-full flex-shrink-0" />
            <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-[11px] font-bold uppercase tracking-[0.16em] whitespace-nowrap">All Articles</p>
            <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
          </div>

          {/* Main content + sidebar */}
          <div className="flex gap-0">
            <div className="flex-1 min-w-0 pr-8">
              <ListHeader />
              <div className="divide-y divide-gray-50">
                {ARTICLES.map((a, idx) => <ArticleRow key={a.id} article={a} rank={idx + 1} />)}
              </div>
              <div className="mt-8 flex items-center justify-center">
                <button style={{ color: NAVY, fontFamily: "'Inter',sans-serif", border: `1.5px solid ${NAVY}` }}
                  className="px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2">
                  Load more articles <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>
            </div>
            <Sidebar />
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
