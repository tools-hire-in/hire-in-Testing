// Insights Studio UX Flow Canvas
// Canvas visualization of the complete editorial overlay changes
// Row 1: Flow 1 (Idea→Article swimlane) + Flow 2 (Creation dialog before/after)
// Row 2: Flow 3 (Editor state transformation)
// Row 3: Flow 4 (Calendar changes)
// Row 4: Form Panel 1 (Import pipeline) + Form Panel 2 (Field change matrix)

const NAVY = "#1F3A6E";
const ORANGE = "#F47C20";
const WHITE = "#FFFFFF";
const SOFT_GRAY = "#F7F8FA";
const BORDER = "#E2E8F0";

// Status colour tokens
const C_PLANNING = { bg: "#E8EAF6", text: "#3949AB", border: "#9FA8DA" };
const C_DRAFT     = { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" };
const C_REVIEW    = { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" };
const C_APPROVED  = { bg: "#D1FAE5", text: "#065F46", border: "#6EE7B7" };
const C_PUBLISHED = { bg: "#EDE9FE", text: "#4C1D95", border: "#C4B5FD" };
const C_GATE      = { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA" };
const C_NEW       = { bg: "#E0F2FE", text: "#0C4A6E", border: "#7DD3FC" };
const C_UNCHANGED = { bg: "#F0FDF4", text: "#166534", border: "#86EFAC" };

const font = "'Inter', system-ui, sans-serif";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: font,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      color: "#64748B",
      marginBottom: 16,
      paddingBottom: 8,
      borderBottom: `2px solid ${BORDER}`,
    }}>
      {children}
    </div>
  );
}

// ─── Flow 1: Idea → Article Swimlane ────────────────────────────────────────

