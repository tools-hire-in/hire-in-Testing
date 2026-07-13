const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const NAVY_LIGHT = "#2a4d8f";
const ORANGE = "#F47C20";
const ORANGE_LIGHT = "#F96D3E";

function TopNav() {
  return (
    <nav style={{ background: NAVY }} className="w-full px-8 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div style={{ background: ORANGE }} className="w-8 h-8 rounded-sm flex items-center justify-center">
            <span className="text-white font-black text-sm">H</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight font-['Inter']">
            Hire<span style={{ color: ORANGE }}>'in</span> Solutions
          </span>
        </div>
        <span className="text-white/30 mx-2 text-xl">|</span>
        <span className="text-white/70 text-sm font-medium font-['Inter'] tracking-widest uppercase">Insights</span>
      </div>
      <div className="flex items-center gap-8">
        {["Healthcare", "Technology", "Engineering", "Talent Strategy"].map(item => (
          <span key={item} className="text-white/70 hover:text-white text-sm font-['Inter'] cursor-pointer transition-colors">{item}</span>
        ))}
      </div>
      <button style={{ background: ORANGE }} className="px-5 py-2 rounded-full text-white text-sm font-semibold font-['Inter'] hover:brightness-110 transition-all">
        Subscribe
      </button>
    </nav>
  );
}

function CategoryBreadcrumb() {
  return (
    <div className="flex items-center gap-2 mb-6">
      <span style={{ color: NAVY }} className="text-sm font-['Inter'] font-medium opacity-60 hover:opacity-100 cursor-pointer">Healthcare</span>
      <span className="text-gray-300">/</span>
      <span style={{ color: ORANGE }} className="text-sm font-['Inter'] font-semibold">Talent Strategy</span>
    </div>
  );
}

