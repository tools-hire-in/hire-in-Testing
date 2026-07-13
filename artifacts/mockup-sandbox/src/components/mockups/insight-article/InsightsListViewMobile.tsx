const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const ORANGE = "#F47C20";

const TYPE_COLORS: Record<string, string> = {
  "Executive Insight": ORANGE,
  "Analysis": "#3b82f6",
  "Field Report": "#059669",
  "Case Study": "#7c3aed",
  "Market Brief": "#4b5563",
  "Opinion": "#db2777",
};

const ARTICLES = [
  { id:1, type:"Executive Insight", title:"Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding", author:{name:"Kavita Sharma",initials:"KS",color:NAVY}, date:"Jul 11", readMin:8, impressions:4820, hot:true },
  { id:2, type:"Analysis", title:"AI-Augmented Screening: What 18 Months of Data Actually Shows About Quality-of-Hire", author:{name:"Ravi Mehta",initials:"RM",color:"#4B7BEC"}, date:"Jul 8", readMin:11, impressions:3210, hot:false },
  { id:3, type:"Field Report", title:"Inside Three Rural Health Systems That Cracked the Nursing Retention Puzzle", author:{name:"Priya Nair",initials:"PN",color:"#059669"}, date:"Jul 5", readMin:9, impressions:2840, hot:false },
  { id:4, type:"Case Study", title:"From 42% to 78%: How Memorial Health Rebuilt Its Travel Nurse Pipeline in 11 Months", author:{name:"James Okafor",initials:"JO",color:"#7c3aed"}, date:"Jun 30", readMin:7, impressions:2190, hot:false },
  { id:5, type:"Market Brief", title:"Q2 2025 Healthcare Staffing Index: Demand Surges in Radiology and Respiratory Therapy", author:{name:"Kavita Sharma",initials:"KS",color:NAVY}, date:"Jun 24", readMin:4, impressions:5670, hot:true },
  { id:6, type:"Opinion", title:"The 'Culture Fit' Trap Is Costing Healthcare Organizations Their Most Effective Clinicians", author:{name:"Aisha Patel",initials:"AP",color:"#db2777"}, date:"Jun 19", readMin:6, impressions:1980, hot:false },
];

function MobileHeader() {
  return (
    <header style={{ background:"white", borderBottom:"1px solid #f3f4f6", position:"sticky", top:0, zIndex:50 }}>
      <div style={{ padding:"0 16px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ background:NAVY, borderRadius:6, width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="white" opacity="0.9"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill={ORANGE} opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontWeight:700, fontSize:14 }}>Hire<span style={{ color:ORANGE }}>'in</span> Solutions</div>
            <div style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:8, letterSpacing:"0.05em", textTransform:"uppercase" }}>A Rayomind Company</div>
          </div>
        </div>
        <button style={{ display:"flex", flexDirection:"column", gap:4, padding:4 }}>
          <span style={{ display:"block", width:20, height:2, background:"#374151", borderRadius:1 }}/>
          <span style={{ display:"block", width:20, height:2, background:"#374151", borderRadius:1 }}/>
          <span style={{ display:"block", width:20, height:2, background:"#374151", borderRadius:1 }}/>
        </button>
      </div>
    </header>
  );
}

