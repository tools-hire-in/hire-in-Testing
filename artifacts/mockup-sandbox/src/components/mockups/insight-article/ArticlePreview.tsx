import { useState } from "react";

const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const NAVY_LIGHT = "#2a4d8f";
const ORANGE = "#F47C20";
const ORANGE_LIGHT = "#F96D3E";

/* ─── Logo icon (reused across header, hero, footer) ─────────────────────── */
function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <div style={{ background: NAVY, borderRadius: Math.round(size * 0.2), width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" fill="white" opacity="0.9" />
        <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.5" />
        <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.5" />
        <rect x="14" y="14" width="7" height="7" rx="1" fill={ORANGE} opacity="0.9" />
      </svg>
    </div>
  );
}

/* ─── Share Popover ──────────────────────────────────────────────────────── */
function SharePopover({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const articleUrl = "https://hire-in.com/insights/healthcare-talent-retention";

  const shareLinks = [
    {
      label: "LinkedIn",
      color: "#0077B5",
      bg: "#0077B514",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`,
    },
    {
      label: "X / Twitter",
      color: "#000000",
      bg: "#00000010",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.859L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=Why+Healthcare+Systems+Are+Losing+Top+Clinical+Talent`,
    },
    {
      label: "Facebook",
      color: "#1877F2",
      bg: "#1877F214",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`,
    },
    {
      label: "WhatsApp",
      color: "#25D366",
      bg: "#25D36614",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      href: `https://wa.me/?text=${encodeURIComponent("Worth reading: " + articleUrl)}`,
    },
  ];

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
      {/* Panel */}
      <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 100, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.13)", width: 260, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid #f3f4f6" }}>
          <p style={{ fontFamily: "'Inter',sans-serif", color: NAVY, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Share this article</p>
        </div>
        {/* Social links */}
        <div style={{ padding: "8px 8px 6px" }}>
          {shareLinks.map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, textDecoration: "none", color: s.color, transition: "background 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = s.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {s.icon}
              <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600 }}>{s.label}</span>
              <svg style={{ marginLeft: "auto", opacity: 0.35 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          ))}
        </div>
        {/* Divider */}
        <div style={{ height: 1, background: "#f3f4f6", margin: "0 16px" }} />
        {/* Copy link */}
        <div style={{ padding: "8px" }}>
          <button onClick={handleCopy}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, width: "100%", border: "none", background: copied ? "#f0fdf4" : "transparent", cursor: "pointer", color: copied ? "#16a34a" : "#374151", transition: "background 0.15s" }}>
            {copied
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            }
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600 }}>{copied ? "Link copied!" : "Copy link"}</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Site Header ─────────────────────────────────────────────────────────── */
function AppHeader() {
  const nav = [
    { label: "Home" }, { label: "About" },
    { label: "Services", dropdown: true }, { label: "Capability Decks", dropdown: true },
    { label: "Contracts" }, { label: "Jobs" }, { label: "Insights", active: true }, { label: "Contact" },
  ];
  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-8">
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <LogoIcon size={40} />
          <div>
            <div style={{ fontFamily: "'Inter',sans-serif", color: NAVY, fontWeight: 700, fontSize: 17, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              Hire<span style={{ color: ORANGE }}>'in</span> Solutions
            </div>
            <div style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af", fontSize: 9, letterSpacing: "0.06em", lineHeight: 1, marginTop: 2, textTransform: "uppercase" }}>
              A Rayomind Company&nbsp;|&nbsp;Est. 2014
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-5 flex-1">
          {nav.map((item) => (
            <span key={item.label} className="flex items-center gap-0.5 cursor-pointer whitespace-nowrap transition-colors"
              style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: item.active ? 600 : 500, color: item.active ? NAVY : "#4b5563", borderBottom: item.active ? `2px solid ${ORANGE}` : "2px solid transparent", paddingBottom: 2 }}>
              {item.label}
              {item.dropdown && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}><polyline points="6 9 12 15 18 9" /></svg>}
            </span>
          ))}
        </nav>
        <button className="flex items-center gap-2 flex-shrink-0 hover:brightness-110 transition-all"
          style={{ background: ORANGE, color: "white", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>
          Get a Quote
        </button>
      </div>
    </header>
  );
}

