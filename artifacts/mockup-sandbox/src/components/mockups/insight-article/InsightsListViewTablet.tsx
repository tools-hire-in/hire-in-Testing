const NAVY = "#1F3A6E";
const NAVY_DARK = "#162d56";
const ORANGE = "#F47C20";

const TYPE_COLORS: Record<string, { bg:string; text:string; border:string }> = {
  "Executive Insight": { bg:ORANGE+"14", text:ORANGE, border:ORANGE+"30" },
  "Analysis":   { bg:"#3b82f614", text:"#3b82f6", border:"#3b82f630" },
  "Field Report": { bg:"#10b98114", text:"#059669", border:"#10b98130" },
  "Case Study": { bg:"#8b5cf614", text:"#7c3aed", border:"#8b5cf630" },
  "Market Brief": { bg:"#6b728014", text:"#4b5563", border:"#6b728030" },
  "Opinion":    { bg:"#ec489914", text:"#db2777", border:"#ec489930" },
};

const ARTICLES = [
  { id:1, type:"Executive Insight", title:"Why Healthcare Systems Are Losing Top Clinical Talent — And the Three Shifts That Will Stop the Bleeding", deck:"Burnout alone doesn't explain the exodus. A deeper structural misalignment is quietly accelerating a workforce crisis.", author:{name:"Kavita Sharma",initials:"KS",color:NAVY}, date:"Jul 11, 2025", readMin:8, impressions:4820, hot:true, accentColor:`linear-gradient(140deg,${NAVY_DARK} 0%,${NAVY} 60%)` },
  { id:2, type:"Analysis", title:"AI-Augmented Screening: What 18 Months of Data Actually Shows About Quality-of-Hire", deck:"Firms that adopted structured AI screening saw 31% improvement in 90-day retention.", author:{name:"Ravi Mehta",initials:"RM",color:"#4B7BEC"}, date:"Jul 8, 2025", readMin:11, impressions:3210, hot:false, accentColor:"linear-gradient(135deg,#1d4ed8 0%,#3b82f6 100%)" },
  { id:3, type:"Field Report", title:"Inside Three Rural Health Systems That Cracked the Nursing Retention Puzzle", deck:"A 14-month field study across Missouri, Montana, and Kentucky reveals counterintuitive findings.", author:{name:"Priya Nair",initials:"PN",color:"#059669"}, date:"Jul 5, 2025", readMin:9, impressions:2840, hot:false, accentColor:"linear-gradient(135deg,#065f46 0%,#10b981 100%)" },
  { id:4, type:"Case Study", title:"From 42% to 78%: How Memorial Health Rebuilt Its Travel Nurse Pipeline in 11 Months", deck:"A strategic partnership redesign and internal mobility program produced surprising results.", author:{name:"James Okafor",initials:"JO",color:"#7c3aed"}, date:"Jun 30, 2025", readMin:7, impressions:2190, hot:false, accentColor:"linear-gradient(135deg,#4c1d95 0%,#8b5cf6 100%)" },
  { id:5, type:"Market Brief", title:"Q2 2025 Healthcare Staffing Index: Demand Surges in Radiology and Respiratory Therapy", deck:"RT vacancies up 47% YoY with no supply-side relief in sight.", author:{name:"Kavita Sharma",initials:"KS",color:NAVY}, date:"Jun 24, 2025", readMin:4, impressions:5670, hot:true, accentColor:"linear-gradient(135deg,#374151 0%,#6b7280 100%)" },
  { id:6, type:"Opinion", title:"The 'Culture Fit' Trap Is Costing Healthcare Organizations Their Most Effective Clinicians", deck:"When 'culture fit' becomes a proxy for familiarity, it systematically filters out experienced candidates.", author:{name:"Aisha Patel",initials:"AP",color:"#db2777"}, date:"Jun 19, 2025", readMin:6, impressions:1980, hot:false, accentColor:"linear-gradient(135deg,#831843 0%,#ec4899 100%)" },
];

