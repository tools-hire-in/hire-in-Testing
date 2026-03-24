import { useRef } from "react";

export function Cover() {
  const NAVY = "#1F3A6E";
  const NAVY2 = "#162D57";
  const ORANGE = "#F47C20";
  const coverRef = useRef<HTMLDivElement>(null);

  function handleDownload() {
    const el = coverRef.current;
    if (!el) return;

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Hirein-LinkedIn-Cover</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  @media print {
    @page { size: 1584px 396px; margin: 0; }
    body { width: 1584px; height: 396px; overflow: hidden; }
  }
</style>
</head>
<body>
${el.outerHTML}
<script>
  // Wait for all images to load then print
  const imgs = document.images;
  let loaded = 0;
  const total = imgs.length;
  function tryPrint() {
    loaded++;
    if (loaded >= total) { window.print(); }
  }
  if (total === 0) { window.print(); }
  else { for (let i = 0; i < total; i++) {
    if (imgs[i].complete) { tryPrint(); }
    else { imgs[i].addEventListener('load', tryPrint); imgs[i].addEventListener('error', tryPrint); }
  }}
<\/script>
</body>
</html>`);
    win.document.close();
  }

  return (
    <div style={{
      width: "100%", minHeight: "100vh",
      background: "#E8EDF4",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif",
      padding: "40px 32px",
      gap: 20
    }}>

      {/* COVER CARD — 1584×396 LinkedIn ratio (~4:1) */}
      <div
        ref={coverRef}
        style={{
          width: "100%", maxWidth: 1280,
          aspectRatio: "4 / 1",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(31,58,110,0.22)",
          display: "flex",
          position: "relative"
        }}
      >
        {/* LEFT HALF — Background photo with gradient overlay */}
        <div style={{ width: "52%", position: "relative", overflow: "hidden" }}>
          <img
            src="/__mockup/images/linkedin-bg.png"
            alt="Hire'in Solutions Team"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, position: "relative", zIndex: 1 }}>
            <div style={{
              background: "#fff", borderRadius: 3, padding: "0px",
              display: "flex", alignItems: "center", flexShrink: 0
            }}>
              <img
                src="/__mockup/images/his-logo.jpg"
                alt="Hire'in Solutions"
                style={{ height: 40, objectFit: "contain" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                A Rayomind Company
              </div>
              <div style={{ fontSize: 11, color: ORANGE, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
                EST 2014
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

      {/* Download button */}
      <button
        onClick={handleDownload}
        style={{
          background: NAVY, color: "#fff",
          border: "none", borderRadius: 6,
          padding: "10px 28px", fontSize: 13, fontWeight: 600,
          cursor: "pointer", letterSpacing: 0.3,
          boxShadow: "0 2px 12px rgba(31,58,110,0.25)",
          display: "flex", alignItems: "center", gap: 8
        }}
      >
        ⬇ Download / Print Cover
      </button>
      <div style={{ fontSize: 11, color: "#6B7280" }}>
        In the print dialog → Save as PDF or use "Print to image"
      </div>
    </div>
  );
}
