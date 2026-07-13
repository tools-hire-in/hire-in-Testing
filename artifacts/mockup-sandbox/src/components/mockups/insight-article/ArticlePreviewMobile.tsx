const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const ORANGE = "#F47C20";
const ORANGE_LIGHT = "#F96D3E";

function MobileHeader() {
  return (
    <header style={{ background:"white", borderBottom:"1px solid #f3f4f6", position:"sticky", top:0, zIndex:50 }}>
      <div style={{ padding:"0 16px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ background:NAVY, borderRadius:6, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="white" opacity="0.9"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill={ORANGE} opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontWeight:700, fontSize:14, lineHeight:1.1 }}>
              Hire<span style={{ color:ORANGE }}>'in</span> Solutions
            </div>
            <div style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:8, letterSpacing:"0.05em", textTransform:"uppercase" }}>
              A Rayomind Company
            </div>
          </div>
        </div>
        {/* Hamburger */}
        <button style={{ display:"flex", flexDirection:"column", gap:4, padding:4, cursor:"pointer" }}>
          <span style={{ display:"block", width:20, height:2, background:"#374151", borderRadius:1 }}/>
          <span style={{ display:"block", width:20, height:2, background:"#374151", borderRadius:1 }}/>
          <span style={{ display:"block", width:20, height:2, background:"#374151", borderRadius:1 }}/>
        </button>
      </div>
    </header>
  );
}

