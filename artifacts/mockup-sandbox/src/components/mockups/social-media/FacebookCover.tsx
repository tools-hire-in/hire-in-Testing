import { useRef } from "react";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const WIDTH = 851;
const HEIGHT = 315;

function downloadAsImage(el: HTMLDivElement, filename: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${filename}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  @media print {
    @page { size: ${WIDTH}px ${HEIGHT}px; margin: 0; }
    body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  }
</style>
</head>
<body>
${el.outerHTML}
<script>
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

export function FacebookCover() {
  const coverRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      background: "#E8EDF4",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif",
      padding: "40px 32px",
      gap: 20,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>
        Facebook Cover Photo
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: -4 }}>
        {WIDTH} × {HEIGHT} px
      </div>

      <div
        ref={coverRef}
        data-testid="facebook-cover"
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(31,58,110,0.22)",
          flexShrink: 0,
        }}
      >
        <div style={{ width: "52%", position: "relative", overflow: "hidden" }}>
          <img
            src="/__mockup/images/linkedin-bg.png"
            alt="Hire'in Solutions Team"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to right, rgba(31,58,110,0.08) 0%, rgba(31,58,110,0.55) 70%, rgba(31,58,110,0.92) 100%)",
          }} />
        </div>

        <div style={{
          width: "48%",
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "24px 28px 20px 24px",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40,
            width: 160, height: 160, borderRadius: "50%",
            background: "rgba(244,124,32,0.07)",
          }} />
          <div style={{
            position: "absolute", bottom: -30, left: -20,
            width: 120, height: 120, borderRadius: "50%",
            background: "rgba(255,255,255,0.03)",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, position: "relative", zIndex: 1 }}>
            <div style={{
              background: "#fff", borderRadius: 3, padding: 0,
              display: "flex", alignItems: "center", flexShrink: 0,
            }}>
              <img
                src="/__mockup/images/his-logo.jpg"
                alt="Hire'in Solutions"
                style={{ height: 34, objectFit: "contain" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
                A Rayomind Company
              </div>
              <div style={{ fontSize: 9, color: ORANGE, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>
                EST 2014
              </div>
            </div>
          </div>

          <div style={{ width: 40, height: 2.5, background: ORANGE, borderRadius: 2, marginBottom: 10, position: "relative", zIndex: 1 }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              fontSize: 24, fontWeight: 800, color: "#FFFFFF",
              letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 10,
            }}>
              Hire'in Solutions
            </div>
          </div>

          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.5,
            marginBottom: 10, position: "relative", zIndex: 1, maxWidth: 300,
            fontStyle: "italic",
          }}>
            "Where AI Meets Human Intuition"
          </div>

          <div style={{
            fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
            position: "relative", zIndex: 1, maxWidth: 300,
          }}>
            Revolutionizing the hiring process — connecting the right talent with the right opportunity.
          </div>

          <div style={{
            position: "absolute", bottom: 10, right: 16,
            fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 0.5,
            zIndex: 1,
          }}>
            hire-in.com
          </div>
        </div>
      </div>

      <button
        data-testid="download-facebook-cover"
        onClick={() => coverRef.current && downloadAsImage(coverRef.current, "hirein-facebook-cover")}
        style={{
          background: NAVY, color: "#fff",
          border: "none", borderRadius: 6,
          padding: "10px 28px", fontSize: 13, fontWeight: 600,
          cursor: "pointer", letterSpacing: 0.3,
          boxShadow: "0 2px 12px rgba(31,58,110,0.25)",
          display: "flex", alignItems: "center", gap: 8,
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