function ArticleHero() {
  return (
    <header className="mb-12">
      <CategoryBreadcrumb />

      <div className="flex items-start gap-3 mb-6">
        <span style={{ background: ORANGE + "18", color: ORANGE }} className="px-3 py-1 rounded-full text-xs font-bold font-['Inter'] uppercase tracking-wider border border-orange-200">
          Executive Insight
        </span>
        <span className="px-3 py-1 rounded-full text-xs font-semibold font-['Inter'] uppercase tracking-wider border border-gray-200 text-gray-500 bg-gray-50">
          8 min read
        </span>
      </div>

      <h1
        style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1.15 }}
        className="text-5xl font-bold mb-5 max-w-3xl"
      >
        Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding
      </h1>

      <p className="text-xl text-gray-500 font-['Inter'] leading-relaxed max-w-2xl mb-8 font-light">
        Burnout alone doesn't explain the exodus. A deeper structural misalignment between how healthcare organizations define "retention" and what clinicians actually need is quietly accelerating a workforce crisis that conventional HR metrics consistently miss.
      </p>

      <div className="flex items-center gap-6 pb-8 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` }}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md"
          >
            <span className="text-white font-bold text-sm">KS</span>
          </div>
          <div>
            <p style={{ color: NAVY }} className="text-sm font-semibold font-['Inter']">Kavita Sharma</p>
            <p className="text-xs text-gray-400 font-['Inter']">Founder & CEO</p>
          </div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-sm text-gray-400 font-['Inter']">July 11, 2025</div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="flex items-center gap-2 text-sm text-gray-400 font-['Inter']">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          4,820 views
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400 font-['Inter']">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          38 comments
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-['Inter'] text-gray-600 hover:border-gray-400 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share
          </button>
          <button style={{ background: NAVY }} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-['Inter'] text-white hover:brightness-110 transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Save
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroImage() {
  return (
    <div
      className="w-full rounded-2xl mb-12 overflow-hidden relative"
      style={{ height: 420, background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 40%, ${NAVY_LIGHT} 70%, #3a6aad 100%)` }}
    >
      <div className="absolute inset-0 opacity-10"
        style={{ backgroundImage: "radial-gradient(circle at 25% 50%, white 1px, transparent 1px), radial-gradient(circle at 75% 50%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }}
      />
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
        <div style={{ background: ORANGE }} className="w-16 h-1 rounded-full" />
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif" }} className="text-white text-3xl font-bold text-center max-w-lg opacity-90 leading-snug">
          "Talent doesn't leave organizations. It leaves systems that stopped listening."
        </p>
        <div style={{ background: ORANGE }} className="w-8 h-1 rounded-full mt-2" />
      </div>
      <div className="absolute bottom-4 right-5 flex items-center gap-2">
        <span style={{ color: ORANGE }} className="text-xs font-bold font-['Inter'] uppercase tracking-widest">Hire'in Insights</span>
      </div>
    </div>
  );
}

function ArticleBody() {
  return (
    <div className="prose prose-lg max-w-none mb-10" style={{ fontFamily: "'Inter', sans-serif" }}>
      <p className="text-gray-700 leading-relaxed text-lg mb-6">
        In the past eighteen months, Hire'in Solutions has partnered with 47 hospital systems and integrated delivery networks across the United States. In every engagement, a variation of the same conversation unfolds: senior HR leadership presents data showing 90-day retention rates are holding steady, while department heads describe an unrecognized talent exodus occurring silently at the 14-to-18-month mark.
      </p>

      <p className="text-gray-700 leading-relaxed text-lg mb-6">
        The gap is not in effort. The investments these organizations are making — sign-on bonuses that have tripled since 2021, expanded EAP programs, wellness stipends, flexible scheduling pilots — are real and often substantial. The gap is structural: healthcare organizations continue to measure retention as a binary outcome (stayed or left) when clinicians experience loyalty as a continuous, dynamically adjusting signal.
      </p>

      <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-3xl font-bold mt-10 mb-4">
        The Misalignment That Metrics Don't Capture
      </h2>

      <p className="text-gray-700 leading-relaxed text-lg mb-6">
        Standard retention analytics track tenure, voluntary turnover rate, and time-to-fill. These are lagging indicators — they tell you a clinician has already decided to leave, often weeks or months after the decision crystallized. What they fail to surface is the progressive erosion of organizational commitment that precedes departure: the nurse who stops volunteering for committee work, the physician who declines to mentor residents, the therapist who quietly reduces their weekend availability.
      </p>

      <p className="text-gray-700 leading-relaxed text-lg mb-8">
        Each of these behavioral shifts is a data point. Aggregated across a department, they constitute a leading indicator that is both measurable and addressable — if you know to look for it.
      </p>
    </div>
  );
}

function HirinPerspective() {
  return (
    <div
      className="relative rounded-xl p-8 mb-10"
      style={{ background: ORANGE + "08", borderLeft: `4px solid ${ORANGE}` }}
    >
      <div className="flex items-start gap-4">
        <div style={{ background: ORANGE }} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-white text-xs font-black">H</span>
        </div>
        <div>
          <p style={{ color: ORANGE }} className="text-xs font-bold font-['Inter'] uppercase tracking-widest mb-2">The Hire'in Perspective</p>
          <p style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-xl font-semibold leading-snug mb-3">
            Data-Driven Talent Intelligence Changes the Equation
          </p>
          <p className="text-gray-600 text-base leading-relaxed font-['Inter']">
            Organizations that implement longitudinal engagement scoring — tracking behavioral micro-signals monthly rather than through annual engagement surveys — identify at-risk talent 4.2x earlier than those relying on traditional retention metrics. This window is not merely informational; it is the difference between a retention conversation and an exit conversation. The former is possible. The latter is expensive.
          </p>
        </div>
      </div>
    </div>
  );
}

function KeyTakeaways() {
  const points = [
    "Retention is a continuous signal, not a binary event — track behavioral micro-shifts monthly.",
    "The 14-to-18-month inflection point is consistently underserved by onboarding programs designed to end at 90 days.",
    "Clinicians report that 'being heard on scheduling' matters more to long-term commitment than compensation above market median.",
  ];
  return (
    <div className="rounded-2xl border border-gray-100 p-8 mb-12 bg-gray-50/60">
      <p style={{ color: NAVY }} className="text-xs font-bold font-['Inter'] uppercase tracking-widest mb-5 flex items-center gap-2">
        <span style={{ background: NAVY }} className="w-4 h-0.5 rounded-full inline-block" />
        Key Takeaways
      </p>
      <ul className="space-y-4">
        {points.map((pt, i) => (
          <li key={i} className="flex items-start gap-4">
            <span
              style={{ background: NAVY, color: "white", minWidth: 28, minHeight: 28 }}
              className="rounded-full flex items-center justify-center text-xs font-bold font-['Inter'] mt-0.5"
            >
              {i + 1}
            </span>
            <p className="text-gray-700 text-base font-['Inter'] leading-relaxed">{pt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CEOAuthorCard() {
  const expertise = ["Healthcare Workforce Strategy", "Talent Acquisition", "Organizational Design", "Executive Search"];

  return (
    <div
      className="rounded-2xl overflow-hidden mb-6"
      style={{ background: `linear-gradient(140deg, ${NAVY_DARK} 0%, ${NAVY} 55%, ${NAVY_LIGHT} 100%)` }}
    >
      <div className="p-10 relative">
        <div className="absolute top-0 right-0 w-72 h-72 opacity-5 rounded-full"
          style={{ background: ORANGE, transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-48 h-48 opacity-5 rounded-full"
          style={{ background: "white", transform: "translate(-20%, 30%)" }} />

        <div className="relative flex items-start gap-8">
          <div className="flex-shrink-0">
            <div
              className="relative"
              style={{ width: 100, height: 100 }}
            >
              <div
                className="w-full h-full rounded-full flex items-center justify-center shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_LIGHT} 100%)`,
                  border: "3px solid rgba(255,255,255,0.25)"
                }}
              >
                <span className="text-white font-bold text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>KS</span>
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: ORANGE, border: "2px solid rgba(255,255,255,0.9)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span
                className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ background: ORANGE + "30", color: ORANGE, border: `1px solid ${ORANGE}40` }}
              >
                Founder & CEO
              </span>
              <span className="text-white/40 text-xs font-['Inter']">·</span>
              <span className="text-white/50 text-xs font-['Inter']">32 Articles Published</span>
            </div>

            <h3
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "white" }}
              className="text-2xl font-bold mb-1"
            >
              Kavita Sharma
            </h3>
            <p style={{ color: ORANGE }} className="text-sm font-semibold font-['Inter'] mb-4">
              Chief Executive Officer · Hire'in Solutions
            </p>

            <p className="text-white/75 text-sm font-['Inter'] leading-relaxed mb-6 max-w-xl">
              Kavita founded Hire'in Solutions after nearly two decades building workforce strategy practices at two of the Big Four consulting firms and a tenure as VP of Talent Acquisition at a 28,000-employee integrated health system. She has advised C-suite and Board-level stakeholders across 120+ organizations on workforce transformation, talent pipeline design, and organizational resilience. Her work has been featured in the Harvard Business Review, SHRM Executive Network, and the Advisory Board's Workforce Report. She holds an MBA from Wharton and is a Certified Diversity Executive (CDE).
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {expertise.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-medium font-['Inter']"
                  style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold font-['Inter'] transition-all"
                style={{ background: "white", color: NAVY }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                View Author Profile
              </button>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold font-['Inter'] transition-all"
                style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                Connect on LinkedIn
              </button>
            </div>
          </div>
        </div>

        <div className="relative mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {[["12+", "Years of Practice"], ["120+", "Orgs Advised"], ["$2B+", "Workforce Impact"]].map(([val, label]) => (
              <div key={label}>
                <p style={{ color: ORANGE }} className="text-xl font-bold font-['Inter']">{val}</p>
                <p className="text-white/50 text-xs font-['Inter'] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-white/40 text-xs font-['Inter']">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            kavitasharma-ceo
          </div>
        </div>
      </div>
    </div>
  );
}

function ContributorAuthorCard() {
  const areas = ["Clinical Staffing", "Nursing Workforce", "Healthcare Analytics"];

  return (
    <div
      className="rounded-2xl border border-gray-100 p-7 flex items-start gap-6 hover:border-gray-200 transition-all hover:shadow-md"
      style={{ background: "white" }}
    >
      <div className="flex-shrink-0">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
          style={{ background: `linear-gradient(135deg, #4B7BEC 0%, #3a5fc7 100%)` }}
        >
          <span className="text-white font-bold text-lg font-['Inter']">RM</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold font-['Inter'] uppercase tracking-wider"
            style={{ background: "#4B7BEC12", color: "#4B7BEC", border: "1px solid #4B7BEC22" }}
          >
            Contributing Analyst
          </span>
        </div>
        <h4 className="font-bold text-gray-900 font-['Inter'] text-lg mb-0.5">Ravi Mehta</h4>
        <p className="text-sm text-gray-500 font-['Inter'] mb-3">Senior Workforce Analyst · Healthcare Practice</p>
        <p className="text-sm text-gray-600 font-['Inter'] leading-relaxed mb-4">
          Ravi specializes in healthcare workforce analytics with a focus on nursing pipeline strategy and predictive attrition modeling. He holds an MS in Health Policy from Johns Hopkins and has published research in the Journal of Healthcare Management.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {areas.map(area => (
            <span key={area} className="px-2.5 py-1 rounded-full text-xs font-medium font-['Inter'] bg-gray-100 text-gray-600">
              {area}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button style={{ color: NAVY }} className="text-sm font-semibold font-['Inter'] hover:underline flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            View Profile
          </button>
          <span className="text-gray-200">|</span>
          <button className="text-sm font-semibold font-['Inter'] text-[#0077B5] hover:underline flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </button>
          <span className="text-gray-200">|</span>
          <span className="text-xs text-gray-400 font-['Inter']">14 articles</span>
        </div>
      </div>
    </div>
  );
}

function AuthorSection() {
  return (
    <section className="mt-12 mb-12">
      <div className="flex items-center gap-4 mb-8">
        <div style={{ background: NAVY }} className="h-px flex-1" />
        <p style={{ color: NAVY }} className="text-xs font-bold font-['Inter'] uppercase tracking-widest whitespace-nowrap">About the Authors</p>
        <div style={{ background: NAVY }} className="h-px flex-1" />
      </div>

      <CEOAuthorCard />
      <ContributorAuthorCard />
    </section>
  );
}

function RelatedArticles() {
  const articles = [
    { tag: "Talent Strategy", title: "The Hidden Cost of Mid-Level Manager Burnout in Integrated Health Systems", time: "6 min", author: "Kavita Sharma" },
    { tag: "Technology", title: "AI-Augmented Screening: What 18 Months of Data Actually Shows", time: "11 min", author: "Ravi Mehta" },
    { tag: "Engineering", title: "STEM Talent in Healthcare Infrastructure: A Pipeline in Freefall", time: "9 min", author: "Priya Nair" },
  ];
  return (
    <section className="mb-16">
      <h3 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-2xl font-bold mb-6">
        Continue Reading
      </h3>
      <div className="grid grid-cols-3 gap-5">
        {articles.map((a, i) => (
          <div key={i} className="rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
            <div
              className="h-32 relative"
              style={{ background: i === 0 ? `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)` : i === 1 ? "linear-gradient(135deg, #2d6a4f 0%, #40916c 100%)" : `linear-gradient(135deg, #7b2d8b 0%, #a855f7 100%)` }}
            >
              <div className="absolute bottom-3 left-3">
                <span className="px-2 py-0.5 rounded text-xs font-semibold font-['Inter'] text-white" style={{ background: "rgba(0,0,0,0.3)" }}>
                  {a.tag}
                </span>
              </div>
            </div>
            <div className="p-4">
              <h4 className="text-sm font-bold text-gray-900 font-['Inter'] leading-snug mb-2 group-hover:text-blue-700 transition-colors line-clamp-3">{a.title}</h4>
              <div className="flex items-center justify-between text-xs text-gray-400 font-['Inter']">
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

function Footer() {
  return (
    <footer style={{ background: NAVY_DARK }} className="px-8 py-10 mt-0">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold text-base font-['Inter']">
              Hire<span style={{ color: ORANGE }}>'in</span> Solutions
            </span>
          </div>
          <p className="text-white/40 text-xs font-['Inter']">AI-Powered Staffing & Talent Acquisition</p>
        </div>
        <div className="flex gap-6 text-white/50 text-xs font-['Inter']">
          {["Privacy", "Terms", "Contact", "Subscribe"].map(l => (
            <span key={l} className="hover:text-white cursor-pointer transition-colors">{l}</span>
          ))}
        </div>
        <div className="text-white/30 text-xs font-['Inter']">© 2025 Hire'in Solutions</div>
      </div>
    </footer>
  );
}

export function ArticlePreview() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link
        rel="stylesheet"
        media="print"
        onLoad={(e: any) => { e.target.media = 'all'; }}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap"
      />
      <TopNav />
      <div className="max-w-4xl mx-auto px-8 pt-12">
        <ArticleHero />
        <HeroImage />
        <ArticleBody />
        <HirinPerspective />
        <div className="prose prose-lg max-w-none mb-10" style={{ fontFamily: "'Inter', sans-serif" }}>
          <h2 style={{ color: NAVY, fontFamily: "'Playfair Display', Georgia, serif" }} className="text-3xl font-bold mt-10 mb-4">
            The Three Structural Shifts
          </h2>
          <p className="text-gray-700 leading-relaxed text-lg mb-6">
            Based on our analysis across 47 health system engagements, three organizational design shifts consistently separate systems that retain top clinical talent from those that don't: a move from annual to continuous listening infrastructure, the elevation of frontline managers as retention stakeholders with dedicated analytics, and the formalization of internal mobility pathways for clinicians seeking scope expansion without leaving the organization.
          </p>
          <p className="text-gray-700 leading-relaxed text-lg mb-6">
            None of these are inexpensive. But each, when implemented with fidelity, returns a measurable reduction in replacement costs that exceeds the investment within 18 months. Given that replacing a single experienced ICU nurse now costs between $85,000 and $120,000 in direct and indirect costs, the business case is not difficult to construct.
          </p>
        </div>
        <KeyTakeaways />
        <AuthorSection />
        <RelatedArticles />
      </div>
      <Footer />
    </div>
  );
}