function MobileFilterStrip() {
  const filters = ["All","Healthcare","Technology","Engineering","Talent Strategy"];
  return (
    <div style={{ background:"white", borderBottom:"1px solid #f3f4f6", overflowX:"auto" }}>
      <div style={{ display:"flex", gap:6, padding:"8px 16px", whiteSpace:"nowrap" }}>
        {filters.map((f,i)=>(
          <button key={f} style={{ fontFamily:"'Inter',sans-serif", background:i===1?NAVY:"transparent", color:i===1?"white":"#6b7280", border:i===1?`1px solid ${NAVY}`:"1px solid transparent", fontSize:11, fontWeight:500, padding:"4px 12px", borderRadius:999 }}>
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function FeaturedMobile({ article }: { article: typeof ARTICLES[0] }) {
  const typeColor = TYPE_COLORS[article.type] || NAVY;
  return (
    <div style={{ margin:"16px 16px 0", borderRadius:14, overflow:"hidden", border:"1px solid #f3f4f6", cursor:"pointer" }}>
      {/* Visual bar */}
      <div style={{ height:130, background:`linear-gradient(140deg,${NAVY_DARK} 0%,${NAVY} 60%,#2a4d8f 100%)`, position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle,white 1px,transparent 1px)", backgroundSize:"24px 24px", opacity:0.07 }}/>
        <div style={{ position:"absolute", top:10, left:10, display:"flex", gap:6 }}>
          <span style={{ background:"rgba(0,0,0,0.3)", color:"white", fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Pinned</span>
          <span style={{ background:typeColor+"30", color:typeColor, border:`1px solid ${typeColor}50`, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>{article.type}</span>
        </div>
        <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"white", fontSize:14, fontWeight:600, textAlign:"center", lineHeight:1.4, padding:"0 24px", opacity:0.9 }}>
          "{article.title.split("—")[0].trim()}"
        </p>
      </div>
      {/* Content */}
      <div style={{ padding:"14px 14px 14px" }}>
        <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", color:NAVY, fontSize:15, fontWeight:700, lineHeight:1.3, marginBottom:10 }}>{article.title}</h2>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:article.author.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontSize:9, fontWeight:700 }}>{article.author.initials}</span>
            </div>
            <div>
              <p style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontSize:11, fontWeight:600, lineHeight:1.1 }}>{article.author.name}</p>
              <p style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:9, lineHeight:1.1 }}>{article.date}</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10, display:"flex", alignItems:"center", gap:3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{article.readMin} min
            </span>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10, display:"flex", alignItems:"center", gap:3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>{(article.impressions/1000).toFixed(1)}k
            </span>
            {article.hot && <span style={{ fontFamily:"'Inter',sans-serif", color:ORANGE, fontSize:9, fontWeight:700 }}>🔥</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleCardMobile({ article, rank }: { article: typeof ARTICLES[0]; rank: number }) {
  const typeColor = TYPE_COLORS[article.type] || NAVY;
  return (
    <div style={{ padding:"14px 16px", borderBottom:"1px solid #f9fafb", cursor:"pointer", display:"flex", gap:10 }}>
      {/* Rank */}
      <div style={{ width:22, flexShrink:0, paddingTop:2 }}>
        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:rank<=2?ORANGE:"#d1d5db" }}>{String(rank).padStart(2,"0")}</span>
      </div>
      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Type + badges */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:typeColor, textTransform:"uppercase", letterSpacing:"0.06em" }}>{article.type}</span>
          {article.hot && <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:ORANGE }}>🔥 Trending</span>}
        </div>
        {/* Title */}
        <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:NAVY, fontSize:13, fontWeight:700, lineHeight:1.35, marginBottom:8 }}>{article.title}</p>
        {/* Meta row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:20, height:20, borderRadius:"50%", background:article.author.color, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontSize:7, fontWeight:700 }}>{article.author.initials}</span>
            </div>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"#6b7280", fontSize:10, fontWeight:500 }}>{article.author.name}</span>
            <span style={{ color:"#d1d5db", fontSize:10 }}>·</span>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10 }}>{article.date}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10 }}>{article.readMin} min</span>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:10, display:"flex", alignItems:"center", gap:2 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              {(article.impressions/1000).toFixed(1)}k
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InsightsListViewMobile() {
  const [featured, ...rest] = ARTICLES;
  return (
    <div style={{ minHeight:"100vh", background:"white", maxWidth:390, margin:"0 auto", overflow:"hidden" }}>
      <link rel="stylesheet" media="print" onLoad={(e:any)=>{e.target.media="all";}}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap"/>
      <MobileHeader/>
      <MobileFilterStrip/>

      {/* Section title */}
      <div style={{ padding:"14px 16px 0", display:"flex", alignItems:"baseline", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", color:NAVY, fontSize:22, fontWeight:700, lineHeight:1.2 }}>Healthcare Insights</h1>
          <p style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:11, marginTop:2 }}>{ARTICLES.length} articles · by relevance</p>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          <button style={{ padding:6, border:"1px solid #e5e7eb", borderRadius:6, background:NAVY }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <button style={{ padding:6, border:"1px solid #e5e7eb", borderRadius:6, background:"white" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          </button>
        </div>
      </div>

      <FeaturedMobile article={featured}/>

      <div style={{ marginTop:16 }}>
        <div style={{ padding:"0 16px 8px", borderBottom:"1px solid #f3f4f6" }}>
          <div style={{ display:"flex", gap:16 }}>
            {["#","Article","Views"].map(h=><span key={h} style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</span>)}
          </div>
        </div>
        {rest.map((a,i)=><ArticleCardMobile key={a.id} article={a} rank={i+2}/>)}
      </div>

      {/* Load more */}
      <div style={{ padding:"20px 16px 24px", display:"flex", justifyContent:"center" }}>
        <button style={{ border:`1.5px solid ${NAVY}`, color:NAVY, fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, padding:"10px 24px", borderRadius:999, background:"white", display:"flex", alignItems:"center", gap:6 }}>
          Load more <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>

      {/* Newsletter strip */}
      <div style={{ margin:"0 16px 24px", borderRadius:12, background:`linear-gradient(135deg,${NAVY_DARK} 0%,${NAVY} 100%)`, padding:"18px 16px" }}>
        <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"white", fontSize:16, fontWeight:700, marginBottom:6 }}>Get insights in your inbox</p>
        <p style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.6)", fontSize:12, lineHeight:1.55, marginBottom:12 }}>Weekly digest of our best healthcare and talent strategy content.</p>
        <input type="email" placeholder="your@company.com" style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"none", background:"rgba(255,255,255,0.12)", color:"white", fontFamily:"'Inter',sans-serif", fontSize:12, marginBottom:8, boxSizing:"border-box" }}/>
        <button style={{ width:"100%", padding:"10px", borderRadius:8, background:ORANGE, color:"white", fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, border:"none" }}>Subscribe Free →</button>
      </div>

      <footer style={{ background:NAVY_DARK, padding:"16px" }}>
        <p style={{ fontFamily:"'Inter',sans-serif", color:"white", fontWeight:700, fontSize:12, marginBottom:8 }}>Hire<span style={{ color:ORANGE }}>'in</span> Solutions</p>
        <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
          {["Privacy","Terms","Contact","Subscribe"].map(l=><span key={l} style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.35)", fontSize:10 }}>{l}</span>)}
        </div>
      </footer>
    </div>
  );
}