/* ─── Article Header ─────────────────────────────────────────────────────── */
function ArticleHeader() {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="pt-8 pb-8 border-b border-gray-100">

      {/* Breadcrumb — replaces the second header bar */}
      <nav className="flex items-center gap-1.5 mb-6" aria-label="breadcrumb">
        <a href="#" style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af", fontSize: 12, textDecoration: "none" }}
          className="hover:text-gray-600 transition-colors flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Insights
        </a>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <a href="#" style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af", fontSize: 12, textDecoration: "none" }}
          className="hover:text-gray-600 transition-colors">Healthcare</a>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <a href="#" style={{ fontFamily: "'Inter',sans-serif", color: "#9ca3af", fontSize: 12, textDecoration: "none" }}
          className="hover:text-gray-600 transition-colors">Talent Strategy</a>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontFamily: "'Inter',sans-serif", color: "#4b5563", fontSize: 12, fontWeight: 500 }}>Article</span>
      </nav>

      {/* Article meta pills row */}
      <div className="flex items-center gap-2 mb-5">
        <span style={{ background: ORANGE + "14", color: ORANGE, border: `1px solid ${ORANGE}30`, fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }} className="px-2.5 py-1 rounded-full">Executive Insight</span>
        <span style={{ background: "#f3f4f6", color: "#6b7280", fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }} className="px-2.5 py-1 rounded-full">Healthcare</span>
        <span style={{ background: "#f3f4f6", color: "#6b7280", fontFamily: "'Inter',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }} className="px-2.5 py-1 rounded-full">Talent Strategy</span>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "#9ca3af" }} className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          8 min read
        </span>
      </div>
      <h1 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.12, letterSpacing: "-0.02em" }} className="text-5xl font-bold mb-5 max-w-3xl">
        Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding
      </h1>
      <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-xl text-gray-500 leading-relaxed max-w-2xl mb-8 font-light">
        Burnout alone doesn't explain the exodus. A deeper structural misalignment between how healthcare organizations define "retention" and what clinicians actually need is quietly accelerating a workforce crisis that conventional HR metrics consistently miss.
      </p>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3">
          <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` }} className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
            <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-white font-bold text-xs">KS</span>
          </div>
          <div>
            <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-sm font-semibold leading-tight">Kavita Sharma</p>
            <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-xs text-gray-400 leading-tight">Founder & CEO, Hire'in Solutions</p>
          </div>
        </div>
        <div className="w-px h-7" style={{ background: "#e5e7eb" }} />
        <span style={{ fontFamily: "'Inter',sans-serif" }} className="text-sm text-gray-400">July 11, 2025</span>
        <div className="w-px h-7" style={{ background: "#e5e7eb" }} />
        <div className="flex items-center gap-1.5 text-sm text-gray-400" style={{ fontFamily: "'Inter',sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>4,820
        </div>
        <div className="flex items-center gap-1.5 text-sm text-gray-400" style={{ fontFamily: "'Inter',sans-serif" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>38
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Share with popover */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShareOpen((v) => !v)}
              style={{ fontFamily: "'Inter',sans-serif", background: shareOpen ? NAVY + "0d" : "transparent" }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 hover:border-gray-300 transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
              Share
            </button>
            {shareOpen && <SharePopover onClose={() => setShareOpen(false)} />}
          </div>
          <button style={{ background: NAVY, fontFamily: "'Inter',sans-serif" }} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium text-white hover:brightness-110 transition-all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            Save article
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Hero Image with logo overlay ──────────────────────────────────────── */
function HeroImage() {
  return (
    <div className="w-full rounded-xl overflow-hidden my-9 relative" style={{ height: 400, background: `linear-gradient(140deg, ${NAVY_DARK} 0%, ${NAVY} 45%, ${NAVY_LIGHT} 80%, #3a6aad 100%)` }}>
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* Hire'in logo — top left */}
      <div className="absolute top-5 left-5 flex items-center gap-2.5">
        <div style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "5px 10px 5px 6px", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ background: "rgba(255,255,255,0.9)", borderRadius: 5, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill={NAVY} opacity="0.9" />
              <rect x="14" y="3" width="7" height="7" rx="1" fill={NAVY} opacity="0.5" />
              <rect x="3" y="14" width="7" height="7" rx="1" fill={NAVY} opacity="0.5" />
              <rect x="14" y="14" width="7" height="7" rx="1" fill={ORANGE} opacity="0.9" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Inter',sans-serif", color: "white", fontWeight: 700, fontSize: 12, lineHeight: 1 }}>
            Hire<span style={{ color: ORANGE }}>'in</span> Insights
          </span>
        </div>
      </div>

      {/* Centred quote */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
        <div style={{ background: ORANGE }} className="w-10 h-0.5 rounded-full mb-5" />
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.35 }} className="text-white text-3xl font-semibold max-w-lg opacity-95">
          "Talent doesn't leave organizations. It leaves systems that stopped listening."
        </p>
        <div style={{ background: ORANGE }} className="w-6 h-0.5 rounded-full mt-5" />
      </div>
    </div>
  );
}