function MobileFilterStrip() {
  const filters = ["All","Healthcare","Technology","Engineering","Talent Strategy","Leadership"];
  return (
    <div style={{ background:"white", borderBottom:"1px solid #f3f4f6", overflowX:"auto" }}>
      <div style={{ display:"flex", gap:6, padding:"8px 16px", whiteSpace:"nowrap" }}>
        {filters.map((f,i) => (
          <button key={f} style={{ fontFamily:"'Inter',sans-serif", background:i===1?NAVY:"transparent", color:i===1?"white":"#6b7280", border:i===1?`1px solid ${NAVY}`:"1px solid transparent", fontSize:11, fontWeight:500, padding:"4px 12px", borderRadius:999, flexShrink:0 }}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ArticlePreviewMobile() {
  return (
    <div style={{ minHeight:"100vh", background:"white", maxWidth:390, margin:"0 auto", overflow:"hidden" }}>
      <link rel="stylesheet" media="print" onLoad={(e:any)=>{e.target.media="all";}}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap"/>

      <MobileHeader/>
      <MobileFilterStrip/>

      {/* Article content */}
      <div style={{ padding:"20px 16px 0" }}>
        {/* Category + badges */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12, flexWrap:"wrap" }}>
          <span style={{ color:ORANGE, fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase" }}>Healthcare · Talent Strategy</span>
          <span style={{ background:ORANGE+"14", color:ORANGE, border:`1px solid ${ORANGE}30`, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", padding:"2px 8px", borderRadius:4 }}>Executive Insight</span>
          <span style={{ background:"#f9fafb", color:"#9ca3af", border:"1px solid #e5e7eb", fontFamily:"'Inter',sans-serif", fontSize:10, padding:"2px 8px", borderRadius:4 }}>8 min read</span>
        </div>

        {/* Headline */}
        <h1 style={{ color:NAVY, fontFamily:"'Playfair Display',Georgia,serif", lineHeight:1.18, letterSpacing:"-0.02em", fontSize:26, fontWeight:700, marginBottom:12 }}>
          Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding
        </h1>

        {/* Deck */}
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:"#6b7280", lineHeight:1.65, fontWeight:300, marginBottom:16 }}>
          Burnout alone doesn't explain the exodus. A deeper structural misalignment is quietly accelerating a workforce crisis that conventional HR metrics consistently miss.
        </p>

        {/* Author + meta row */}
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingBottom:16, borderBottom:"1px solid #f3f4f6", marginBottom:0 }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${NAVY} 0%,#2a4d8f 100%)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontWeight:700, fontSize:11 }}>KS</span>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ color:NAVY, fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, lineHeight:1.2 }}>Kavita Sharma</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:"#9ca3af", lineHeight:1.2 }}>Founder & CEO · Jul 11, 2025</p>
          </div>
          <div style={{ display:"flex", gap:12, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:4, fontFamily:"'Inter',sans-serif", fontSize:11, color:"#9ca3af" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>4.8k
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:4, fontFamily:"'Inter',sans-serif", fontSize:11, color:"#9ca3af" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>38
            </div>
          </div>
        </div>

        {/* Share/Save row */}
        <div style={{ display:"flex", gap:8, padding:"12px 0 16px" }}>
          <button style={{ flex:1, border:"1px solid #e5e7eb", borderRadius:999, padding:"8px", fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:500, color:"#6b7280", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>Share
          </button>
          <button style={{ flex:1, background:NAVY, borderRadius:999, padding:"8px", fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:"white", display:"flex", alignItems:"center", justifyContent:"center", gap:5, border:"none" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>Save
          </button>
        </div>
      </div>

      {/* Hero image */}
      <div style={{ margin:"0 16px 20px", borderRadius:12, overflow:"hidden", height:180, background:`linear-gradient(140deg,${NAVY_DARK} 0%,${NAVY} 55%,#2a4d8f 100%)`, position:"relative" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle,white 1px,transparent 1px)", backgroundSize:"24px 24px", opacity:0.07 }}/>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 24px", textAlign:"center" }}>
          <div style={{ background:ORANGE, width:24, height:2, borderRadius:1, marginBottom:12 }}/>
          <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"white", fontSize:15, fontWeight:600, lineHeight:1.45, opacity:0.95 }}>
            "Talent doesn't leave organizations. It leaves systems that stopped listening."
          </p>
          <div style={{ background:ORANGE, width:16, height:2, borderRadius:1, marginTop:12 }}/>
        </div>
      </div>

      {/* Article body */}
      <div style={{ padding:"0 16px" }}>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:"#374151", lineHeight:1.8, marginBottom:16 }}>
          In the past eighteen months, Hire'in Solutions has partnered with 47 hospital systems. In every engagement, the same conversation unfolds: senior HR leadership presents data showing 90-day retention rates are holding steady, while department heads describe an unrecognized talent exodus occurring silently at the 14-to-18-month mark.
        </p>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:"#374151", lineHeight:1.8, marginBottom:20 }}>
          The gap is structural: healthcare organizations continue to measure retention as a binary outcome when clinicians experience loyalty as a continuous, dynamically adjusting signal.
        </p>

        <h2 style={{ color:NAVY, fontFamily:"'Playfair Display',Georgia,serif", fontSize:21, fontWeight:700, marginBottom:12, lineHeight:1.25 }}>
          The Misalignment That Metrics Don't Capture
        </h2>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:15, color:"#374151", lineHeight:1.8, marginBottom:20 }}>
          Standard retention analytics track tenure and voluntary turnover — lagging indicators that tell you a clinician has already decided to leave. What they fail to surface is the progressive erosion of organizational commitment that precedes departure.
        </p>

        {/* Hire'in Perspective callout */}
        <div style={{ background:ORANGE+"09", borderLeft:`3px solid ${ORANGE}`, borderRadius:"0 10px 10px 0", padding:"14px 14px 14px 16px", marginBottom:20 }}>
          <p style={{ color:ORANGE, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:6 }}>The Hire'in Perspective</p>
          <p style={{ color:NAVY, fontFamily:"'Playfair Display',Georgia,serif", fontSize:15, fontWeight:600, lineHeight:1.35, marginBottom:8 }}>Data-Driven Talent Intelligence Changes the Equation</p>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#6b7280", lineHeight:1.65 }}>
            Organizations that implement longitudinal engagement scoring identify at-risk talent 4.2× earlier than those using annual surveys.
          </p>
        </div>

        {/* Key takeaways */}
        <div style={{ background:"#f9fafb", border:"1px solid #f3f4f6", borderRadius:12, padding:"16px", marginBottom:24 }}>
          <p style={{ color:NAVY, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:10, height:2, background:NAVY, borderRadius:1 }}/>Key Takeaways
          </p>
          {["Retention is a continuous signal — track behavioral micro-shifts monthly.",
            "The 14-to-18-month inflection point is underserved by onboarding programs designed to end at 90 days.",
            "Scheduling autonomy matters more to long-term commitment than above-market pay."].map((pt,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:i<2?12:0 }}>
              <span style={{ background:NAVY, color:"white", minWidth:22, height:22, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, flexShrink:0, marginTop:1 }}>{i+1}</span>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#374151", lineHeight:1.65 }}>{pt}</p>
            </div>
          ))}
        </div>

        {/* CEO Author Card (mobile) */}
        <div style={{ borderRadius:14, overflow:"hidden", background:`linear-gradient(140deg,${NAVY_DARK} 0%,${NAVY} 60%,#2a4d8f 100%)`, marginBottom:10, padding:"20px 16px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:14 }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${ORANGE} 0%,${ORANGE_LIGHT} 100%)`, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid rgba(255,255,255,0.2)" }}>
                <span style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"white", fontWeight:700, fontSize:18 }}>KS</span>
              </div>
              <div style={{ position:"absolute", bottom:-2, right:-2, width:18, height:18, borderRadius:"50%", background:"#0077B5", border:"2px solid rgba(255,255,255,0.9)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <span style={{ background:ORANGE+"28", color:ORANGE, border:`1px solid ${ORANGE}35`, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", padding:"2px 8px", borderRadius:999, display:"inline-block", marginBottom:4 }}>Founder & CEO</span>
              <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"white", fontWeight:700, fontSize:16, marginBottom:2 }}>Kavita Sharma</p>
              <p style={{ fontFamily:"'Inter',sans-serif", color:ORANGE, fontSize:11, fontWeight:600 }}>Chief Executive Officer · Hire'in Solutions</p>
            </div>
          </div>
          <p style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.7)", fontSize:12, lineHeight:1.65, marginBottom:14 }}>
            Kavita founded Hire'in Solutions after nearly two decades at Big Four consulting firms. Advisor to 120+ organizations. MBA, Wharton · CDE.
          </p>
          {/* Stats */}
          <div style={{ display:"flex", gap:0, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
            {[["12+","Years"],["120+","Orgs"],["$2B+","Impact"]].map(([v,l],i)=>(
              <div key={l} style={{ flex:1, textAlign:"center", borderRight:i<2?"1px solid rgba(255,255,255,0.1)":undefined }}>
                <p style={{ fontFamily:"'Inter',sans-serif", color:ORANGE, fontSize:16, fontWeight:700 }}>{v}</p>
                <p style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.4)", fontSize:9, textTransform:"uppercase", letterSpacing:"0.06em" }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contributor card */}
        <div style={{ border:"1px solid #f3f4f6", borderRadius:12, padding:"14px", display:"flex", gap:12, marginBottom:24 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#4B7BEC 0%,#3a5fc7 100%)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontWeight:700, fontSize:12 }}>RM</span>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontWeight:700, fontSize:13, marginBottom:2 }}>Ravi Mehta</p>
            <p style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10, marginBottom:6 }}>Senior Workforce Analyst · 14 articles</p>
            <p style={{ fontFamily:"'Inter',sans-serif", color:"#6b7280", fontSize:12, lineHeight:1.6 }}>Specialist in nursing pipeline strategy and predictive attrition modeling. MS, Johns Hopkins.</p>
          </div>
        </div>

        {/* Related — stacked on mobile */}
        <div style={{ paddingTop:16, borderTop:"1px solid #f3f4f6", marginBottom:32 }}>
          <p style={{ color:NAVY, fontFamily:"'Playfair Display',Georgia,serif", fontSize:18, fontWeight:700, marginBottom:14 }}>Continue Reading</p>
          {[
            { tag:"Talent Strategy", title:"The Hidden Cost of Mid-Level Manager Burnout", time:"6 min", author:"Kavita Sharma", color:`linear-gradient(135deg,${NAVY} 0%,#2a4d8f 100%)` },
            { tag:"Technology", title:"AI-Augmented Screening: What 18 Months of Data Shows", time:"11 min", author:"Ravi Mehta", color:"linear-gradient(135deg,#2d6a4f 0%,#40916c 100%)" },
          ].map((a,i)=>(
            <div key={i} style={{ display:"flex", gap:10, marginBottom:12, cursor:"pointer" }}>
              <div style={{ width:64, height:64, borderRadius:8, background:a.color, flexShrink:0, display:"flex", alignItems:"flex-end", padding:6 }}>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:8, fontWeight:700, color:"white", background:"rgba(0,0,0,0.3)", padding:"1px 5px", borderRadius:3 }}>{a.tag}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontWeight:700, fontSize:12, lineHeight:1.35, marginBottom:4 }}>{a.title}</p>
                <p style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10 }}>{a.author} · {a.time} read</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer style={{ background:NAVY_DARK, padding:"20px 16px" }}>
        <p style={{ fontFamily:"'Inter',sans-serif", color:"white", fontWeight:700, fontSize:13, marginBottom:12 }}>Hire<span style={{ color:ORANGE }}>'in</span> Solutions</p>
        <div style={{ display:"flex", gap:16, marginBottom:8, flexWrap:"wrap" }}>
          {["Privacy","Terms","Contact","Subscribe"].map(l=><span key={l} style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.4)", fontSize:11 }}>{l}</span>)}
        </div>
        <p style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.2)", fontSize:10 }}>© 2025 Hire'in Solutions</p>
      </footer>
    </div>
  );
}
