import { useRef } from "react";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const WIDTH = 1080;
const HEIGHT = 1920;
const PREVIEW_SCALE = 0.35;

function downloadAsImage(el: HTMLDivElement, filename: string, w: number, h: number) {
  const clone = el.cloneNode(true) as HTMLDivElement;
  clone.style.transform = "none";
  clone.style.transformOrigin = "top left";

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
    @page { size: ${w}px ${h}px; margin: 0; }
    body { width: ${w}px; height: ${h}px; overflow: hidden; }
  }
</style>
</head>
<body>
${clone.outerHTML}
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

function StoryContent() {
  return (
    <>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(to right, ${ORANGE}, #F9A825, ${ORANGE})`,
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 6,
        background: `linear-gradient(to right, ${ORANGE}, #F9A825, ${ORANGE})`,
      }} />

      <div style={{
        position: "absolute", top: -200, right: -200,
        width: 600, height: 600, borderRadius: "50%",
        background: "rgba(244,124,32,0.06)",
      }} />
      <div style={{
        position: "absolute", bottom: -150, left: -150,
        width: 500, height: 500, borderRadius: "50%",
        background: "rgba(244,124,32,0.04)",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: -100,
        width: 350, height: 350, borderRadius: "50%",
        background: "rgba(255,255,255,0.02)",
      }} />

      <div style={{
        position: "absolute", top: 80, left: 0, right: 0,
        display: "flex", justifyContent: "center",
      }}>
        <div style={{
          width: 120, height: 1,
          background: `linear-gradient(to right, transparent, rgba(244,124,32,0.4), transparent)`,
        }} />
      </div>

      <div style={{
        position: "absolute",
        top: 120,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>
          A Rayomind Company
        </div>
        <div style={{ fontSize: 14, color: ORANGE, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>
          EST 2014
        </div>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", zIndex: 1,
      }}>
        <div style={{
          width: 280, height: 280,
          background: "#fff",
          borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          marginBottom: 60,
        }}>
          <img
            src="/__mockup/images/his-logo.jpg"
            alt="Hire'in Solutions"
            style={{ width: 240, height: 240, objectFit: "contain" }}
          />
        </div>

        <div style={{ width: 80, height: 4, background: ORANGE, borderRadius: 2, marginBottom: 40 }} />

        <div style={{
          fontSize: 56, fontWeight: 800, color: "#FFFFFF",
          letterSpacing: -1, lineHeight: 1.1, textAlign: "center",
          marginBottom: 24,
        }}>
          Hire'in
          <br />
          Solutions
        </div>

        <div style={{
          fontSize: 26, color: "rgba(255,255,255,0.75)",
          fontStyle: "italic", textAlign: "center",
          lineHeight: 1.5, maxWidth: 700,
          marginBottom: 50,
        }}>
          "Where AI Meets Human Intuition"
        </div>

        <div style={{
          width: 600, height: 1,
          background: `linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)`,
          marginBottom: 40,
        }} />

        <div style={{
          fontSize: 20, color: "rgba(255,255,255,0.5)",
          textAlign: "center", lineHeight: 1.7, maxWidth: 700,
          letterSpacing: 0.5,
        }}>
          Revolutionizing the hiring process
          <br />
          Connecting the right talent with the right opportunity
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 60,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 120, height: 1,
          background: `linear-gradient(to right, transparent, rgba(244,124,32,0.4), transparent)`,
        }} />
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
          hire-in.com
        </div>
      </div>
    </>
  );
}

export function InstagramStory() {
  const storyRef = useRef<HTMLDivElement>(null);

  const storyBaseStyle: React.CSSProperties = {
    width: WIDTH,
    height: HEIGHT,
    background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY2} 50%, #0F2240 100%)`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      background: "#E8EDF4",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif",
      padding: "40px 32px",
      gap: 20,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>
        Instagram Story / Highlights Cover
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: -4 }}>
        {WIDTH} × {HEIGHT} px (9:16 vertical)
      </div>

      <div
        ref={storyRef}
        data-testid="instagram-story-export"
        style={{
          ...storyBaseStyle,
          position: "absolute",
          left: -99999,
          top: -99999,
          pointerEvents: "none",
        }}
      >
        <StoryContent />
      </div>

      <div style={{
        width: WIDTH * PREVIEW_SCALE,
        height: HEIGHT * PREVIEW_SCALE,
        position: "relative",
        boxShadow: "0 8px 40px rgba(31,58,110,0.22)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <div
          data-testid="instagram-story"
          style={{
            ...storyBaseStyle,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <StoryContent />
        </div>
      </div>

      <button
        data-testid="download-instagram-story"
        onClick={() => storyRef.current && downloadAsImage(storyRef.current, "hirein-instagram-story", WIDTH, HEIGHT)}
        style={{
          background: NAVY, color: "#fff",
          border: "none", borderRadius: 6,
          padding: "10px 28px", fontSize: 13, fontWeight: 600,
          cursor: "pointer", letterSpacing: 0.3,
          boxShadow: "0 2px 12px rgba(31,58,110,0.25)",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        ⬇ Download / Print Story Cover
      </button>
      <div style={{ fontSize: 11, color: "#6B7280" }}>
        In the print dialog → Save as PDF or use "Print to image"
      </div>
    </div>
  );
}
