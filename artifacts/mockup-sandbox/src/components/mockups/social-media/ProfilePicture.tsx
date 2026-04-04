import { useRef } from "react";

const NAVY = "#1F3A6E";
const NAVY2 = "#162D57";
const ORANGE = "#F47C20";

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
    @page { size: 320px 320px; margin: 0; }
    body { width: 320px; height: 320px; overflow: hidden; }
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

function ProfilePictureCard({ size, label, id }: { size: number; label: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null);

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
        onClick={() => ref.current && downloadAsImage(ref.current, `hirein-${id}`)}
        style={{
          background: NAVY, color: "#fff",
          border: "none", borderRadius: 6,
          padding: "8px 20px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", letterSpacing: 0.3,
          boxShadow: "0 2px 12px rgba(31,58,110,0.25)",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        ⬇ Download
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
        Use the download button, then "Save as PDF" or "Print to image".
      </div>
    </div>
  );
}
