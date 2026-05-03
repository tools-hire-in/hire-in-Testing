import { useState, useMemo, useCallback } from "react";

const HOLIDAYS_2026 = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-10", name: "Holi" },
  { date: "2026-04-14", name: "Ambedkar Jayanti" },
  { date: "2026-05-01", name: "May Day" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-09", name: "Diwali" },
  { date: "2026-12-25", name: "Christmas" },
];

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const BONUS_MONTHS = [0, 4, 8]; // Jan, May, Sep

function getELAccrualForMonth(m) { return BONUS_MONTHS.includes(m) ? 2 : 1; }

function isWeekend(d) { const day = d.getDay(); return day === 0 || day === 6; }
function isHoliday(d) {
  const ds = d.toISOString().split("T")[0];
  return HOLIDAYS_2026.some(h => h.date === ds);
}
function getHolidayName(d) {
  const ds = d.toISOString().split("T")[0];
  const h = HOLIDAYS_2026.find(h => h.date === ds);
  return h ? h.name : null;
}

function countLeaveDays(from, to) {
  if (!from || !to) return { total: 0, weekends: 0, holidays: 0, leave: 0, details: [] };
  let d = new Date(from), end = new Date(to);
  let total = 0, weekends = 0, holidays = 0, leave = 0, details = [];
  while (d <= end) {
    total++;
    const we = isWeekend(d);
    const ho = isHoliday(d);
    const hn = getHolidayName(d);
    if (we) { weekends++; details.push({ date: new Date(d), type: "weekend", note: d.getDay()===0?"Sun":"Sat" }); }
    else if (ho) { holidays++; details.push({ date: new Date(d), type: "holiday", note: hn }); }
    else { leave++; details.push({ date: new Date(d), type: "leave", note: "Working day" }); }
    d.setDate(d.getDate() + 1);
  }
  return { total, weekends, holidays, leave, details };
}

function fmt(d) { return d ? d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : ""; }