function TabletHeader() {
  const nav = ["Home","About","Services","Contracts","Jobs","Insights","Contact"];
  return (
    <header style={{ background:"white", borderBottom:"1px solid #f3f4f6", position:"sticky", top:0, zIndex:50 }}>
      <div style={{ padding:"0 24px", height:56, display:"flex", alignItems:"center", gap:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <div style={{ background:NAVY, borderRadius:7, width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" fill="white" opacity="0.9"/>
              <rect x="14" y="3" width="7" height="7" rx="1" fill="white" opacity="0.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1" fill="white" opacity="0.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1" fill={ORANGE} opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontWeight:700, fontSize:15 }}>Hire<span style={{ color:ORANGE }}>'in</span> Solutions</div>
            <div style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:8, letterSpacing:"0.06em", textTransform:"uppercase", marginTop:2 }}>A Rayomind Company | Est. 2014</div>
          </div>
        </div>
        <nav style={{ display:"flex", alignItems:"center", gap:14, flex:1 }}>
          {nav.map(item=>(
            <span key={item} style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:item==="Insights"?600:500, color:item==="Insights"?NAVY:"#4b5563", borderBottom:item==="Insights"?`2px solid ${ORANGE}`:"2px solid transparent", paddingBottom:2, cursor:"pointer", whiteSpace:"nowrap" }}>{item}</span>
          ))}
        </nav>
        <button style={{ background:ORANGE, color:"white", fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, padding:"7px 14px", borderRadius:6, flexShrink:0, border:"none" }}>Get a Quote</button>
      </div>
    </header>
  );
}

function TabletFilterStrip() {
  const filters = ["All Insights","Healthcare","Technology","Engineering","Professional Services","Talent Strategy"];
  return (
    <div style={{ background:"white", borderBottom:"1px solid #f3f4f6", overflowX:"auto" }}>
      <div style={{ padding:"0 24px", display:"flex", alignItems:"center", gap:4 }}>
        {filters.map((f,i)=>(
          <button key={f} style={{ fontFamily:"'Inter',sans-serif", background:i===1?NAVY:"transparent", color:i===1?"white":"#6b7280", border:i===1?`1px solid ${NAVY}`:"1px solid transparent", fontSize:11, fontWeight:500, padding:"5px 12px", borderRadius:999, flexShrink:0, margin:"6px 0" }}>{f}</button>
        ))}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type:string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS["Market Brief"];
  return <span style={{ background:c.bg, color:c.text, border:`1px solid ${c.border}`, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", padding:"2px 7px", borderRadius:4 }}>{type}</span>;
}

function FeaturedTablet({ article }: { article: typeof ARTICLES[0] }) {
  return (
    <div style={{ display:"flex", borderRadius:16, overflow:"hidden", border:"1px solid #f3f4f6", marginBottom:20, cursor:"pointer" }}>
      <div style={{ width:220, flexShrink:0, background:article.accentColor, position:"relative", minHeight:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(circle,white 1px,transparent 1px)", backgroundSize:"24px 24px", opacity:0.07 }}/>
        <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:"white", fontSize:16, fontWeight:600, textAlign:"center", lineHeight:1.4, padding:"0 20px", position:"relative", zIndex:1 }}>Featured</p>
        <div style={{ position:"absolute", top:10, left:10 }}>
          <span style={{ background:"rgba(0,0,0,0.3)", color:"white", fontFamily:"'Inter',sans-serif", fontSize:8, fontWeight:700, padding:"2px 6px", borderRadius:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Pinned</span>
        </div>
      </div>
      <div style={{ flex:1, padding:"20px", background:"white", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <TypeBadge type={article.type}/>
            <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"#9ca3af" }}>{article.date}</span>
            {article.hot && <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:ORANGE }}>🔥 Trending</span>}
          </div>
          <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", color:NAVY, fontSize:18, fontWeight:700, lineHeight:1.3, marginBottom:8 }}>{article.title}</h2>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"#6b7280", lineHeight:1.6, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{article.deck}</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:12, borderTop:"1px solid #f9fafb", marginTop:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:article.author.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontSize:9, fontWeight:700 }}>{article.author.initials}</span>
            </div>
            <div>
              <p style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontSize:11, fontWeight:600, lineHeight:1.1 }}>{article.author.name}</p>
              <p style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:9 }}>{article.readMin} min · {(article.impressions/1000).toFixed(1)}k views</p>
            </div>
          </div>
          <button style={{ background:NAVY, color:"white", fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, padding:"6px 14px", borderRadius:999, border:"none" }}>Read →</button>
        </div>
      </div>
    </div>
  );
}

