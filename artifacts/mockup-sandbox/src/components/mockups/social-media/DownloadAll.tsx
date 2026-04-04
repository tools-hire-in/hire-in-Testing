import { useRef } from "react";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";

function downloadAsImage(el: HTMLDivElement, filename: string, width: number, height: number) {
  const clone = el.cloneNode(true) as HTMLDivElement;
  clone.style.transform = "none";
  clone.style.position = "relative";
  clone.style.left = "0";
  clone.style.top = "0";

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
    @page { size: ${width}px ${height}px; margin: 0; }
    body { width: ${width}px; height: ${height}px; overflow: hidden; }
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

function DownloadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: NAVY, color: "#fff",
        border: "none", borderRadius: 5,
        padding: "6px 16px", fontSize: 11, fontWeight: 600,
        cursor: "pointer", letterSpacing: 0.3,
        boxShadow: "0 2px 8px rgba(31,58,110,0.2)",
        display: "flex", alignItems: "center", gap: 6,
      }}
    >
      ⬇ {label}
    </button>
  );
}

function ProfilePictureContent() {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, border: `8px solid ${ORANGE}`, pointerEvents: "none" }} />
      <div style={{
        position: "absolute", top: -48, right: -48,
        width: 160, height: 160, borderRadius: "50%",
        background: "rgba(244,124,32,0.08)",
      }} />
      <div style={{
        position: "absolute", bottom: -32, left: -32,
        width: 112, height: 112, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
      }} />
      <img
        src="/__mockup/images/his-logo.jpg"
        alt="HS Logo"
        style={{ width: 224, height: 224, objectFit: "contain", position: "relative", zIndex: 1 }}
      />
    </>
  );
}

function ProfilePictureAsset({ label, id }: { label: string; id: string }) {
  const exportRef = useRef<HTMLDivElement>(null);

  const baseStyle: React.CSSProperties = {
    width: 320, height: 320,
    background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{label}</div>
      <div style={{ fontSize: 10, color: "#9CA3AF" }}>320 × 320 px</div>

      <div
        ref={exportRef}
        style={{ ...baseStyle, position: "absolute", left: -99999, top: -99999, pointerEvents: "none" }}
      >
        <ProfilePictureContent />
      </div>

      <div style={{ width: 160, height: 160, overflow: "hidden", flexShrink: 0 }}>
        <div
          data-testid={`asset-${id}`}
          style={{ ...baseStyle, transform: "scale(0.5)", transformOrigin: "top left" }}
        >
          <ProfilePictureContent />
        </div>
      </div>

      <div style={{
        width: 120, height: 120, borderRadius: "50%", overflow: "hidden",
        border: `2px solid ${ORANGE}`,
      }}>
        <div style={{
          width: "100%", height: "100%",
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <img src="/__mockup/images/his-logo.jpg" alt="HS" style={{ width: 78, height: 78, objectFit: "contain" }} />
        </div>
      </div>
      <div style={{ fontSize: 9, color: "#9CA3AF" }}>Circle preview</div>
      <DownloadButton onClick={() => exportRef.current && downloadAsImage(exportRef.current, `hirein-${id}`, 320, 320)} label="Download" />
    </div>
  );
}

function FacebookCoverContent() {
  return (
    <>
      <div style={{ width: "52%", position: "relative", overflow: "hidden" }}>
        <img
          src="/__mockup/images/linkedin-bg.png"
          alt="Team"
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
        display: "flex", flexDirection: "column", justifyContent: "center",
        padding: "24px 28px 20px 24px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(244,124,32,0.07)" }} />
        <div style={{ position: "absolute", bottom: -30, left: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.03)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, position: "relative", zIndex: 1 }}>
          <div style={{ background: "#fff", borderRadius: 3, display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img src="/__mockup/images/his-logo.jpg" alt="HS" style={{ height: 34, objectFit: "contain" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>A Rayomind Company</div>
            <div style={{ fontSize: 9, color: ORANGE, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>EST 2014</div>
          </div>
        </div>

        <div style={{ width: 40, height: 2.5, background: ORANGE, borderRadius: 2, marginBottom: 10, position: "relative", zIndex: 1 }} />

        <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 10, position: "relative", zIndex: 1 }}>
          Hire'in Solutions
        </div>

        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginBottom: 10, position: "relative", zIndex: 1, fontStyle: "italic" }}>
          "Where AI Meets Human Intuition"
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, position: "relative", zIndex: 1, maxWidth: 300 }}>
          Revolutionizing the hiring process — connecting the right talent with the right opportunity.
        </div>

        <div style={{ position: "absolute", bottom: 10, right: 16, fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: 0.5, zIndex: 1 }}>
          hire-in.com
        </div>
      </div>
    </>
  );
}

