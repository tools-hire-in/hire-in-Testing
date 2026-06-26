import { Landmark, ShieldCheck } from "lucide-react";
import { useCompanyProfile } from "@/hooks/use-company-profile";

const ORANGE = "#F47C20";
const ORANGE2 = "#F96D3E";
const WHITE = "#FFFFFF";
const GREEN = "#4ADE80";
const FONT = "'Segoe UI', Arial, sans-serif";

function CredChip({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 7,
        padding: "3px 9px",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: ORANGE,
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          fontFamily: FONT,
        }}
      >
        {label}
      </span>
      <span style={{ color: WHITE, fontSize: 11, fontWeight: 700, fontFamily: FONT, letterSpacing: 0.3 }}>{value}</span>
    </div>
  );
}

// A compact, BD-voiced federal government-contracting credentials strip.
// Designed to sit directly above a deck slide's footer (flexShrink: 0 so the
// slide's flex:1 content gives up the space, never overflowing the canvas).
// All values come from the live company profile so they stay in sync.
export function FederalCredentialsBar() {
  const profile = useCompanyProfile();
  const { uei, cage, samStatus, naicsCodes } = profile;

  return (
    <div
      data-testid="federal-credentials"
      style={{
        flexShrink: 0,
        padding: "8px 24px",
        background: "linear-gradient(90deg, rgba(244,124,32,0.12) 0%, rgba(255,255,255,0.03) 100%)",
        borderTop: "1px solid rgba(244,124,32,0.28)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Landmark size={15} color={WHITE} />
          </div>
          <div style={{ lineHeight: 1.15 }}>
            <p
              style={{
                color: ORANGE,
                fontSize: 9.5,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontFamily: FONT,
                margin: 0,
              }}
            >
              Federal Contracting Credentials
            </p>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, fontFamily: FONT, margin: 0 }}>
              A registered, contract-ready federal vendor
            </p>
          </div>
        </div>

        {samStatus.active && (
          <div
            data-testid="cred-sam-status"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "rgba(74,222,128,0.14)",
              border: "1px solid rgba(74,222,128,0.4)",
              borderRadius: 14,
              padding: "3px 10px",
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={12} color={GREEN} />
            <span style={{ color: GREEN, fontSize: 9.5, fontWeight: 700, fontFamily: FONT, letterSpacing: 0.3 }}>
              SAM.gov Registration · Active
            </span>
          </div>
        )}

        <CredChip label="UEI" value={uei} testId="cred-uei" />
        <CredChip label="CAGE" value={cage} testId="cred-cage" />
      </div>

      {naicsCodes.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              color: "rgba(255,255,255,0.45)",
              fontSize: 8.5,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontFamily: FONT,
              flexShrink: 0,
            }}
          >
            NAICS
          </span>
          {naicsCodes.map((n) => (
            <span
              key={n.code}
              data-testid={`cred-naics-${n.code}`}
              style={{
                display: "inline-flex",
                alignItems: "baseline",
                gap: 4,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "2px 7px",
                fontFamily: FONT,
              }}
            >
              <strong style={{ color: WHITE, fontSize: 9.5, fontWeight: 700 }}>{n.code}</strong>
              {n.label && <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 8.5 }}>{n.label}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
