// Brand tokens mirrored from apps/web marketing pages (hero.module.scss,
// _shared.scss, blue-mesh-gradient.tsx).
export const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const COLORS = {
  bg: "#101113",
  meshBase: "#0d101e",
  text: "#ffffff",
  muted: "rgba(255, 255, 255, 0.6)",
  card: "#101113",
  cardBorder: "rgba(255, 255, 255, 0.06)",
  cardHighlight: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.15)",
} as const;

// The hero's indigo / wine-magenta mesh field, baked into radial-gradient
// stops (same approach the site uses for glows — no blur() filters).
export const MESH_BACKGROUND = [
  `radial-gradient(1200px 900px at 19% 32%, rgba(47, 83, 164, 0.30), transparent 70%)`,
  `radial-gradient(1000px 800px at 84% 14%, rgba(128, 57, 127, 0.24), transparent 70%)`,
  `radial-gradient(1100px 850px at 6% 94%, rgba(105, 25, 84, 0.26), transparent 70%)`,
  `radial-gradient(1300px 1000px at 55% 68%, rgba(82, 91, 169, 0.26), transparent 72%)`,
  `linear-gradient(#0d101e, #0d101e)`,
].join(", ");
