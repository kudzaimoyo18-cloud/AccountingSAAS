import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Mizan — Books balanced. Taxes ready. Done.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#f6f1e7",
          color: "#1c1d21",
          padding: 72,
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 30,
            color: "#8a6418",
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 46, height: 3, backgroundColor: "#8a6418", display: "flex" }} />
          For UAE free-zone companies
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 92, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
            Books balanced.
          </div>
          <div style={{ fontSize: 92, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, display: "flex", gap: 24 }}>
            Taxes ready.{" "}
            <span style={{ color: "#8a6418", fontStyle: "italic" }}>Done.</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "2px solid #ddd1ba",
            paddingTop: 36,
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 600 }}>Mizan</div>
          <div style={{ fontSize: 26, color: "#54514b", fontFamily: "Arial, sans-serif" }}>
            Accounting & tax, done for you — from AED 349/mo
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
