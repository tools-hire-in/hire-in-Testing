import { useRef, useState } from "react";
import html2canvas from "html2canvas";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";
const WIDTH = 1080;
const HEIGHT = 1920;
const PREVIEW_SCALE = 0.35;

async function downloadAsPng(el: HTMLDivElement, filename: string) {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    logging: false,
  });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
  const [downloading, setDownloading] = useState(false);

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

  const handleDownload = async () => {
    if (!storyRef.current || downloading) return;
    setDownloading(true);
    try {
      await downloadAsPng(storyRef.current, "hirein-instagram-story");
    } finally {
      setDownloading(false);
    }
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
        onClick={handleDownload}
        disabled={downloading}
        style={{
          background: downloading ? "#9CA3AF" : NAVY, color: "#fff",
          border: "none", borderRadius: 6,
          padding: "10px 28px", fontSize: 13, fontWeight: 600,
          cursor: downloading ? "not-allowed" : "pointer", letterSpacing: 0.3,
          boxShadow: "0 2px 12px rgba(31,58,110,0.25)",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        ⬇ {downloading ? "Downloading..." : "Download PNG"}
      </button>
    </div>
  );
}
