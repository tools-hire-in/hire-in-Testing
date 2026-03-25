export function Enterprise() {
  const NAVY = "#1F3A6E";
  const ORANGE = "#F47C20";

  const sampleData = {
    employeeName: "Ayushi Tiwari",
    employeeId: "HIS-HC-NOVA",
    designation: "Healthcare Recruiter",
    department: "Healthcare",
    location: "Remote",
    month: "January",
    year: 2026,
    paidDays: 31,
    lopDays: 0,
    basic: 21000,
    hra: 8400,
    conveyance: 1600,
    specialAllowance: 4000,
    pfDeduction: 1800,
    esiDeduction: 0,
    professionalTax: 200,
    tds: 0,
  };

  const totalEarnings = sampleData.basic + sampleData.hra + sampleData.conveyance + sampleData.specialAllowance;
  const totalDeductions = sampleData.pfDeduction + sampleData.esiDeduction + sampleData.professionalTax + sampleData.tds;
  const netPay = totalEarnings - totalDeductions;

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const earningsRows = [
    { label: "Basic", amount: sampleData.basic },
    { label: "House Rent Allowance (HRA)", amount: sampleData.hra },
    { label: "Conveyance Allowance", amount: sampleData.conveyance },
    { label: "Special Allowance", amount: sampleData.specialAllowance },
  ];

  const deductionRows = [
    { label: "Provident Fund (PF)", amount: sampleData.pfDeduction },
    { label: "Professional Tax", amount: sampleData.professionalTax },
  ].filter(r => r.amount > 0);

  const maxRows = Math.max(earningsRows.length, deductionRows.length);

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", padding: "5px 0", fontSize: 11.5, gap: 0 }}>
      <span style={{ minWidth: 148, color: "#6B7280", fontWeight: 400 }}>{label}</span>
      <span style={{ marginRight: 10, color: "#374151" }}>:</span>
      <span style={{ color: "#111827", fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background: "#F3F4F6", minHeight: "100vh", padding: 32, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{
        maxWidth: 820, margin: "0 auto", background: "#fff",
        boxShadow: "0 2px 16px rgba(0,0,0,0.09)",
        borderRadius: 6, overflow: "hidden", position: "relative"
      }}>

        {/* DIAGONAL WATERMARK */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", zIndex: 0, overflow: "hidden"
        }}>
          <div style={{
            transform: "rotate(-38deg)", fontSize: 64, fontWeight: 900,
            letterSpacing: 8, color: `${NAVY}07`, whiteSpace: "nowrap",
            userSelect: "none", lineHeight: 1.7, textAlign: "center"
          }}>
            RAYOMIND SOLUTIONS<br />RAYOMIND SOLUTIONS<br />RAYOMIND SOLUTIONS
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>

          {/* ── HEADER ── */}
          <div style={{
            padding: "22px 28px 18px",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            background: "#fff"
          }}>

            {/* LEFT — Rayomind logo + company + address (top-aligned) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <img
                src="/__mockup/images/rayomind-logo.png"
                alt="Rayomind Solutions LLP"
                style={{ height: 40, objectFit: "contain" }}
              />
              <div style={{ fontSize: 9.5, color: "#6B7280", marginTop: 4, lineHeight: 1.5 }}>
                Suite No-101, Pocket-6, Sector-2<br />
                Rohini, New Delhi – 110085, India
              </div>
              <div style={{ fontSize: 8.5, color: "#9CA3AF", marginTop: 2, letterSpacing: 0.3 }}>
                GSTIN/UIN: 07ABMFR1303G1ZF
              </div>
            </div>

            {/* RIGHT — HIS logo + Hire'in Solutions + payslip month (top-aligned) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Hire'in Solutions</div>
                  <div style={{ fontSize: 8.5, color: ORANGE, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginTop: 1 }}>
                    A Rayomind Company
                  </div>
                </div>
                <img
                  src="/__mockup/images/his-logo.jpg"
                  alt="Hire'in Solutions"
                  style={{ height: 34, objectFit: "contain", borderRadius: 4 }}
                />
              </div>
              <div style={{ textAlign: "right", marginTop: 4 }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 400 }}>Payslip For the Month</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, lineHeight: 1.1, marginTop: 2 }}>
                  {sampleData.month} {sampleData.year}
                </div>
              </div>
            </div>
          </div>

          {/* ORANGE ACCENT LINE */}
          <div style={{ height: 3, background: `linear-gradient(to right, ${ORANGE}, #FBBB6D, ${ORANGE})` }} />

          {/* ── EMPLOYEE SUMMARY + NET PAY CARD ── */}
          <div style={{
            display: "flex", gap: 20, padding: "20px 28px",
            borderBottom: `1px solid #E5E7EB`
          }}>
            {/* Left: label-value summary */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: NAVY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
                Employee Summary
              </div>
              <SummaryRow label="Employee Name" value={sampleData.employeeName} />
              <SummaryRow label="Employee ID" value={sampleData.employeeId} />
              <SummaryRow label="Designation" value={sampleData.designation} />
              <SummaryRow label="Department" value={sampleData.department} />
              <SummaryRow label="Location" value={sampleData.location} />
              <SummaryRow label="Pay Period" value={`${sampleData.month} ${sampleData.year}`} />
            </div>

            {/* Right: Net Pay card — brand colors */}
            <div style={{
              width: 230, background: "#FFF7F0",
              border: `1px solid #FDBA8C`, borderRadius: 10,
              padding: "18px 20px", flexShrink: 0, alignSelf: "flex-start"
            }}>
              <div style={{ borderLeft: `4px solid ${ORANGE}`, paddingLeft: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: NAVY, letterSpacing: -0.5 }}>
                  ₹{fmt(netPay)}
                </div>
                <div style={{ fontSize: 10.5, color: ORANGE, fontWeight: 600, marginTop: 2 }}>
                  Total Net Pay
                </div>
              </div>
              <div style={{ borderTop: `1px dashed #FDBA8C`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                  <span style={{ color: "#6B7280" }}>Gross Earnings</span>
                  <span style={{ fontWeight: 600, color: NAVY }}>₹{fmt(totalEarnings)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                  <span style={{ color: "#6B7280" }}>Total Deductions</span>
                  <span style={{ fontWeight: 600, color: "#DC2626" }}>−₹{fmt(totalDeductions)}</span>
                </div>
                <div style={{ borderTop: `1px dashed #FDBA8C`, marginTop: 2, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                    <span style={{ color: "#6B7280" }}>Pay Days</span>
                    <span style={{ fontWeight: 600, color: NAVY }}>{sampleData.paidDays}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                    <span style={{ color: "#6B7280" }}>LOP Days</span>
                    <span style={{ fontWeight: 600, color: sampleData.lopDays > 0 ? "#DC2626" : NAVY }}>{sampleData.lopDays}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── EARNINGS & DEDUCTIONS TABLE ── */}
          <div style={{ padding: "0 28px", marginTop: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, border: `1px solid #E5E7EB`, borderRadius: 6, overflow: "hidden" }}>
              <thead>
                <tr>
                  <th style={{ background: "#F9FAFB", padding: "9px 14px", textAlign: "left", color: NAVY, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", borderBottom: `2px solid #E5E7EB`, width: "40%" }}>
                    Earnings
                  </th>
                  <th style={{ background: "#F9FAFB", padding: "9px 14px", textAlign: "right", color: "#6B7280", fontWeight: 600, fontSize: 10, borderBottom: `2px solid #E5E7EB`, width: "10%" }}>
                    Amount
                  </th>
                  <th style={{ background: "#F9FAFB", padding: "9px 14px", textAlign: "left", color: NAVY, fontWeight: 700, fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", borderBottom: `2px solid #E5E7EB`, borderLeft: `2px solid #E5E7EB`, width: "40%" }}>
                    Deductions
                  </th>
                  <th style={{ background: "#F9FAFB", padding: "9px 14px", textAlign: "right", color: "#6B7280", fontWeight: 600, fontSize: 10, borderBottom: `2px solid #E5E7EB`, width: "10%" }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }).map((_, i) => {
                  const e = earningsRows[i];
                  const d = deductionRows[i];
                  const shade = i % 2 === 1;
                  return (
                    <tr key={i} style={{ background: shade ? "#FAFAFA" : "#fff" }}>
                      <td style={{ padding: "8px 14px", color: "#374151", borderBottom: `1px solid #F3F4F6`, fontWeight: e ? 400 : undefined }}>
                        {e?.label ?? ""}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: "#111827", fontWeight: 600, borderBottom: `1px solid #F3F4F6` }}>
                        {e ? `₹${fmt(e.amount)}` : ""}
                      </td>
                      <td style={{ padding: "8px 14px", color: "#374151", borderBottom: `1px solid #F3F4F6`, borderLeft: `2px solid #E5E7EB` }}>
                        {d?.label ?? ""}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: d ? "#DC2626" : "#9CA3AF", fontWeight: d ? 600 : 400, borderBottom: `1px solid #F3F4F6` }}>
                        {d ? `₹${fmt(d.amount)}` : ""}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ background: "#F3F4F6" }}>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: NAVY, fontSize: 12, borderTop: `2px solid #D1D5DB` }}>
                    Gross Earnings
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: "#15803D", fontSize: 12, borderTop: `2px solid #D1D5DB` }}>
                    ₹{fmt(totalEarnings)}
                  </td>
                  <td style={{ padding: "9px 14px", fontWeight: 700, color: NAVY, fontSize: 12, borderTop: `2px solid #D1D5DB`, borderLeft: `2px solid #E5E7EB` }}>
                    Total Deductions
                  </td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: "#DC2626", fontSize: 12, borderTop: `2px solid #D1D5DB` }}>
                    ₹{fmt(totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── TOTAL NET PAYABLE FOOTER ── */}
          <div style={{
            margin: "20px 28px 28px",
            background: "#EEF2FA", borderRadius: 6,
            border: `1px solid #C7D3EC`,
            padding: "14px 20px",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{ color: NAVY, fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>
                Total Net Payable
              </div>
              <div style={{ color: "#6B7280", fontSize: 10, marginTop: 3 }}>
                Gross Earnings − Total Deductions
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: ORANGE, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 2 }}>
                AMOUNT CREDITED
              </div>
              <div style={{ color: NAVY, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
                ₹{fmt(netPay)}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