/* ─── Article Body ───────────────────────────────────────────────────────── */
function ArticleBody() {
  return (
    <div style={{ fontFamily: "'Inter',sans-serif" }}>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        In the past eighteen months, Hire'in Solutions has partnered with 47 hospital systems across the United States. In every engagement, the same conversation unfolds: senior HR leadership presents data showing 90-day retention rates are holding steady, while department heads describe an unrecognized talent exodus occurring silently at the 14-to-18-month mark.
      </p>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        The gap is not in effort. The investments these organizations are making — sign-on bonuses that have tripled since 2021, expanded EAP programs, wellness stipends — are real. The gap is structural: healthcare organizations continue to measure retention as a binary outcome (stayed or left) when clinicians experience loyalty as a continuous, dynamically adjusting signal.
      </p>
      <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-3xl font-bold mt-10 mb-4">
        The Misalignment That Metrics Don't Capture
      </h2>
      <p className="text-gray-700 leading-[1.85] text-lg mb-6">
        Standard retention analytics track tenure, voluntary turnover rate, and time-to-fill. These are lagging indicators — they tell you a clinician has already decided to leave, often weeks after the decision crystallized. What they fail to surface is the progressive erosion of organizational commitment that precedes departure.
      </p>
    </div>
  );
}

/* ─── Hire'in Perspective callout ────────────────────────────────────────── */
function HirinPerspective() {
  return (
    <div className="rounded-xl p-7 my-8" style={{ background: ORANGE + "09", borderLeft: `3px solid ${ORANGE}` }}>
      <div className="flex items-start gap-4">
        <div style={{ background: ORANGE }} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-[10px] font-black">H</span>
        </div>
        <div>
          <p style={{ color: ORANGE, fontFamily: "'Inter',sans-serif" }} className="text-[10px] font-bold uppercase tracking-widest mb-2">The Hire'in Perspective</p>
          <p style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-xl font-semibold leading-snug mb-2.5">
            Data-Driven Talent Intelligence Changes the Equation
          </p>
          <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-gray-600 text-base leading-relaxed">
            Organizations that implement longitudinal engagement scoring identify at-risk talent 4.2× earlier. This window is the difference between a retention conversation and an exit conversation.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Key Takeaways — redesigned for maximum engagement ─────────────────── */
const TAKEAWAYS = [
  {
    number: "01",
    headline: "Retention is a signal, not a checkpoint",
    body: "Track behavioral micro-shifts monthly — not at 30 or 90 days. Commitment is continuous.",
    accent: ORANGE,
    accentBg: ORANGE + "10",
  },
  {
    number: "02",
    headline: "The 14-month cliff no one sees coming",
    body: "Onboarding ends at 90 days. The real risk window opens at month 14 — when support structures vanish and disillusionment quietly peaks.",
    accent: NAVY,
    accentBg: NAVY + "0d",
  },
  {
    number: "03",
    headline: "Scheduling beats salary",
    body: "Clinicians consistently rate scheduling autonomy above above-market compensation as the primary driver of long-term commitment.",
    accent: "#059669",
    accentBg: "#05966910",
  },
];

function KeyTakeaways() {
  return (
    <section className="my-10">
      {/* Section label */}
      <div className="flex items-center gap-4 mb-7">
        <div style={{ background: ORANGE }} className="w-6 h-0.5 rounded-full flex-shrink-0" />
        <p style={{ color: NAVY, fontFamily: "'Inter',sans-serif" }} className="text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap">
          Key Takeaways
        </p>
        <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
      </div>

      {/* Card row */}
      <div className="grid grid-cols-3 gap-4">
        {TAKEAWAYS.map((t) => (
          <div key={t.number}
            className="rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all"
            style={{ background: t.accentBg, border: `1.5px solid ${t.accent}22` }}
          >
            {/* Large faded number */}
            <span style={{ fontFamily: "'Playfair Display',Georgia,serif", color: t.accent, fontSize: 64, fontWeight: 800, lineHeight: 1, opacity: 0.12, position: "absolute", top: 8, right: 16, pointerEvents: "none", userSelect: "none" }}>
              {t.number}
            </span>
            {/* Accent bar */}
            <div style={{ width: 32, height: 3, background: t.accent, borderRadius: 2 }} />
            {/* Headline */}
            <p style={{ fontFamily: "'Playfair Display',Georgia,serif", color: NAVY, fontSize: 17, fontWeight: 700, lineHeight: 1.3, position: "relative" }}>
              {t.headline}
            </p>
            {/* Body */}
            <p style={{ fontFamily: "'Inter',sans-serif", color: "#4b5563", fontSize: 13, lineHeight: 1.7, position: "relative" }}>
              {t.body}
            </p>
            {/* Number badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: t.accent, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                {parseInt(t.number)}
              </span>
              <div style={{ flex: 1, height: 1, background: t.accent, opacity: 0.2 }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── CEO Author Card (cleaned up) ───────────────────────────────────────── */
function CEOAuthorCard() {
  const expertise = ["Healthcare Workforce Strategy", "Talent Acquisition", "Organizational Design", "Executive Search"];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(140deg, ${NAVY_DARK} 0%, ${NAVY} 55%, ${NAVY_LIGHT} 100%)` }}>
      <div className="p-9 relative">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-[0.06]" style={{ background: ORANGE, transform: "translate(30%,-30%)" }} />
        <div className="relative flex items-start gap-7">
          {/* Avatar — slightly smaller (76px) */}
          <div className="flex-shrink-0 relative" style={{ width: 76, height: 76 }}>
            <div className="w-full h-full rounded-full flex items-center justify-center shadow-xl" style={{ background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_LIGHT} 100%)`, border: "3px solid rgba(255,255,255,0.2)" }}>
              <span style={{ fontFamily: "'Playfair Display', Georgia, serif" }} className="text-white font-bold text-2xl">KS</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-md" style={{ background: "#0077B5", border: "2px solid rgba(255,255,255,0.85)" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: ORANGE + "28", color: ORANGE, border: `1px solid ${ORANGE}35`, fontFamily: "'Inter',sans-serif" }}>Founder & CEO</span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'Inter',sans-serif" }} className="text-xs">· 32 articles</span>
            </div>
            <h3 style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white" }} className="text-2xl font-bold mb-0.5">Kavita Sharma</h3>
            <p style={{ color: ORANGE, fontFamily: "'Inter',sans-serif" }} className="text-sm font-semibold mb-4">Chief Executive Officer · Hire'in Solutions</p>
            <p style={{ fontFamily: "'Inter',sans-serif" }} className="text-white/70 text-sm leading-relaxed mb-5 max-w-xl">
              Kavita founded Hire'in Solutions after nearly two decades at Big Four consulting firms and as VP of Talent Acquisition at a 28,000-employee health system. Advisor to 120+ organizations. Featured in HBR, SHRM Executive Network, and the Advisory Board Workforce Report. MBA, Wharton · CDE.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {expertise.map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.13)", fontFamily: "'Inter',sans-serif" }}>{tag}</span>
              ))}
            </div>
            {/* CTAs — no View Profile; LinkedIn + Email */}
            <div className="flex items-center gap-3 flex-wrap">
              <a href="https://www.linkedin.com/company/hirein-solutions" target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: "#0077B5", color: "white", fontFamily: "'Inter',sans-serif", textDecoration: "none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                Connect on LinkedIn
              </a>
              {/* Newsletter subscribe inline */}
              <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 40, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 14, paddingRight: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input
                    type="email"
                    placeholder="Your work email"
                    style={{ background: "transparent", border: "none", outline: "none", color: "white", fontFamily: "'Inter',sans-serif", fontSize: 12, width: 150, padding: "8px 4px 8px 0" }}
                  />
                </div>
                <button style={{ background: ORANGE, color: "white", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 700, padding: "8px 14px", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                  Subscribe to Insights →
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* ─ Stats row REMOVED per feedback ─ */}
      </div>
    </div>
  );
}

/* ─── Related Articles ───────────────────────────────────────────────────── */
function RelatedArticles() {
  const articles = [
    { tag: "Talent Strategy", title: "The Hidden Cost of Mid-Level Manager Burnout in Integrated Health Systems", time: "6 min", author: "Kavita Sharma", color: `linear-gradient(135deg,${NAVY} 0%,${NAVY_LIGHT} 100%)` },
    { tag: "Technology", title: "AI-Augmented Screening: What 18 Months of Data Actually Shows", time: "11 min", author: "Ravi Mehta", color: "linear-gradient(135deg,#2d6a4f 0%,#40916c 100%)" },
    { tag: "Engineering", title: "STEM Talent in Healthcare Infrastructure: A Pipeline in Freefall", time: "9 min", author: "Priya Nair", color: "linear-gradient(135deg,#5e35b1 0%,#7c4dff 100%)" },
  ];
  return (
    <section className="mt-12 mb-8 pt-8 border-t border-gray-100">
      <p style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-2xl font-bold mb-6">Continue Reading</p>
      <div className="grid grid-cols-3 gap-4">
        {articles.map((a, i) => (
          <div key={i} className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all cursor-pointer group">
            <div className="h-28 relative" style={{ background: a.color }}>
              <div className="absolute bottom-3 left-3"><span style={{ fontFamily: "'Inter',sans-serif" }} className="px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-black/25">{a.tag}</span></div>
            </div>
            <div className="p-4">
              <h4 style={{ fontFamily: "'Inter',sans-serif" }} className="text-sm font-bold text-gray-900 leading-snug mb-2 group-hover:text-blue-700 transition-colors line-clamp-3">{a.title}</h4>
              <div className="flex items-center justify-between text-xs text-gray-400" style={{ fontFamily: "'Inter',sans-serif" }}>
                <span>{a.author}</span><span>{a.time} read</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
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
    { label: "LinkedIn", color: "#0077B5", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg> },
    { label: "Twitter / X", color: "#000", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.859L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
    { label: "Facebook", color: "#1877F2", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg> },
  ];

  return (
    <footer style={{ background: NAVY_DARK, borderTop: `3px solid ${ORANGE}` }}>
      {/* Upper section */}
      <div className="max-w-7xl mx-auto px-8 pt-14 pb-10">
        <div className="grid grid-cols-5 gap-10">
          {/* Brand column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 8, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" fill="white" opacity="0.9" />
                  <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.4" />
                  <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.4" />
                  <rect x="14" y="14" width="7" height="7" rx="1" fill={ORANGE} opacity="0.9" />
                </svg>
              </div>
              <div>
                <p style={{ fontFamily: "'Inter',sans-serif", color: "white", fontWeight: 700, fontSize: 16 }}>Hire<span style={{ color: ORANGE }}>'in</span> Solutions</p>
                <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: "0.07em", textTransform: "uppercase", marginTop: 1 }}>A Rayomind Company | Est. 2014</p>
              </div>
            </div>
            <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7, marginBottom: 18, maxWidth: 280 }}>
              AI-powered staffing and talent acquisition for Healthcare, IT, Engineering, and Professional Services organizations.
            </p>
            {/* Social icons */}
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

          {/* Nav columns */}
          {Object.entries(footerNav).map(([section, links]) => (
            <div key={section}>
              <p style={{ fontFamily: "'Inter',sans-serif", color: "white", fontWeight: 700, fontSize: 12, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>{section}</p>
              <ul className="space-y-2.5">
                {links.map(link => (
                  <li key={link}>
                    <a href="#" style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.45)", fontSize: 13, textDecoration: "none" }} className="hover:text-white transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
            © 2025 Hire'in Solutions, a Rayomind Company. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service", "Cookie Settings"].map(l => (
              <a key={l} href="#" style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,0.3)", fontSize: 12, textDecoration: "none" }} className="hover:text-white transition-colors">{l}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Root ───────────────────────────────────────────────────────────────── */
export function ArticlePreview() {
  return (
    <div className="bg-white flex flex-col" style={{ minHeight: "100vh" }}>
      <link rel="stylesheet" media="print" onLoad={(e: any) => { e.target.media = "all"; }}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Inter:wght@300;400;500;600;700&display=swap" />

      <AppHeader />

      {/* Page content — flex-1 so footer sits flush */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-8">
          <ArticleHeader />
          <HeroImage />
          <ArticleBody />
          <HirinPerspective />
          <div style={{ fontFamily: "'Inter',sans-serif" }}>
            <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-3xl font-bold mt-10 mb-4">The Three Structural Shifts</h2>
            <p className="text-gray-700 leading-[1.85] text-lg mb-6">
              Based on our analysis across 47 health system engagements, three organizational design shifts consistently separate systems that retain top clinical talent from those that don't: continuous listening infrastructure, frontline managers as retention stakeholders with dedicated analytics, and the formalization of internal mobility pathways.
            </p>
          </div>
          <KeyTakeaways />

          <div className="mt-12 mb-2">
            <div className="flex items-center gap-4 mb-7">
              <div style={{ background: "#e5e7eb" }} className="h-px flex-1" />
              <p style={{ color: "#9ca3af", fontFamily: "'Inter',sans-serif" }} className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">About the Author</p>
              <div style={{ background: "#e5e7eb" }} className="h-px flex-1" />
            </div>
            <CEOAuthorCard />
            {/* Contributing Analyst removed per feedback */}
          </div>

          <RelatedArticles />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