function InstagramStoryContent() {
  return (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `linear-gradient(to right, ${ORANGE}, #F9A825, ${ORANGE})` }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: `linear-gradient(to right, ${ORANGE}, #F9A825, ${ORANGE})` }} />

      <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "rgba(244,124,32,0.06)" }} />
      <div style={{ position: "absolute", bottom: -150, left: -150, width: 500, height: 500, borderRadius: "50%", background: "rgba(244,124,32,0.04)" }} />

      <div style={{ position: "absolute", top: 120, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", letterSpacing: 3, textTransform: "uppercase", fontWeight: 600 }}>A Rayomind Company</div>
        <div style={{ fontSize: 14, color: ORANGE, letterSpacing: 3, textTransform: "uppercase", fontWeight: 700 }}>EST 2014</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          width: 280, height: 280, background: "#fff", borderRadius: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)", marginBottom: 60,
        }}>
          <img src="/__mockup/images/his-logo.jpg" alt="HS" style={{ width: 240, height: 240, objectFit: "contain" }} />
        </div>

        <div style={{ width: 80, height: 4, background: ORANGE, borderRadius: 2, marginBottom: 40 }} />

        <div style={{ fontSize: 56, fontWeight: 800, color: "#fff", letterSpacing: -1, lineHeight: 1.1, textAlign: "center", marginBottom: 24 }}>
          Hire'in<br />Solutions
        </div>

        <div style={{ fontSize: 26, color: "rgba(255,255,255,0.75)", fontStyle: "italic", textAlign: "center", lineHeight: 1.5, maxWidth: 700, marginBottom: 50 }}>
          "Where AI Meets Human Intuition"
        </div>

        <div style={{ width: 600, height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)", marginBottom: 40 }} />

        <div style={{ fontSize: 20, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.7, maxWidth: 700, letterSpacing: 0.5 }}>
          Revolutionizing the hiring process<br />Connecting the right talent with the right opportunity
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ width: 120, height: 1, background: "linear-gradient(to right, transparent, rgba(244,124,32,0.4), transparent)" }} />
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>hire-in.com</div>
      </div>
    </>
  );
}

export function DownloadAll() {
  const fbCoverExportRef = useRef<HTMLDivElement>(null);
  const storyExportRef = useRef<HTMLDivElement>(null);

  const fbCoverStyle: React.CSSProperties = {
    width: 851, height: 315,
    display: "flex", position: "relative", overflow: "hidden",
  };

  const storyStyle: React.CSSProperties = {
    width: 1080, height: 1920,
    background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY2} 50%, #0F2240 100%)`,
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  };

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      background: "#E8EDF4",
      fontFamily: "'Segoe UI', 'Inter', Arial, sans-serif",
      padding: "40px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 40,
    }}>
      <div
        ref={fbCoverExportRef}
        style={{ ...fbCoverStyle, position: "absolute", left: -99999, top: -99999, pointerEvents: "none" }}
      >
        <FacebookCoverContent />
      </div>
      <div
        ref={storyExportRef}
        style={{ ...storyStyle, position: "absolute", left: -99999, top: -99999, pointerEvents: "none" }}
      >
        <InstagramStoryContent />
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          Social Media Assets
        </div>
        <div style={{ fontSize: 14, color: "#6B7280" }}>
          Hire'in Solutions — Instagram & Facebook
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
          Click download on each asset → Save as PDF or "Print to image"
        </div>
      </div>

      <div style={{
        background: "#fff", borderRadius: 12, padding: "28px 32px",
        boxShadow: "0 2px 16px rgba(31,58,110,0.08)",
        width: "100%", maxWidth: 700,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          Profile Pictures
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 20 }}>
          Designed at 320×320 px — displayed as circle on both platforms
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          <ProfilePictureAsset label="Instagram DP" id="ig-dp" />
          <ProfilePictureAsset label="Facebook DP" id="fb-dp" />
        </div>
      </div>

      <div style={{
        background: "#fff", borderRadius: 12, padding: "28px 32px",
        boxShadow: "0 2px 16px rgba(31,58,110,0.08)",
        width: "100%", maxWidth: 900,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          Facebook Cover Photo
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 20 }}>
          851 × 315 px
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: "100%", maxWidth: 851,
            overflow: "hidden", borderRadius: 6,
            boxShadow: "0 4px 20px rgba(31,58,110,0.15)",
          }}>
            <div
              data-testid="asset-fb-cover"
              style={fbCoverStyle}
            >
              <FacebookCoverContent />
            </div>
          </div>
          <DownloadButton onClick={() => fbCoverExportRef.current && downloadAsImage(fbCoverExportRef.current, "hirein-facebook-cover", 851, 315)} label="Download Facebook Cover" />
        </div>
      </div>

      <div style={{
        background: "#fff", borderRadius: 12, padding: "28px 32px",
        boxShadow: "0 2px 16px rgba(31,58,110,0.08)",
        width: "100%", maxWidth: 500,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
          Instagram Story / Highlights Cover
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 20 }}>
          1080 × 1920 px (9:16)
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 216, height: 384,
            borderRadius: 8, overflow: "hidden",
            boxShadow: "0 4px 20px rgba(31,58,110,0.15)",
            position: "relative",
          }}>
            <div
              data-testid="asset-ig-story"
              style={{
                ...storyStyle,
                transform: "scale(0.2)",
                transformOrigin: "top left",
              }}
            >
              <InstagramStoryContent />
            </div>
          </div>
          <DownloadButton onClick={() => storyExportRef.current && downloadAsImage(storyExportRef.current, "hirein-instagram-story", 1080, 1920)} label="Download Story Cover" />
        </div>
      </div>

      <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", maxWidth: 500, lineHeight: 1.6, marginTop: -10 }}>
        Each download opens a new window. Use "Save as PDF" or "Print to image" in the print dialog to save the asset at exact pixel dimensions.
      </div>
    </div>
  );
}
