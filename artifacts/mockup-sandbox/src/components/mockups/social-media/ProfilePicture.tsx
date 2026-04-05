import { useRef, useState } from "react";
import html2canvas from "html2canvas";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";

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

function ProfilePictureCard({ size, label, id }: { size: number; label: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!ref.current || downloading) return;
    setDownloading(true);
    try {
      await downloadAsPng(ref.current, `hirein-${id}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{label}</div>
      <div style={{ fontSize: 11, color: "#6B7280", marginTop: -8 }}>{size} × {size} px</div>

      <div
        ref={ref}
        data-testid={`profile-picture-${id}`}
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div style={{
          position: "absolute",
          inset: 0,
          border: `${Math.round(size * 0.025)}px solid ${ORANGE}`,
          pointerEvents: "none",
        }} />

        <div style={{
          position: "absolute",
          top: -size * 0.15,
          right: -size * 0.15,
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: "50%",
          background: "rgba(244,124,32,0.08)",
        }} />
        <div style={{
          position: "absolute",
          bottom: -size * 0.1,
          left: -size * 0.1,
          width: size * 0.35,
          height: size * 0.35,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
        }} />

        <img
          src="/__mockup/images/his-logo.jpg"
          alt="Hire'in Solutions HS Monogram"
          style={{
            width: size * 0.7,
            height: size * 0.7,
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
          }}
        />
      </div>

      <div style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: `3px solid ${ORANGE}`,
        marginTop: 8,
        flexShrink: 0,
      }}>
        <div style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY2} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: -size * 0.15,
            right: -size * 0.15,
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: "50%",
            background: "rgba(244,124,32,0.08)",
          }} />
          <img
            src="/__mockup/images/his-logo.jpg"
            alt="HS Logo Circle Preview"
            style={{
              width: size * 0.65,
              height: size * 0.65,
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
            }}
          />
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: -4 }}>Circle crop preview</div>

      <button
        data-testid={`download-${id}`}
        onClick={handleDownload}
        disabled={downloading}
        style={{
          background: downloading ? "#9CA3AF" : NAVY, color: "#fff",
          border: "none", borderRadius: 6,
          padding: "8px 20px", fontSize: 12, fontWeight: 600,
          cursor: downloading ? "not-allowed" : "pointer", letterSpacing: 0.3,
          boxShadow: "0 2px 12px rgba(31,58,110,0.25)",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        ⬇ {downloading ? "Downloading..." : "Download PNG"}
      </button>
    </div>
  );
}

export function ProfilePicture() {
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
      gap: 40,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: NAVY }}>
        Social Media Profile Pictures
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", marginTop: -24 }}>
        Hire'in Solutions — Instagram & Facebook
      </div>

      <div style={{
        display: "flex",
        gap: 60,
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-start",
      }}>
        <ProfilePictureCard size={320} label="Instagram Profile Picture" id="instagram-dp" />
        <ProfilePictureCard size={320} label="Facebook Profile Picture" id="facebook-dp" />
      </div>

      <div style={{ fontSize: 11, color: "#6B7280", maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
        Both profile pictures are designed at 320×320 px for optimal quality.
        The circle preview shows how the image will appear when cropped by the platform.
      </div>
    </div>
  );
}