function FlowBox({
  label, sub, colors, width = 120,
}: {
  label: string;
  sub?: string;
  colors: { bg: string; text: string; border: string };
  width?: number;
}) {
  return (
    <div style={{
      background: colors.bg,
      border: `1.5px solid ${colors.border}`,
      borderRadius: 8,
      padding: "8px 12px",
      minWidth: width,
      textAlign: "center" as const,
      fontFamily: font,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: colors.text, opacity: 0.75, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Arrow({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ flex: 1, height: 1, background: "#94A3B8" }} />
      <svg width="10" height="10" viewBox="0 0 10 10">
        <path d="M0 5 L8 5 M5 2 L8 5 L5 8" stroke="#94A3B8" strokeWidth="1.5" fill="none" />
      </svg>
      {label && <div style={{ fontSize: 9, color: "#64748B", marginLeft: 2, whiteSpace: "nowrap" as const }}>{label}</div>}
    </div>
  );
}

function Flow1() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 20,
      fontFamily: font,
      flex: 1,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        Flow 1 — Idea to Article
      </div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>
        Current single-gate path vs. Insights three-gate path
      </div>

      {/* Current path */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
          color: "#64748B", marginBottom: 8,
          background: "#F8FAFC", padding: "4px 8px", borderRadius: 4, display: "inline-block",
        }}>Current — single gate</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
          <FlowBox label="Idea" sub="Idea bank" colors={C_DRAFT} width={90} />
          <Arrow />
          <FlowBox label="Create dialog" sub="Fill fields" colors={C_DRAFT} width={100} />
          <Arrow />
          <FlowBox label="AI Generate" sub="Brief → Draft" colors={C_DRAFT} width={100} />
          <Arrow />
          <FlowBox label="Draft" colors={C_DRAFT} width={80} />
          <Arrow />
          <FlowBox label="Workflow" sub="Review → Approve" colors={C_REVIEW} width={110} />
          <Arrow />
          <FlowBox label="Published" colors={C_PUBLISHED} width={90} />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "#E2E8F0", margin: "12px 0" }} />

      {/* Insights path */}
      <div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const,
          color: C_PLANNING.text, marginBottom: 8,
          background: C_PLANNING.bg, padding: "4px 8px", borderRadius: 4, display: "inline-block",
          border: `1px solid ${C_PLANNING.border}`,
        }}>Insights — three-gate path</div>

        {/* Row 1: shared start → branch point */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" as const }}>
          <FlowBox label="Idea" sub="Idea bank" colors={C_DRAFT} width={90} />
          <Arrow />
          <FlowBox label="Create dialog" sub="Insights type selected" colors={C_NEW} width={130} />
          <div style={{ fontSize: 18, color: "#94A3B8", marginLeft: 2 }}>⤵</div>
          <div style={{ fontSize: 10, color: "#64748B", background: "#FFF3CD", border: "1px solid #FDE68A", borderRadius: 4, padding: "3px 6px" }}>
            ← branch point
          </div>
        </div>

        {/* Insights-only steps */}
        <div style={{ marginLeft: 48, display: "flex", flexDirection: "column" as const, gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
            <div style={{ fontSize: 10, color: "#64748B", width: 70 }}>Call 1 Planning</div>
            <Arrow />
            <FlowBox label="PLANNING_REVIEW" sub="Awaiting editorial direction" colors={C_PLANNING} width={160} />
            <Arrow label="Gate A" />
            <FlowBox label="Gate A review" sub="4-section panel" colors={C_GATE} width={120} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 74, flexWrap: "wrap" as const }}>
            <Arrow label="Approved" />
            <FlowBox label="Draft" sub="with Approved Brief" colors={C_DRAFT} width={120} />
            <Arrow />
            <FlowBox label="Workflow" sub="same as standard" colors={C_REVIEW} width={120} />
            <Arrow />
            <FlowBox label="Published" colors={C_PUBLISHED} width={90} />
          </div>
          <div style={{ marginLeft: 74 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                fontSize: 10, color: "#64748B", background: "#FEF2F2", border: "1px solid #FCA5A5",
                borderRadius: 4, padding: "3px 8px",
              }}>
                Non-Insights: skips Gate A → goes straight to Draft
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Flow 2: Creation Dialog Before / After ──────────────────────────────────

function DialogField({
  label, placeholder, changed, isNew,
}: {
  label: string;
  placeholder?: string;
  changed?: boolean;
  isNew?: boolean;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{label}</div>
        {changed && (
          <span style={{ fontSize: 9, fontWeight: 700, background: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D", borderRadius: 3, padding: "1px 4px" }}>
            RENAMED
          </span>
        )}
        {isNew && (
          <span style={{ fontSize: 9, fontWeight: 700, background: C_NEW.bg, color: C_NEW.text, border: `1px solid ${C_NEW.border}`, borderRadius: 3, padding: "1px 4px" }}>
            NEW
          </span>
        )}
      </div>
      <div style={{
        border: `1px solid ${changed ? "#FCD34D" : isNew ? C_NEW.border : BORDER}`,
        background: changed ? "#FFFBEB" : isNew ? "#F0F9FF" : WHITE,
        borderRadius: 6,
        padding: "7px 10px",
        fontSize: 11,
        color: "#94A3B8",
        fontStyle: "italic",
      }}>
        {placeholder || "—"}
      </div>
    </div>
  );
}

function Flow2() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 20,
      fontFamily: font,
      flex: 1,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        Flow 2 — Article Creation Dialog
      </div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>
        Form fields before and after an Insights type is selected
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Before */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em",
            color: "#64748B", background: "#F8FAFC", borderRadius: 4, padding: "4px 8px", marginBottom: 12,
          }}>Before</div>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, background: SOFT_GRAY }}>
            <DialogField label="Title" placeholder="Enter article title…" />
            <DialogField label="Content Type" placeholder="Quick Take ▾" />
            <DialogField label="Audience" placeholder="Select audience…" />
            <DialogField label="Content Goal" placeholder="Select goal…" />
            <DialogField label="Generation Brief" placeholder="Describe the angle…" />
            <DialogField label="Domain" placeholder="IT Staffing ▾" />
            <DialogField label="Planned Date" placeholder="2026-07-30" />
            <div style={{
              background: NAVY, color: WHITE, textAlign: "center" as const,
              padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, marginTop: 4,
            }}>
              Create Article
            </div>
          </div>
        </div>

        {/* After */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em",
            color: C_PLANNING.text, background: C_PLANNING.bg, borderRadius: 4, padding: "4px 8px", marginBottom: 12,
            border: `1px solid ${C_PLANNING.border}`,
          }}>After — Insights type selected</div>
          <div style={{ border: `1px solid ${C_PLANNING.border}`, borderRadius: 8, padding: 12, background: "#F5F7FF" }}>
            <DialogField label="Title" placeholder="Enter article title…" />
            <DialogField label="Content Type" placeholder="FLAGSHIP_INSIGHT ▾" />
            <DialogField label="Primary Reader" placeholder="Staffing / MSP Operator…" changed />
            <DialogField label="Primary Reader Question" placeholder="What is the core question?" changed />
            <DialogField label="Why This Matters Now" placeholder="The timely context…" changed />
            <DialogField label="Domain" placeholder="IT Staffing ▾" />
            <DialogField label="Mode" placeholder="Mode A / B / C" isNew />
            <DialogField label="Planned Date" placeholder="2026-07-30" />
            <div style={{
              background: C_PLANNING.text, color: WHITE, textAlign: "center" as const,
              padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, marginTop: 4,
            }}>
              Run Editorial Strategy
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" as const }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 10, color: "#64748B" }}>Renamed field</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#F0F9FF", border: `1px solid ${C_NEW.border}`, borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 10, color: "#64748B" }}>New field</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 10, color: "#64748B" }}>Unchanged</span>
        </div>
      </div>
    </div>
  );
}

