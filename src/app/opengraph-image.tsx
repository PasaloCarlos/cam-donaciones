import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "CAM Donaciones — Comedores Sociales de Puerto Rico";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // Embed the logo by fetching it from the site (works locally + on Netlify);
  // gracefully fall back to a text-only card if the fetch fails.
  let logoDataUrl: string | null = null;
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL;
    if (base) {
      const res = await fetch(new URL("/logo-cam.png", base));
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
      }
    }
  } catch {
    logoDataUrl = null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", backgroundColor: "#FBFAF8",
          color: "#1A1714", fontFamily: "sans-serif",
        }}
      >
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoDataUrl} width={210} height={210} style={{ borderRadius: 9999 }} alt="" />
        ) : null}
        <div style={{ marginTop: 36, fontSize: 76, fontWeight: 800, letterSpacing: -1 }}>CAM Donaciones</div>
        <div style={{ marginTop: 14, fontSize: 34, fontWeight: 700, color: "#E8964B" }}>
          Comedores Sociales de Puerto Rico
        </div>
        <div style={{ marginTop: 6, fontSize: 26, color: "#6B655C" }}>Plan de Apoyo Mensual</div>
      </div>
    ),
    { ...size }
  );
}