const INITIAL_EMPLOYEE = {
  name: "Amit Sharma", id: "EMP001", shift: "Shift A (East Coast)",
  shiftTime: "6:30 PM – 3:30 AM IST", doj: "2025-11-15", ctc: 50000,
  el: { opening: 6, accrued: 7, used: 3, balance: 10 },
  cl: { opening: 0, accrued: 5, used: 1, balance: 4 },
  co: [{ earned: "2026-04-20", expiry: "2026-05-20", status: "available" }],
  history: [
    { id: 1, type: "EL", from: "2026-02-10", to: "2026-02-12", days: 3, status: "approved", reason: "Family function" },
    { id: 2, type: "CL", from: "2026-03-22", to: "2026-03-22", days: 1, status: "approved", reason: "Not feeling well" },
  ]
};

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [emp] = useState(INITIAL_EMPLOYEE);
  const [leaveType, setLeaveType] = useState("EL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [halfType, setHalfType] = useState("first_half");
  const [reason, setReason] = useState("");
  const [showSplit, setShowSplit] = useState(false);
  const [splitEL, setSplitEL] = useState(0);
  const [splitCL, setSplitCL] = useState(0);
  const [splitCO, setSplitCO] = useState(0);
  const [submitted, setSubmitted] = useState(null);
  const [showAccrual, setShowAccrual] = useState(false);

  const calc = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const r = countLeaveDays(new Date(fromDate), new Date(toDate));
    if (halfDay && r.leave >= 1) r.leave -= 0.5;
    return r;
  }, [fromDate, toDate, halfDay]);

  const balanceFor = useCallback((type) => {
    if (type === "EL") return emp.el.balance;
    if (type === "CL") return emp.cl.balance;
    if (type === "CO") return emp.co.filter(c => c.status === "available").length;
    return 999;
  }, [emp]);

  const insufficient = calc && calc.leave > balanceFor(leaveType) && leaveType !== "LWP";
  const totalPaid = emp.el.balance + emp.cl.balance + emp.co.filter(c=>c.status==="available").length;
  const lwpBlocked = leaveType === "LWP" && totalPaid > 0;
  const dailyWage = Math.round(emp.ctc / 26);
  const lwpDeduction = calc ? calc.leave * dailyWage : 0;

  function handleSubmit() {
    if (!calc || calc.leave <= 0) return;
    if (lwpBlocked) return;
    if (insufficient && !showSplit) { setShowSplit(true); setSplitEL(Math.min(emp.el.balance, calc.leave)); setSplitCL(0); setSplitCO(0); return; }
    setSubmitted({
      type: showSplit ? "SPLIT" : leaveType,
      from: fromDate, to: toDate, days: calc.leave,
      split: showSplit ? { el: splitEL, cl: splitCL, co: splitCO, lwp: Math.max(0, calc.leave - splitEL - splitCL - splitCO) } : null
    });
  }

  function resetForm() {
    setLeaveType("EL"); setFromDate(""); setToDate(""); setHalfDay(false); setReason("");
    setShowSplit(false); setSplitEL(0); setSplitCL(0); setSplitCO(0); setSubmitted(null);
  }

  const splitLWP = showSplit ? Math.max(0, (calc?.leave || 0) - splitEL - splitCL - splitCO) : 0;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", maxWidth: 720, margin: "0 auto", color: "#1a1a1a", background: "#f8f7f4" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #1a2744 0%, #2d4a7a 100%)", padding: "20px 24px", borderRadius: "0 0 16px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#8fb8e8", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Employee Portal</div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginTop: 2 }}>{emp.name}</div>
            <div style={{ color: "#a8c4e0", fontSize: 12, marginTop: 2 }}>{emp.id} · {emp.shift} · {emp.shiftTime}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 14px", textAlign: "right" }}>
            <div style={{ color: "#a8c4e0", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Monthly CTC</div>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>₹{emp.ctc.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 0, margin: "16px 16px 0", background: "#e8e6e1", borderRadius: 10, padding: 3 }}>
        {[["dashboard","Balance"],["apply","Apply Leave"],["history","History"],["accrual","Accrual"]].map(([k,v]) => (
          <button key={k} onClick={() => { setTab(k); if(k!=="apply") resetForm(); }}
            style={{ flex: 1, padding: "9px 0", fontSize: 13, fontWeight: tab===k?600:400, border: "none", borderRadius: 8,
              background: tab===k?"#fff":"transparent", color: tab===k?"#1a2744":"#777", cursor: "pointer", transition: "all .2s",
              boxShadow: tab===k?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>{v}</button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>

        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === "dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {/* EL Card */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "1px solid #e2e0db", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#2d6bc4" }} />
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Earned Leave</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#2d6bc4", fontFamily: "'DM Mono'", marginTop: 4 }}>{emp.el.balance}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>of 15/year · Carry fwd: max 45</div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>
                  <span style={{ color: "#4caf50" }}>+{emp.el.accrued} accrued</span> · <span style={{ color: "#e57373" }}>-{emp.el.used} used</span>
                </div>
                <div style={{ marginTop: 6, background: "#eef3fa", borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${(emp.el.balance/15)*100}%`, height: 6, background: "#2d6bc4", borderRadius: 4 }} />
                </div>
              </div>

              {/* CL Card */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "1px solid #e2e0db", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#e8893c" }} />
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Casual / Sick</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#e8893c", fontFamily: "'DM Mono'", marginTop: 4 }}>{emp.cl.balance}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>of 12/year · Lapses 31 Dec</div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#666" }}>
                  <span style={{ color: "#4caf50" }}>+{emp.cl.accrued} accrued</span> · <span style={{ color: "#e57373" }}>-{emp.cl.used} used</span>
                </div>
                <div style={{ marginTop: 6, background: "#fdf0e4", borderRadius: 4, height: 6 }}>
                  <div style={{ width: `${(emp.cl.balance/12)*100}%`, height: 6, background: "#e8893c", borderRadius: 4 }} />
                </div>
              </div>

              {/* CO Card */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "16px", border: "1px solid #e2e0db", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#5ba55b" }} />
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Comp-Off</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: "#5ba55b", fontFamily: "'DM Mono'", marginTop: 4 }}>{emp.co.filter(c=>c.status==="available").length}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Expires within 30 days</div>
                {emp.co.filter(c=>c.status==="available").map((c,i) => (
                  <div key={i} style={{ marginTop: 6, fontSize: 11, color: "#e57373", background: "#fef5f5", padding: "4px 8px", borderRadius: 4 }}>
                    Expires: {fmt(new Date(c.expiry))}
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {emp.cl.balance > 0 && (
              <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#8d6e00", marginBottom: 12, display: "flex", gap: 8 }}>
                <span style={{ fontSize: 16 }}>⚠</span>
                <span><strong>{emp.cl.balance} CL</strong> will lapse on 31 Dec 2026 if unused. CL is never encashable and cannot be carried forward.</span>
              </div>
            )}

            {/* Next Accrual */}
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e2e0db", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>NEXT ACCRUAL — 1 June 2026</div>
              <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                <span style={{ color: "#2d6bc4" }}>+1 EL (monthly)</span>
                <span style={{ color: "#e8893c" }}>+1 CL (monthly)</span>
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Bonus EL months: Jan ✓ May ✓ Sep ○</div>
            </div>

            <button onClick={() => setTab("apply")} style={{ width: "100%", padding: "12px", background: "#2d6bc4", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Apply for Leave
            </button>
          </div>
        )}

        {/* ═══ APPLY TAB ═══ */}
        {tab === "apply" && !submitted && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a2744", marginBottom: 14 }}>Apply for Leave</div>

            {/* Leave Type Selector */}
            <div style={{ fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 6 }}>SELECT LEAVE TYPE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
              {[
                { code: "EL", label: "Earned", bal: emp.el.balance, color: "#2d6bc4" },
                { code: "CL", label: "Casual/Sick", bal: emp.cl.balance, color: "#e8893c" },
                { code: "CO", label: "Comp-Off", bal: emp.co.filter(c=>c.status==="available").length, color: "#5ba55b" },
                { code: "LWP", label: "Without Pay", bal: "∞", color: "#999" },
              ].map(t => (
                <button key={t.code} onClick={() => { setLeaveType(t.code); setShowSplit(false); }}
                  style={{
                    padding: "10px 6px", border: leaveType===t.code ? `2px solid ${t.color}` : "1.5px solid #e2e0db",
                    borderRadius: 10, background: leaveType===t.code ? `${t.color}10` : "#fff", cursor: "pointer",
                    textAlign: "center", transition: "all .15s"
                  }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.color, fontFamily: "'DM Mono'" }}>{t.bal}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#888", marginTop: 2 }}>{t.label}</div>
                </button>
              ))}
            </div>

            {/* LWP Block Warning */}
            {lwpBlocked && (
              <div style={{ background: "#fef5f5", border: "1px solid #ffcdd2", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#c62828", marginBottom: 14 }}>
                <strong>Cannot apply LWP.</strong> You have {totalPaid} paid leave(s) available ({emp.el.balance} EL, {emp.cl.balance} CL, {emp.co.filter(c=>c.status==="available").length} CO). You must exhaust paid leave before applying LWP.
              </div>
            )}

            {/* Date Pickers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>FROM DATE</label>
                <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setShowSplit(false); }}
                  style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>TO DATE</label>
                <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setShowSplit(false); }}
                  min={fromDate}
                  style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 13, marginTop: 4, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Half Day */}
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#555", marginBottom: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={halfDay} onChange={e => setHalfDay(e.target.checked)} />
              Half day leave
              {halfDay && (
                <select value={halfType} onChange={e => setHalfType(e.target.value)}
                  style={{ marginLeft: 8, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }}>
                  <option value="first_half">First Half</option>
                  <option value="second_half">Second Half</option>
                </select>
              )}
            </label>

            {/* LIVE CALCULATION */}
            {calc && calc.total > 0 && (
              <div style={{ background: "#fff", border: "1.5px solid #e2e0db", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 10 }}>CALCULATION PREVIEW</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#666" }}>
                  <span>Calendar days:</span><span style={{ textAlign: "right", fontWeight: 500 }}>{calc.total}</span>
                  {calc.weekends > 0 && <><span>Weekends excluded:</span><span style={{ textAlign: "right", color: "#4caf50" }}>-{calc.weekends} (not deducted)</span></>}
                  {calc.holidays > 0 && <><span>Holidays excluded:</span><span style={{ textAlign: "right", color: "#4caf50" }}>-{calc.holidays} (not deducted)</span></>}
                  {halfDay && <><span>Half day:</span><span style={{ textAlign: "right", color: "#4caf50" }}>-0.5</span></>}
                </div>
                <div style={{ borderTop: "1px dashed #ddd", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "#1a2744" }}>
                  <span>Leave days to deduct:</span>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: 18 }}>{calc.leave}</span>
                </div>

                {/* Day-by-day breakdown */}
                {calc.details.length > 0 && calc.details.length <= 14 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {calc.details.map((d, i) => (
                      <div key={i} style={{
                        fontSize: 10, padding: "3px 7px", borderRadius: 5, fontWeight: 500,
                        background: d.type === "weekend" ? "#f5f5f5" : d.type === "holiday" ? "#e8f5e9" : "#e3f2fd",
                        color: d.type === "weekend" ? "#999" : d.type === "holiday" ? "#2e7d32" : "#1565c0",
                        textDecoration: d.type !== "leave" ? "line-through" : "none"
                      }}>
                        {d.date.toLocaleDateString("en-IN",{day:"2-digit",month:"short",weekday:"short"})}
                        {d.type === "holiday" && ` (${d.note})`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Balance after */}
                {leaveType !== "LWP" && !showSplit && (
                  <div style={{ marginTop: 10, fontSize: 12, display: "flex", justifyContent: "space-between", color: insufficient ? "#c62828" : "#2e7d32" }}>
                    <span>Balance after leave:</span>
                    <span style={{ fontWeight: 600 }}>
                      {insufficient ? `${balanceFor(leaveType)} available, need ${calc.leave} — INSUFFICIENT` :
                        `${(balanceFor(leaveType) - calc.leave).toFixed(1)} ${leaveType}`}
                    </span>
                  </div>
                )}

                {/* LWP salary impact */}
                {leaveType === "LWP" && !lwpBlocked && (
                  <div style={{ marginTop: 10, background: "#fff3e0", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#e65100" }}>
                    <strong>Salary deduction:</strong> {calc.leave} days × ₹{dailyWage.toLocaleString()}/day = <strong style={{ fontFamily: "'DM Mono'" }}>₹{lwpDeduction.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            )}

            {/* INSUFFICIENT → SPLIT LEAVE UI */}
            {showSplit && calc && (
              <div style={{ background: "#fef8f0", border: "1.5px solid #ffe0b2", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e65100", marginBottom: 10 }}>Split Leave — {calc.leave} days needed</div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>Your {leaveType} balance is insufficient. Split across multiple types:</div>

                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "6px 12px", alignItems: "center", fontSize: 13 }}>
                  <span style={{ color: "#2d6bc4", fontWeight: 600 }}>EL</span>
                  <input type="range" min={0} max={Math.min(emp.el.balance, calc.leave)} step={0.5} value={splitEL}
                    onChange={e => setSplitEL(Number(e.target.value))} style={{ width: "100%" }} />
                  <span style={{ fontFamily: "'DM Mono'", fontWeight: 600, minWidth: 40, textAlign: "right" }}>{splitEL} <span style={{ fontSize: 10, color: "#999" }}>/ {emp.el.balance}</span></span>

                  <span style={{ color: "#e8893c", fontWeight: 600 }}>CL</span>
                  <input type="range" min={0} max={Math.min(emp.cl.balance, Math.max(0, calc.leave - splitEL))} step={0.5} value={Math.min(splitCL, Math.max(0, calc.leave - splitEL))}
                    onChange={e => setSplitCL(Number(e.target.value))} style={{ width: "100%" }} />
                  <span style={{ fontFamily: "'DM Mono'", fontWeight: 600, minWidth: 40, textAlign: "right" }}>{Math.min(splitCL, Math.max(0, calc.leave - splitEL))} <span style={{ fontSize: 10, color: "#999" }}>/ {emp.cl.balance}</span></span>

                  <span style={{ color: "#5ba55b", fontWeight: 600 }}>CO</span>
                  <input type="range" min={0} max={Math.min(emp.co.filter(c=>c.status==="available").length, Math.max(0, calc.leave - splitEL - splitCL))} step={1} value={splitCO}
                    onChange={e => setSplitCO(Number(e.target.value))} style={{ width: "100%" }} />
                  <span style={{ fontFamily: "'DM Mono'", fontWeight: 600, minWidth: 40, textAlign: "right" }}>{splitCO} <span style={{ fontSize: 10, color: "#999" }}>/ {emp.co.filter(c=>c.status==="available").length}</span></span>

                  <span style={{ color: "#999", fontWeight: 600 }}>LWP</span>
                  <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "4px 8px", fontSize: 12, color: "#999" }}>Auto-calculated remainder</div>
                  <span style={{ fontFamily: "'DM Mono'", fontWeight: 600, color: splitLWP > 0 ? "#c62828" : "#999", minWidth: 40, textAlign: "right" }}>{splitLWP}</span>
                </div>

                <div style={{ borderTop: "1px dashed #ddd", marginTop: 10, paddingTop: 8, fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span>Total: {splitEL} EL + {Math.min(splitCL, Math.max(0, calc.leave - splitEL))} CL + {splitCO} CO + {splitLWP} LWP = {calc.leave}</span>
                  {splitLWP > 0 && <span style={{ color: "#c62828", fontWeight: 600 }}>Deduction: ₹{(splitLWP * dailyWage).toLocaleString()}</span>}
                </div>
              </div>
            )}

            {/* Reason */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#666" }}>REASON {leaveType === "CL" && calc && calc.leave > 2 ? "(Medical cert recommended)" : ""}</label>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Enter reason for leave..."
                style={{ width: "100%", padding: "9px 10px", border: "1.5px solid #ddd", borderRadius: 8, fontSize: 13, marginTop: 4, resize: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
            </div>

            {/* Advance notice warning */}
            {calc && calc.leave > 0 && fromDate && leaveType === "EL" && (
              (() => {
                const daysNotice = Math.floor((new Date(fromDate) - new Date()) / 86400000);
                if (daysNotice < 7) return (
                  <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#8d6e00", marginBottom: 12 }}>
                    ⚠ EL requires 7 days advance notice. You're applying {daysNotice} days in advance. Your manager may ask to reschedule.
                  </div>
                );
                return null;
              })()
            )}

            {/* Submit */}
            <button onClick={handleSubmit} disabled={!calc || calc.leave <= 0 || lwpBlocked || !reason.trim()}
              style={{
                width: "100%", padding: "12px", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
                background: (!calc || calc.leave <= 0 || lwpBlocked || !reason.trim()) ? "#e0e0e0" : insufficient && !showSplit ? "#e8893c" : "#2d6bc4",
                color: (!calc || calc.leave <= 0 || lwpBlocked || !reason.trim()) ? "#999" : "#fff"
              }}>
              {insufficient && !showSplit ? "Insufficient Balance — Split Leave" : showSplit ? "Submit Split Leave Request" : "Submit Leave Request"}
            </button>
          </div>
        )}

        {/* SUBMITTED CONFIRMATION */}
        {tab === "apply" && submitted && (
          <div style={{ textAlign: "center", padding: "30px 20px" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5e9", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#2e7d32", marginBottom: 6 }}>Leave Request Submitted</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>Pending approval from your reporting manager</div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px", border: "1px solid #e2e0db", textAlign: "left", fontSize: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", color: "#555" }}>
                <span style={{ fontWeight: 600 }}>Type:</span><span>{submitted.type}</span>
                <span style={{ fontWeight: 600 }}>Dates:</span><span>{submitted.from} to {submitted.to}</span>
                <span style={{ fontWeight: 600 }}>Days:</span><span>{submitted.days}</span>
                {submitted.split && <>
                  <span style={{ fontWeight: 600 }}>Split:</span>
                  <span>{submitted.split.el} EL + {submitted.split.cl} CL + {submitted.split.co} CO + {submitted.split.lwp} LWP</span>
                  {submitted.split.lwp > 0 && <>
                    <span style={{ fontWeight: 600, color: "#c62828" }}>Deduction:</span>
                    <span style={{ color: "#c62828" }}>₹{(submitted.split.lwp * dailyWage).toLocaleString()}</span>
                  </>}
                </>}
              </div>
            </div>
            <button onClick={resetForm} style={{ marginTop: 16, padding: "10px 28px", background: "#2d6bc4", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Done</button>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {tab === "history" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a2744", marginBottom: 14 }}>Leave History — 2026</div>
            {emp.history.map(h => (
              <div key={h.id} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #e2e0db", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
                      background: h.type==="EL"?"#e3f2fd":h.type==="CL"?"#fef0e4":"#f5f5f5",
                      color: h.type==="EL"?"#1565c0":h.type==="CL"?"#e8893c":"#666"
                    }}>{h.type}</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{h.days} day{h.days>1?"s":""}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                    {fmt(new Date(h.from))}{h.from !== h.to ? ` — ${fmt(new Date(h.to))}` : ""} · {h.reason}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                  background: h.status==="approved"?"#e8f5e9":"#fef5f5",
                  color: h.status==="approved"?"#2e7d32":"#c62828"
                }}>{h.status === "approved" ? "Approved" : "Rejected"}</span>
              </div>
            ))}
            <div style={{ background: "#fff", borderRadius: 10, padding: "14px", border: "1px solid #e2e0db", marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>ANNUAL SUMMARY</div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px", fontSize: 12, color: "#666" }}>
                <span style={{ fontWeight: 600, color: "#2d6bc4" }}>EL:</span><span>Accrued {emp.el.accrued} · Used {emp.el.used} · Carried fwd {emp.el.opening} · Balance <strong>{emp.el.balance}</strong></span>
                <span style={{ fontWeight: 600, color: "#e8893c" }}>CL:</span><span>Accrued {emp.cl.accrued} · Used {emp.cl.used} · Balance <strong>{emp.cl.balance}</strong> (lapses 31 Dec)</span>
                <span style={{ fontWeight: 600, color: "#5ba55b" }}>CO:</span><span>Available {emp.co.filter(c=>c.status==="available").length}</span>
                <span style={{ fontWeight: 600, color: "#999" }}>LWP:</span><span>0 days this year</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACCRUAL TAB ═══ */}
        {tab === "accrual" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a2744", marginBottom: 4 }}>EL Accrual Calendar — 2026</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>1 EL/month + 1 bonus EL in Jan, May, Sep = 15/year</div>

            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e0db", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "50px 60px 60px 60px 50px 50px", gap: 0, fontSize: 11, fontWeight: 600, color: "#888", padding: "8px 12px", background: "#f8f7f4", borderBottom: "1px solid #e2e0db" }}>
                <span>Month</span><span style={{ textAlign: "center" }}>Monthly</span><span style={{ textAlign: "center" }}>Bonus</span>
                <span style={{ textAlign: "center" }}>Total</span><span style={{ textAlign: "center" }}>Cum.</span><span style={{ textAlign: "center" }}>Status</span>
              </div>
              {MONTHS.map((m, i) => {
                const monthly = 1;
                const bonus = BONUS_MONTHS.includes(i) ? 1 : 0;
                const total = monthly + bonus;
                const cum = MONTHS.slice(0, i+1).reduce((s, _, j) => s + getELAccrualForMonth(j), 0);
                const isPast = i < 4; // May is current month (index 4)
                const isCurrent = i === 4;
                return (
                  <div key={m} style={{
                    display: "grid", gridTemplateColumns: "50px 60px 60px 60px 50px 50px", gap: 0,
                    padding: "7px 12px", borderBottom: i < 11 ? "1px solid #f0efeb" : "none",
                    background: isCurrent ? "#e3f2fd" : bonus ? "#fef8f0" : "transparent",
                    fontSize: 12
                  }}>
                    <span style={{ fontWeight: 600, color: isCurrent ? "#1565c0" : "#333" }}>{m}</span>
                    <span style={{ textAlign: "center", color: "#2d6bc4" }}>+1</span>
                    <span style={{ textAlign: "center", color: bonus ? "#e8893c" : "#ddd", fontWeight: bonus ? 700 : 400 }}>{bonus ? "+1" : "—"}</span>
                    <span style={{ textAlign: "center", fontWeight: 600 }}>{total}</span>
                    <span style={{ textAlign: "center", fontFamily: "'DM Mono'", fontWeight: 500 }}>{cum}</span>
                    <span style={{ textAlign: "center" }}>{isPast || isCurrent ? "✓" : "○"}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: "#1a2744", marginBottom: 4 }}>CL Accrual — 2026</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>1 CL/month · Unconditional · Lapses 31 Dec · Never encashable</div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e2e0db" }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {MONTHS.map((m, i) => (
                  <div key={m} style={{
                    width: 48, textAlign: "center", padding: "6px 0", borderRadius: 6,
                    fontSize: 11, fontWeight: 600,
                    background: i < 5 ? "#fef0e4" : "#f5f5f5",
                    color: i < 5 ? "#e8893c" : "#ccc"
                  }}>
                    {m}<br/><span style={{ fontSize: 10, fontWeight: 400 }}>{i < 5 ? "✓" : "○"}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                Accrued: {Math.min(5, 12)}/12 · Used: {emp.cl.used} · Balance: <strong>{emp.cl.balance}</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: "center", padding: "16px", fontSize: 10, color: "#bbb" }}>
        Delhi S&E Act, 1954 compliant · v4.0 · {new Date().toLocaleDateString("en-IN")}
      </div>
    </div>
  );
}