// ─── Flow 3: Editor State Transformation ────────────────────────────────────

function StateChip({
  label, colors, gate,
}: {
  label: string;
  colors: { bg: string; text: string; border: string };
  gate?: boolean;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
    }}>
      {gate && (
        <div style={{
          fontSize: 9, fontWeight: 700, color: C_GATE.text, background: C_GATE.bg,
          border: `1px solid ${C_GATE.border}`, borderRadius: 3, padding: "1px 5px",
        }}>
          GATE
        </div>
      )}
      <div style={{
        background: colors.bg, border: `1.5px solid ${colors.border}`,
        borderRadius: 6, padding: "5px 10px",
        fontSize: 11, fontWeight: 600, color: colors.text,
        textAlign: "center" as const, minWidth: 90,
      }}>
        {label}
      </div>
    </div>
  );
}

function ThinArrow() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" style={{ flexShrink: 0 }}>
      <path d="M0 6 L14 6 M10 2 L14 6 L10 10" stroke="#CBD5E1" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function Flow3() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 20,
      fontFamily: font,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        Flow 3 — Article Editor State Transformation
      </div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 20 }}>
        Top row: current states · Bottom row: Insights states (new PLANNING_REVIEW insertion point)
      </div>

      {/* Current states */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748B", marginBottom: 10 }}>
          Current states
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          <StateChip label="Draft" colors={C_DRAFT} />
          <ThinArrow />
          <StateChip label="In Review" colors={C_REVIEW} />
          <ThinArrow />
          <StateChip label="CM Review" colors={{ bg: "#E0F2FE", text: "#0C4A6E", border: "#7DD3FC" }} />
          <ThinArrow />
          <StateChip label="Author Sign-Off" colors={{ bg: "#EDE9FE", text: "#5B21B6", border: "#C4B5FD" }} />
          <ThinArrow />
          <StateChip label="Marketing" colors={{ bg: "#FDF4FF", text: "#701A75", border: "#E879F9" }} />
          <ThinArrow />
          <StateChip label="Final Approval" colors={{ bg: "#FFF1F2", text: "#9F1239", border: "#FDA4AF" }} />
          <ThinArrow />
          <StateChip label="Published" colors={C_PUBLISHED} />
        </div>
      </div>

      {/* Insights states */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: C_PLANNING.text, marginBottom: 10 }}>
          Insights states — with gate insertion
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" as const }}>
          <StateChip label="PLANNING_REVIEW" colors={C_PLANNING} />
          <ThinArrow />
          <StateChip label="Gate A" colors={C_GATE} gate />
          <ThinArrow />
          <StateChip label="Draft" colors={C_DRAFT} />
          <ThinArrow />
          <StateChip label="In Review" colors={C_REVIEW} />
          <ThinArrow />
          <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>…same as current…</div>
          <ThinArrow />
          <StateChip label="Published" colors={C_PUBLISHED} />
        </div>
      </div>

      {/* Gate A panel expanded */}
      <div style={{ display: "flex", gap: 16 }}>
        {/* Gate A card */}
        <div style={{
          flex: 1.2, border: `1.5px solid ${C_GATE.border}`, borderRadius: 10, overflow: "hidden",
        }}>
          <div style={{
            background: C_GATE.bg, borderBottom: `1px solid ${C_GATE.border}`,
            padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C_GATE.text }}>Gate A — Editorial Review Panel</div>
              <div style={{ fontSize: 10, color: C_GATE.text, opacity: 0.8 }}>Shown when article is in PLANNING_REVIEW state</div>
            </div>
          </div>
          <div style={{ padding: 14, background: "#FFFDF9" }}>
            {[
              { icon: "📋", label: "Editorial Brief", desc: "Primary reader, question, why-now context" },
              { icon: "🔍", label: "Stakeholder Scan", desc: "Who else is affected, adjacent audiences" },
              { icon: "❓", label: "Research Questions", desc: "Open questions needing editorial input" },
              { icon: "📐", label: "Outline Recommendation", desc: "AI-suggested article structure" },
            ].map((s) => (
              <div key={s.label} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "8px 0", borderBottom: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: "#64748B" }}>{s.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <div style={{ background: C_APPROVED.bg, border: `1px solid ${C_APPROVED.border}`, borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: C_APPROVED.text }}>
                ✓ Approve
              </div>
              <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#92400E" }}>
                ↩ Revise
              </div>
              <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#991B1B" }}>
                ✕ Reject
              </div>
            </div>
          </div>
        </div>

        {/* AI Generation Brief transformation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "#F8FAFC", borderBottom: `1px solid ${BORDER}`, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>AI Generation Brief — Current form</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>Psychological brief fields (standard)</div>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {["Hook Pattern", "Content Structure", "Desired Emotion", "Engagement Goal", "Generation Brief"].map((f) => (
                <div key={f} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "4px 8px", background: "#F8FAFC", borderRadius: 4,
                }}>
                  <span style={{ fontSize: 10, color: "#374151" }}>{f}</span>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>editable</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ textAlign: "center" as const, color: "#64748B", fontSize: 12 }}>↓ after Gate A approval</div>

          <div style={{ border: `1.5px solid ${C_PLANNING.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: C_PLANNING.bg, borderBottom: `1px solid ${C_PLANNING.border}`, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C_PLANNING.text }}>AI Generation Brief — Insights form</div>
              <div style={{ fontSize: 10, color: C_PLANNING.text, opacity: 0.8 }}>Approved Brief replaces free-form fields</div>
            </div>
            <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {[
                { name: "Approved Brief", note: "read-only summary", highlight: true },
                { name: "Hook Pattern", note: "pre-filled from Gate A", highlight: true },
                { name: "Content Structure", note: "pre-filled from Gate A", highlight: true },
                { name: "Desired Emotion", note: "hidden / N/A", removed: true },
                { name: "Generation Brief", note: "hidden / N/A", removed: true },
              ].map((f) => (
                <div key={f.name} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "4px 8px",
                  background: f.removed ? "#FEF2F2" : f.highlight ? C_PLANNING.bg : "#F8FAFC",
                  border: f.removed ? "1px solid #FCA5A5" : f.highlight ? `1px solid ${C_PLANNING.border}` : "none",
                  borderRadius: 4,
                  opacity: f.removed ? 0.6 : 1,
                }}>
                  <span style={{ fontSize: 10, color: f.removed ? "#991B1B" : f.highlight ? C_PLANNING.text : "#374151", textDecoration: f.removed ? "line-through" : "none" }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: 10, color: "#64748B" }}>{f.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Flow 4: Calendar Changes ────────────────────────────────────────────────

function CalendarCard({
  title, status, mode, colors, isInsights,
}: {
  title: string;
  status: string;
  mode?: string;
  colors: { bg: string; text: string; border: string };
  isInsights?: boolean;
}) {
  return (
    <div style={{
      background: colors.bg, border: `1.5px solid ${colors.border}`,
      borderRadius: 6, padding: "6px 8px", marginBottom: 4,
      fontFamily: font,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, flex: 1 }}>
          {title}
        </div>
        {mode && (
          <span style={{
            fontSize: 8, fontWeight: 700, background: NAVY, color: WHITE,
            borderRadius: 3, padding: "1px 4px", flexShrink: 0,
          }}>{mode}</span>
        )}
      </div>
      <div style={{ fontSize: 9, color: colors.text, opacity: 0.8, marginTop: 2 }}>{status}</div>
      {isInsights && (
        <div style={{ fontSize: 8, color: C_PLANNING.text, background: C_PLANNING.bg, borderRadius: 2, padding: "1px 3px", marginTop: 3, display: "inline-block" }}>
          Insights
        </div>
      )}
    </div>
  );
}

function CalDay({ day, children, shade }: { day: number; children?: React.ReactNode; shade?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${BORDER}`,
      borderRadius: 6,
      padding: "6px 6px 4px",
      minHeight: 80,
      background: shade ? "#FAFBFC" : WHITE,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 4 }}>{day}</div>
      {children}
    </div>
  );
}

function Flow4() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 20,
      fontFamily: font,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        Flow 4 — Calendar Changes
      </div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>
        New PLANNING_REVIEW badge, Mode A/B/C compact badge on Insights cards, and Insights filter group
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Calendar mock */}
        <div style={{ flex: 2 }}>
          {/* Weekday headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ fontSize: 10, fontWeight: 600, color: "#64748B", textAlign: "center" as const, padding: "3px 0" }}>{d}</div>
            ))}
          </div>
          {/* Week 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            <CalDay day={1} shade />
            <CalDay day={2} shade />
            <CalDay day={3} shade />
            <CalDay day={4}>
              <CalendarCard title="IT Hiring Trends" status="In Review" colors={C_REVIEW} />
            </CalDay>
            <CalDay day={5}>
              <CalendarCard title="Workforce 2026" status="Approved" colors={C_APPROVED} />
            </CalDay>
            <CalDay day={6}>
              <CalendarCard
                title="Staffing Intelligence"
                status="Planning Review"
                colors={C_PLANNING}
                isInsights
              />
            </CalDay>
            <CalDay day={7} shade />
          </div>
          {/* Week 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            <CalDay day={8} shade />
            <CalDay day={9}>
              <CalendarCard title="Talent Markets" status="Draft" colors={C_DRAFT} />
            </CalDay>
            <CalDay day={10}>
              <CalendarCard
                title="MSP Operator Guide"
                status="Planning Review"
                mode="A"
                colors={C_PLANNING}
                isInsights
              />
            </CalDay>
            <CalDay day={11} />
            <CalDay day={12}>
              <CalendarCard title="Job Marketing Tips" status="Published" colors={C_PUBLISHED} />
            </CalDay>
            <CalDay day={13}>
              <CalendarCard
                title="Decision Framework"
                status="Planning Review"
                mode="B"
                colors={C_PLANNING}
                isInsights
              />
            </CalDay>
            <CalDay day={14} shade />
          </div>
          {/* Week 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            <CalDay day={15} shade />
            <CalDay day={16}>
              <CalendarCard
                title="Staffing Scenarios"
                status="Gate A: approved"
                mode="C"
                colors={C_GATE}
                isInsights
              />
            </CalDay>
            <CalDay day={17} />
            <CalDay day={18}>
              <CalendarCard title="Healthcare Trends" status="In Review" colors={C_REVIEW} />
            </CalDay>
            <CalDay day={19} />
            <CalDay day={20}>
              <CalendarCard title="IT Recruiting Tips" status="Approved" colors={C_APPROVED} />
            </CalDay>
            <CalDay day={21} shade />
          </div>

          {/* Comparison annotation */}
          <div style={{
            marginTop: 16, border: `1px dashed ${BORDER}`,
            borderRadius: 8, padding: 12, background: "#FFFDF9",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
              📌 Same calendar slot — Standard vs. Insights card
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#64748B", marginBottom: 4 }}>Standard article card</div>
                <CalendarCard title="IT Hiring Trends" status="In Review" colors={C_REVIEW} />
              </div>
              <div style={{ fontSize: 18, color: "#94A3B8", alignSelf: "center" }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C_PLANNING.text, marginBottom: 4 }}>Insights article card</div>
                <CalendarCard
                  title="Staffing Intelligence Brief"
                  status="Planning Review"
                  mode="B"
                  colors={C_PLANNING}
                  isInsights
                />
                <div style={{ fontSize: 9, color: "#64748B", marginTop: 4 }}>
                  + blue-grey badge, Mode chip, "Insights" label
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        <div style={{ flex: 0.7 }}>
          <div style={{
            border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden",
          }}>
            <div style={{ background: NAVY, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: WHITE }}>Calendar Filters</div>
            </div>
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748B", marginBottom: 8 }}>
                Status
              </div>
              {[
                { label: "All statuses", checked: true },
                { label: "Planning Review", checked: false, color: C_PLANNING.text, isNew: true },
                { label: "In Review", checked: false, color: C_REVIEW.text },
                { label: "Approved", checked: false, color: C_APPROVED.text },
                { label: "Published", checked: false, color: C_PUBLISHED.text },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: f.checked ? NAVY : WHITE,
                    border: `1.5px solid ${f.checked ? NAVY : BORDER}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: f.color || "#374151" }}>{f.label}</span>
                  {f.isNew && (
                    <span style={{ fontSize: 8, fontWeight: 700, background: C_NEW.bg, color: C_NEW.text, border: `1px solid ${C_NEW.border}`, borderRadius: 2, padding: "1px 3px" }}>NEW</span>
                  )}
                </div>
              ))}

              <div style={{ height: 1, background: BORDER, margin: "12px 0" }} />

              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748B", marginBottom: 8 }}>
                Content Type
              </div>
              {[
                { label: "All types", checked: true },
                { label: "Standard Articles", checked: false },
              ].map((f) => (
                <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: f.checked ? NAVY : WHITE, border: `1.5px solid ${f.checked ? NAVY : BORDER}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#374151" }}>{f.label}</span>
                </div>
              ))}

              {/* NEW Insights group */}
              <div style={{
                border: `1.5px solid ${C_PLANNING.border}`, borderRadius: 6,
                overflow: "hidden", marginTop: 8,
              }}>
                <div style={{ background: C_PLANNING.bg, padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C_PLANNING.text }}>Insights Editorial</span>
                  <span style={{ fontSize: 8, fontWeight: 700, background: C_NEW.bg, color: C_NEW.text, border: `1px solid ${C_NEW.border}`, borderRadius: 2, padding: "1px 3px" }}>NEW GROUP</span>
                </div>
                <div style={{ padding: "6px 8px" }}>
                  {["FLAGSHIP_INSIGHT", "FIELD_SIGNAL", "DECISION_GUIDE", "RESEARCH_BRIEF"].map((t) => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: WHITE, border: `1px solid ${BORDER}`, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: "#374151" }}>{t.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 9, color: "#94A3B8", fontStyle: "italic" }}>+ 4 more types…</div>
                </div>
              </div>

              <div style={{ height: 1, background: BORDER, margin: "12px 0" }} />

              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#64748B", marginBottom: 8 }}>
                Mode
              </div>
              {["All modes", "Mode A — Focused", "Mode B — Primary+", "Mode C — System"].map((m, i) => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: i === 0 ? NAVY : WHITE, border: `1.5px solid ${i === 0 ? NAVY : BORDER}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "#374151" }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Panel 1: Import Pipeline ──────────────────────────────────────────

function ImportStep({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{
      background: C_UNCHANGED.bg, border: `1.5px solid ${C_UNCHANGED.border}`,
      borderRadius: 8, padding: "10px 14px", minWidth: 100, textAlign: "center" as const,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C_UNCHANGED.text }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C_UNCHANGED.text, opacity: 0.8, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FormPanel1() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 20,
      fontFamily: font,
      flex: 1,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        Form Panel 1 — Import Pipeline
      </div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>
        All import steps are unchanged. One optional future column noted.
      </div>

      {/* UNCHANGED banner */}
      <div style={{
        background: C_UNCHANGED.bg, border: `2px solid ${C_UNCHANGED.border}`,
        borderRadius: 8, padding: "8px 14px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>✓</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C_UNCHANGED.text }}>UNCHANGED</div>
          <div style={{ fontSize: 10, color: C_UNCHANGED.text, opacity: 0.8 }}>
            The entire import pipeline is unaffected by the Insights editorial overlay.
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 }}>
        <ImportStep label="Upload" sub="CSV / XLSX" />
        <Arrow />
        <ImportStep label="Preview" sub="Row validation" />
        <Arrow />
        <ImportStep label="Map" sub="Header mapping" />
        <Arrow />
        <ImportStep label="Commit" sub="Bulk insert" />
        <Arrow />
        <ImportStep label="Rollback" sub="Error recovery" />
      </div>

      {/* Future annotation */}
      <div style={{
        border: `1px dashed #FCD34D`, borderRadius: 8, padding: 12, background: "#FFFBEB",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>
          🔮 Future-state annotation (not a current change)
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#374151", marginBottom: 4 }}>
              During the <strong>Map</strong> step, an optional column may appear:
            </div>
            <div style={{
              background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 4,
              padding: "6px 10px", fontSize: 10, color: "#92400E", fontFamily: "monospace",
            }}>
              insights_type &nbsp;→&nbsp; FLAGSHIP_INSIGHT | FIELD_SIGNAL | … | (empty = standard)
            </div>
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
              Importers can pre-tag rows as Insights types during CSV import. If empty, article is created as standard.
            </div>
          </div>
          <div style={{
            flexShrink: 0, background: "#FEF3C7", border: "1px solid #FCD34D",
            borderRadius: 6, padding: "4px 8px", fontSize: 9, fontWeight: 700, color: "#92400E",
          }}>
            FUTURE
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Panel 2: Field Change Matrix ──────────────────────────────────────

function MatrixRow({
  surface, changes, notes,
}: {
  surface: string;
  changes: "Changed" | "Conditional" | "Unchanged";
  notes: string;
}) {
  const chipColors: Record<string, { bg: string; text: string; border: string }> = {
    Changed: { bg: "#FEF3C7", text: "#92400E", border: "#FCD34D" },
    Conditional: { bg: C_PLANNING.bg, text: C_PLANNING.text, border: C_PLANNING.border },
    Unchanged: C_UNCHANGED,
  };
  const c = chipColors[changes];
  return (
    <tr>
      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 600, color: "#1E293B" }}>
        {surface}
      </td>
      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
        <span style={{
          display: "inline-block", background: c.bg, color: c.text, border: `1px solid ${c.border}`,
          borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700,
        }}>
          {changes}
        </span>
      </td>
      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: "#374151" }}>
        {notes}
      </td>
    </tr>
  );
}