function ArticleRowTablet({ article, rank }: { article:typeof ARTICLES[0]; rank:number }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 0", borderBottom:"1px solid #f9fafb", cursor:"pointer" }}>
      <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:rank<=2?ORANGE:"#d1d5db", flexShrink:0, width:24, paddingTop:2 }}>{String(rank).padStart(2,"0")}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
          <TypeBadge type={article.type}/>
          {article.hot && <span style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:ORANGE, fontWeight:700 }}>🔥</span>}
        </div>
        <p style={{ fontFamily:"'Playfair Display',Georgia,serif", color:NAVY, fontSize:14, fontWeight:700, lineHeight:1.35, marginBottom:6 }}>{article.title}</p>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"#9ca3af", lineHeight:1.4, marginBottom:0, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:1, WebkitBoxOrient:"vertical" }}>{article.deck}</p>
      </div>
      <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, minWidth:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:22, height:22, borderRadius:"50%", background:article.author.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontSize:7, fontWeight:700 }}>{article.author.initials}</span>
          </div>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:NAVY, fontWeight:500 }}>{article.author.name.split(" ")[0]}</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:"#9ca3af" }}>{article.readMin} min</span>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:"#9ca3af" }}>{(article.impressions/1000).toFixed(1)}k</span>
        </div>
      </div>
    </div>
  );
}

export function InsightsListViewTablet() {
  const [featured, ...rest] = ARTICLES;
  return (
    <div style={{ minHeight:"100vh", background:"white", maxWidth:768, margin:"0 auto", overflow:"hidden" }}>
      <link rel="stylesheet" media="print" onLoad={(e:any)=>{e.target.media="all";}}
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Inter:wght@300;400;500;600;700&display=swap"/>
      <TabletHeader/>
      <TabletFilterStrip/>

      <div style={{ padding:"20px 24px 0" }}>
        {/* Section title row */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", color:NAVY, fontSize:26, fontWeight:700 }}>Healthcare Insights</h1>
            <p style={{ fontFamily:"'Inter',sans-serif", color:"#9ca3af", fontSize:12, marginTop:2 }}>{ARTICLES.length} articles · sorted by relevance</p>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", border:"1px solid #e5e7eb", borderRadius:999, fontFamily:"'Inter',sans-serif", fontSize:11, color:"#6b7280", cursor:"pointer" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
              Relevance
            </div>
            <div style={{ display:"flex", borderRadius:999, border:"1px solid #e5e7eb", overflow:"hidden" }}>
              <button style={{ padding:"6px 8px", background:NAVY, border:"none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <button style={{ padding:"6px 8px", background:"white", border:"none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
            </div>
          </div>
        </div>

        <FeaturedTablet article={featured}/>

        {/* List header */}
        <div style={{ display:"flex", gap:12, padding:"6px 0 8px", borderBottom:"1px solid #f3f4f6" }}>
          <span style={{ width:24, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.07em" }}>#</span>
          <span style={{ flex:1, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.07em" }}>Article</span>
          <span style={{ minWidth:100, fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.07em", textAlign:"right" }}>Author · Stats</span>
        </div>
        {rest.map((a,i)=><ArticleRowTablet key={a.id} article={a} rank={i+2}/>)}

        {/* Load more */}
        <div style={{ padding:"20px 0 24px", display:"flex", justifyContent:"center" }}>
          <button style={{ border:`1.5px solid ${NAVY}`, color:NAVY, fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, padding:"10px 24px", borderRadius:999, background:"white", display:"flex", alignItems:"center", gap:6 }}>
            Load more articles <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        {/* Trending topics — horizontal at tablet (no sidebar) */}
        <div style={{ paddingBottom:24 }}>
          <p style={{ fontFamily:"'Inter',sans-serif", color:NAVY, fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ display:"inline-block", width:10, height:2, background:ORANGE, borderRadius:1 }}/>Trending Topics
          </p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {["Nursing retention","AI screening","Rural healthcare","Executive search","Salary benchmarks","DEI hiring","Leadership pipeline","Travel nursing"].map(t=>(
              <button key={t} style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:500, padding:"5px 12px", borderRadius:999, border:"1px solid #e5e7eb", color:"#6b7280", background:"#f9fafb", cursor:"pointer" }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <footer style={{ background:NAVY_DARK, padding:"20px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontFamily:"'Inter',sans-serif", color:"white", fontWeight:700, fontSize:13 }}>Hire<span style={{ color:ORANGE }}>'in</span> Solutions</span>
        <div style={{ display:"flex", gap:20 }}>{["Privacy","Terms","Contact"].map(l=><span key={l} style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.35)", fontSize:11 }}>{l}</span>)}</div>
        <p style={{ fontFamily:"'Inter',sans-serif", color:"rgba(255,255,255,0.2)", fontSize:10 }}>© 2025</p>
      </footer>
    </div>
  );
}
