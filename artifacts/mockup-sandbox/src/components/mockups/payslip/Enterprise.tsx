export function Enterprise() {
  const NAVY = "#1F3A6E";
  const ORANGE = "#F47C20";
  const LIGHT_NAVY = "#2A4D8F";

  const sampleData = {
    employeeName: "Ayushi Tiwari",
    employeeId: "HIS-HC-NOVA",
    joiningDate: "December 8, 2025",
    designation: "Healthcare Recruiter",
    department: "Healthcare",
    location: "Noida, U.P.",
    grade: "L2",
    bankName: "State Bank of India",
    bankAccountNo: "34942471488",
    pfNo: "DL/CPM/1234567",
    pfUan: "100987654321",
    esi: "N/A",
    empEffectiveWorkdays: 31,
    daysInMonth: 31,
    lop: 0,
    month: "January",
    year: 2026,
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

  const InfoRow = ({ label, value, shade }: { label: string; value: string; shade?: boolean }) => (
    <div style={{
      display: "flex", padding: "5px 12px", fontSize: 11,
      backgroundColor: shade ? "#F7F9FC" : "#FFFFFF",
      borderBottom: "1px solid #E8EDF4"
    }}>
      <span style={{ minWidth: 145, fontWeight: 600, color: "#374151" }}>{label}</span>
      <span style={{ color: "#1a1a1a" }}>{value}</span>
    </div>
  );

  const earningsRows = [
    { label: "Basic", amount: sampleData.basic },
    { label: "House Rent Allowance (HRA)", amount: sampleData.hra },
    { label: "Conveyance Allowance", amount: sampleData.conveyance },
    { label: "Special Allowance", amount: sampleData.specialAllowance },
  ];

  const deductionRows = [
    { label: "Provident Fund (PF)", amount: sampleData.pfDeduction },
    { label: "ESI", amount: sampleData.esiDeduction },
    { label: "Professional Tax", amount: sampleData.professionalTax },
    { label: "TDS", amount: sampleData.tds },
  ];

  const maxRows = Math.max(earningsRows.length, deductionRows.length);
  const paddedEarnings = [...earningsRows, ...Array(maxRows - earningsRows.length).fill(null)];
  const paddedDeductions = [...deductionRows, ...Array(maxRows - deductionRows.length).fill(null)];

  return (
    <div style={{ background: "#EEF2F7", minHeight: "100vh", padding: 32, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{
        maxWidth: 820, margin: "0 auto", background: "#fff",
        boxShadow: "0 4px 24px rgba(31,58,110,0.13)",
        borderRadius: 4, overflow: "hidden", position: "relative"
      }}>

        {/* DIAGONAL WATERMARK */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", zIndex: 0, overflow: "hidden"
        }}>
          <div style={{
            transform: "rotate(-38deg)",
            fontSize: 68, fontWeight: 900, letterSpacing: 8,
            color: `${NAVY}09`,
            whiteSpace: "nowrap", userSelect: "none",
            lineHeight: 1.6, textAlign: "center"
          }}>
            RAYOMIND SOLUTIONS<br />RAYOMIND SOLUTIONS<br />RAYOMIND SOLUTIONS
          </div>
        </div>

        {/* CONTENT — above watermark */}
        <div style={{ position: "relative", zIndex: 1 }}>

          {/* HEADER */}
          <div style={{
            background: `linear-gradient(135deg, ${NAVY} 0%, ${LIGHT_NAVY} 100%)`,
            padding: "18px 28px", display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 16
          }}>
            {/* LEFT — Rayomind (issuing entity) */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
              <div style={{
                background: "#fff", borderRadius: 6, padding: "5px 8px",
                display: "flex", alignItems: "center", flexShrink: 0
              }}>
                <img
                  src="/__mockup/images/rayomind-logo.png"
                  alt="Rayomind Solutions LLP"
                  style={{ height: 36, objectFit: "contain" }}
                />
              </div>
              <div>
                <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>
                  Rayomind Solutions LLP
                </div>
                <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 2 }}>
                  Suite No-101, Pocket-6, Sector-2, Rohini, New Delhi – 110085, India
                </div>
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

            {/* CENTER — Hire'in Solutions (operating brand) */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{
                background: "#fff", borderRadius: 5, padding: "3px 5px",
                display: "flex", alignItems: "center"
              }}>
                <img
                  src="/__mockup/images/his-logo.jpg"
                  alt="Hire'in Solutions"
                  style={{ height: 32, objectFit: "contain" }}
                />
              </div>
              <div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
                  Hire'in Solutions
                </div>
                <div style={{ color: ORANGE, fontSize: 9, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 2 }}>
                  A Rayomind Company
                </div>
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ width: 1, height: 48, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />

            {/* RIGHT — Payslip meta */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                background: ORANGE, color: "#fff", fontSize: 9.5, fontWeight: 700,
                padding: "3px 10px", borderRadius: 3, letterSpacing: 1, textTransform: "uppercase",
                display: "inline-block"
              }}>
                Payslip
              </div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 5, fontWeight: 600 }}>
                {sampleData.month} {sampleData.year}
              </div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 2 }}>
                {sampleData.employeeId}
              </div>
            </div>
          </div>

          {/* ORANGE ACCENT LINE */}
          <div style={{ height: 3, background: `linear-gradient(to right, ${ORANGE}, #FBBB6D, ${ORANGE})` }} />

          {/* TITLE */}
          <div style={{
            textAlign: "center", padding: "14px 0 10px",
            borderBottom: `2px solid ${NAVY}`
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700, color: NAVY, letterSpacing: 0.8,
              textTransform: "uppercase"
            }}>
              Payslip for the Month of {sampleData.month} {sampleData.year}
            </span>
          </div>

          {/* EMPLOYEE INFO GRID */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${NAVY}` }}>
            <div style={{ borderRight: `1px solid #C9D5E8` }}>
              <div style={{ background: NAVY, padding: "6px 12px" }}>
                <span style={{ color: "#fff", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Employee Information
                </span>
              </div>
              <InfoRow label="Full Name" value={sampleData.employeeName} shade />
              <InfoRow label="Employee ID" value={sampleData.employeeId} />
              <InfoRow label="Joining Date" value={sampleData.joiningDate} shade />
              <InfoRow label="Designation" value={sampleData.designation} />
              <InfoRow label="Department" value={sampleData.department} shade />
              <InfoRow label="Location" value={sampleData.location} />
              <InfoRow label="Grade" value={sampleData.grade} shade />
              <InfoRow label="Working Days (Month)" value={`${sampleData.daysInMonth} days`} />
              <InfoRow label="Effective Workdays" value={`${sampleData.empEffectiveWorkdays} days`} shade />
              <InfoRow label="Loss of Pay (LOP)" value={`${sampleData.lop} days`} />
            </div>
            <div>
              <div style={{ background: NAVY, padding: "6px 12px" }}>
                <span style={{ color: "#fff", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Bank & Statutory Details
                </span>
              </div>
              <InfoRow label="Bank Name" value={sampleData.bankName} shade />
              <InfoRow label="Account Number" value={sampleData.bankAccountNo} />
              <InfoRow label="PF Number" value={sampleData.pfNo} shade />
              <InfoRow label="PF UAN" value={sampleData.pfUan} />
              <InfoRow label="ESI" value={sampleData.esi} shade />
            </div>
          </div>

          {/* EARNINGS & DEDUCTIONS TABLE */}
          <div style={{ margin: "16px 0 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ background: ORANGE, color: "#fff", padding: "7px 12px", textAlign: "left", fontWeight: 700, letterSpacing: 0.5, width: "50%", fontSize: 11 }}>
                    EARNINGS
                  </th>
                  <th colSpan={2} style={{ background: NAVY, color: "#fff", padding: "7px 12px", textAlign: "left", fontWeight: 700, letterSpacing: 0.5, width: "50%", fontSize: 11 }}>
                    DEDUCTIONS
                  </th>
                </tr>
                <tr style={{ background: "#F0F4FA" }}>
                  <th style={{ padding: "5px 12px", textAlign: "left", color: "#374151", fontWeight: 600, width: "32%", borderBottom: "1px solid #C9D5E8" }}>Component</th>
                  <th style={{ padding: "5px 12px", textAlign: "right", color: "#374151", fontWeight: 600, width: "18%", borderBottom: "1px solid #C9D5E8" }}>Amount (₹)</th>
                  <th style={{ padding: "5px 12px", textAlign: "left", color: "#374151", fontWeight: 600, width: "32%", borderBottom: "1px solid #C9D5E8", borderLeft: "2px solid #C9D5E8" }}>Component</th>
                  <th style={{ padding: "5px 12px", textAlign: "right", color: "#374151", fontWeight: 600, width: "18%", borderBottom: "1px solid #C9D5E8" }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }).map((_, i) => {
                  const e = paddedEarnings[i];
                  const d = paddedDeductions[i];
                  const shade = i % 2 === 1;
                  return (
                    <tr key={i} style={{ background: shade ? "#F7F9FC" : "#fff" }}>
                      <td style={{ padding: "6px 12px", color: "#1a1a1a", borderBottom: "1px solid #E8EDF4" }}>
                        {e ? e.label : ""}
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: "#1a1a1a", borderBottom: "1px solid #E8EDF4" }}>
                        {e ? fmt(e.amount) : ""}
                      </td>
                      <td style={{ padding: "6px 12px", color: "#1a1a1a", borderBottom: "1px solid #E8EDF4", borderLeft: "2px solid #C9D5E8" }}>
                        {d ? d.label : ""}
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "right", color: d && d.amount > 0 ? "#CC2E2E" : "#1a1a1a", borderBottom: "1px solid #E8EDF4" }}>
                        {d && d.amount > 0 ? fmt(d.amount) : d ? "—" : ""}
                      </td>
                    </tr>
                  );
                })}

                {/* TOTALS ROW */}
                <tr style={{ background: "#EEF2F7", fontWeight: 700 }}>
                  <td style={{ padding: "8px 12px", color: NAVY, fontSize: 12, borderTop: `2px solid ${NAVY}` }}>Total Earnings</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#1A7A3C", fontSize: 12, borderTop: `2px solid ${NAVY}` }}>
                    {fmt(totalEarnings)}
                  </td>
                  <td style={{ padding: "8px 12px", color: NAVY, fontSize: 12, borderTop: `2px solid ${NAVY}`, borderLeft: "2px solid #C9D5E8" }}>Total Deductions</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: "#CC2E2E", fontSize: 12, borderTop: `2px solid ${NAVY}` }}>
                    {fmt(totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* NET PAY */}
          <div style={{ background: NAVY, margin: "14px 0 0", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Net Pay for the Month</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 10.5, marginTop: 4, fontStyle: "italic" }}>
                Rupees Thirty Five Thousand Only
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: ORANGE, fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>AMOUNT CREDITED</div>
              <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, letterSpacing: 0.5 }}>
                ₹{fmt(netPay)}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ padding: "12px 20px 16px", borderTop: `3px solid ${ORANGE}`, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 9.5, color: "#6B7280", lineHeight: 1.6 }}>
                  This is a system-generated payslip and does not require a physical signature.
                </div>
                <div style={{ fontSize: 9.5, color: "#6B7280" }}>
                  For queries contact: <span style={{ color: NAVY, fontWeight: 600 }}>hr@rayomind.com</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#9CA3AF", letterSpacing: 0.5 }}>
                  © {sampleData.year} Rayomind Solutions LLP
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, justifyContent: "flex-end" }}>
                  <img src="/__mockup/images/rayomind-logo.png" alt="" style={{ height: 16, opacity: 0.45 }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