function FormPanel2() {
  return (
    <div style={{
      background: WHITE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 20,
      fontFamily: font,
      flex: 1.4,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
        Form Panel 2 — Field Change Matrix
      </div>
      <div style={{ fontSize: 11, color: "#64748B", marginBottom: 16 }}>
        Every form surface — status for each in the Insights editorial overlay
      </div>

      <div style={{ overflowX: "auto" as const }}>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "8px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.08em", borderBottom: `2px solid ${BORDER}` }}>
                Form Surface
              </th>
              <th style={{ padding: "8px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.08em", borderBottom: `2px solid ${BORDER}`, whiteSpace: "nowrap" as const }}>
                Status
              </th>
              <th style={{ padding: "8px 10px", textAlign: "left" as const, fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: "0.08em", borderBottom: `2px solid ${BORDER}` }}>
                What changes
              </th>
            </tr>
          </thead>
          <tbody>
            <MatrixRow
              surface="Article creation dialog"
              changes="Conditional"
              notes="When an Insights content type is selected: Audience→Primary Reader, Content Goal→Primary Reader Question, Generation Brief→Why This Matters Now, + Mode A/B/C radio group, + 'Run Editorial Strategy' button."
            />
            <MatrixRow
              surface="AI Generation Brief panel"
              changes="Conditional"
              notes="For Insights articles after Gate A approval: Approved Brief replaces free-form brief. Hook Pattern and Content Structure pre-filled. Psychological fields hidden."
            />
            <MatrixRow
              surface="Gate A review panel"
              changes="Changed"
              notes="New panel — only visible on PLANNING_REVIEW articles. 4 sections: Editorial Brief, Stakeholder Scan, Research Questions, Outline Recommendation. Actions: Approve / Revise / Reject."
            />
            <MatrixRow
              surface="Metadata sidebar (editor)"
              changes="Unchanged"
              notes="Title, slug, SEO fields, author assignment, cover image, tags — all unchanged for Insights articles."
            />
            <MatrixRow
              surface="Social Kit editor"
              changes="Unchanged"
              notes="Caption generation, card builder, and channel publishing are identical for Insights articles."
            />
            <MatrixRow
              surface="Calendar filter panel"
              changes="Changed"
              notes="New 'Insights Editorial' content-type group (8 types). New 'Mode' filter (A/B/C). New 'Planning Review' status filter option. PLANNING_REVIEW badge colour: blue-grey."
            />
            <MatrixRow
              surface="Import header mapping"
              changes="Unchanged"
              notes="No change in current implementation. Optional future addition: insights_type column (empty = standard article)."
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Canvas ─────────────────────────────────────────────────────────────

export default function InsightsStudioCanvas() {
  return (
    <div style={{
      minHeight: "100vh",
      background: SOFT_GRAY,
      fontFamily: font,
      padding: "32px 24px",
    }}>
      {/* Header */}
      <div style={{
        background: NAVY,
        borderRadius: 12,
        padding: "20px 28px",
        marginBottom: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: WHITE }}>
            Insights Studio — UX Flow Canvas
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            Pre-implementation design reference · Tasks #1326 &amp; #1327 handoff
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Renamed field", bg: "#FFFBEB", border: "#FCD34D", text: "#92400E" },
            { label: "New / Insights", bg: C_PLANNING.bg, border: C_PLANNING.border, text: C_PLANNING.text },
            { label: "Unchanged", bg: C_UNCHANGED.bg, border: C_UNCHANGED.border, text: C_UNCHANGED.text },
          ].map((l) => (
            <div key={l.label} style={{
              background: l.bg, border: `1.5px solid ${l.border}`,
              borderRadius: 6, padding: "4px 10px",
              fontSize: 10, fontWeight: 700, color: l.text,
            }}>
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Row 1: Flow 1 + Flow 2 */}
      <SectionLabel>Row 1 — Creation Journey: Swimlane + Dialog Comparison</SectionLabel>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "flex-start" }}>
        <Flow1 />
        <Flow2 />
      </div>

      {/* Row 2: Flow 3 */}
      <SectionLabel>Row 2 — Editor Transformation: States + Gate A Panel + Brief Evolution</SectionLabel>
      <div style={{ marginBottom: 24 }}>
        <Flow3 />
      </div>

      {/* Row 3: Flow 4 */}
      <SectionLabel>Row 3 — Calendar: New Badges, Mode Indicators, Filter Groups</SectionLabel>
      <div style={{ marginBottom: 24 }}>
        <Flow4 />
      </div>

      {/* Row 4: Form Panel 1 + Form Panel 2 */}
      <SectionLabel>Row 4 — Import Pipeline (unchanged) + Field Change Matrix</SectionLabel>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <FormPanel1 />
        <FormPanel2 />
      </div>
    </div>
  );
}
