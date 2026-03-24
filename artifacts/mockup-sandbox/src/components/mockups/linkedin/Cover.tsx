export function Cover() {
  const NAVY = "#1F3A6E";
  const NAVY2 = "#162D57";
  const ORANGE = "#F47C20";

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "#E8EDF4",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif",
      padding: "40px 32px"
    }}>

      {/* COVER CARD — 1584×396 LinkedIn ratio (~4:1) */}
      <div style={{
        width: "100%", maxWidth: 1280,
        aspectRatio: "4 / 1",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(31,58,110,0.22)",
        display: "flex",
        position: "relative"
      }}>

        {/* LEFT HALF — Background photo with gradient overlay */}
        <div style={{
          width: "52%", position: "relative", overflow: "hidden"
        }}>
          <img
            src="/__mockup/images/linkedin-bg.png"
            alt="Hire'in Solutions Team"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
          {/* Gradient fade → right so it blends into the navy panel */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(31,58,110,0.08) 0%, rgba(31,58,110,0.55) 70%, rgba(31,58,110,0.92) 100%)"
          }} />
        </div>

        {/* RIGHT HALF — Navy content panel */}
        <div style={{
          width: "48%",
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
          display: "flex", flexDirection: "column",
          justifyContent: "center",
          padding: "32px 36px 28px 32px",
          position: "relative", overflow: "hidden"
        }}>

          {/* Subtle background pattern */}
          <div style={{
            position: "absolute", top: -60, right: -60,
            width: 220, height: 220, borderRadius: "50%",
            background: "rgba(244,124,32,0.07)"
          }} />
          <div style={{
            position: "absolute", bottom: -40, left: -30,
            width: 160, height: 160, borderRadius: "50%",
            background: "rgba(255,255,255,0.03)"
          }} />

          {/* Logo + company name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, position: "relative", zIndex: 1 }}>
            <div style={{
              background: "#fff", borderRadius: 5, padding: "4px 8px",
              display: "flex", alignItems: "center", flexShrink: 0
            }}>
              <img
                src="/__mockup/images/his-logo.jpg"
                alt="Hire'in Solutions"
                style={{ height: 28, objectFit: "contain" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                A Rayomind Company &nbsp;·&nbsp; EST 2014
              </div>
            </div>
          </div>

          {/* Orange accent line */}
          <div style={{ width: 48, height: 3, background: ORANGE, borderRadius: 2, marginBottom: 14, position: "relative", zIndex: 1 }} />

          {/* Company name — hero text */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              fontSize: 30, fontWeight: 800, color: "#FFFFFF",
              letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 14
            }}>
              Hire'in Solutions
            </div>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.82)", lineHeight: 1.55,
            marginBottom: 20, position: "relative", zIndex: 1, maxWidth: 340
          }}>
            Revolutionizing the hiring process and a pioneer in staffing needs — connecting the right talent with the right opportunity.
          </div>



          {/* Bottom — domain */}
          <div style={{
            position: "absolute", bottom: 14, right: 22,
            fontSize: 9, color: "rgba(255,255,255,0.28)", letterSpacing: 0.5,
            zIndex: 1
          }}>
            hire-in.com
          </div>
        </div>

      </div>
    </div>
  );
}
