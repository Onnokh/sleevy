import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { Brandmark } from "../Brandmark";
import { COLORS, FONT_FAMILY, MESH_BACKGROUND } from "../theme";

// The giant mark (base height 1020, rendered at native size so the bars stay
// sharp) scales DOWN into the 96px lockup mark, so the end state is a
// minification — never an upscale.
const GIANT_HEIGHT = 1020;
const GIANT_WIDTH = (GIANT_HEIGHT * 462) / 587;
const LOCKUP_MARK_HEIGHT = 96;

// Landing composition (mirrors the site hero): bold two-line slogan, gray
// subline, then the brandmark + wordmark lockup. The lockup geometry is
// exported so the Explainer can match-cut the mark across the transition.
const SLOGAN_TOP = 300;
export const LOCKUP_CENTER = { x: 855, y: 730 };
export { LOCKUP_MARK_HEIGHT };

const settle = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  easing: Easing.bezier(0.3, 0, 0.15, 1),
};

const riseIn = (frame: number, from: number) => ({
  opacity: interpolate(frame, [from, from + 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  }),
  translate: `0px ${interpolate(frame, [from, from + 20], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  })}px`,
});

export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: MESH_BACKGROUND,
        fontFamily: FONT_FAMILY,
        overflow: "hidden",
      }}
    >
      <Interactive.Div
        name="Slogan"
        style={{
          position: "absolute",
          top: SLOGAN_TOP,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1.08,
          color: COLORS.text,
        }}
      >
        <div style={riseIn(frame, 61)}>One tap to save.</div>
        <div style={riseIn(frame, 69)}>every device in sync.</div>
      </Interactive.Div>
      <Interactive.Div
        name="Subline"
        style={{
          position: "absolute",
          top: SLOGAN_TOP + 268,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 42,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          color: COLORS.muted,
          ...riseIn(frame, 78),
        }}
      >
        Web, Raycast, Google Chrome, MCP, &amp; API
      </Interactive.Div>
      <Interactive.Div
        name="BrandmarkWrapper"
        style={{
          // Giant bars arrive screen-centered, then the whole mark shrinks
          // and glides into the lockup position beneath the slogan.
          position: "absolute",
          left: 960 - GIANT_WIDTH / 2,
          top: 540 - GIANT_HEIGHT / 2,
          width: GIANT_WIDTH,
          height: GIANT_HEIGHT,
          // Settle spans two beats of the 110 BPM track (frames 45 → 78).
          translate: `${interpolate(frame, [45, 78], [0, LOCKUP_CENTER.x - 960], settle)}px ${interpolate(frame, [45, 78], [0, LOCKUP_CENTER.y - 540], settle)}px`,
          scale: String(
            interpolate(
              frame,
              [45, 78],
              [1, LOCKUP_MARK_HEIGHT / GIANT_HEIGHT],
              settle,
            ),
          ),
        }}
      >
        <Brandmark
          height={GIANT_HEIGHT}
          assembleFrom={3}
          staggerFrames={6}
          pieceDurationFrames={26}
          slideDistance={1500}
        />
      </Interactive.Div>
      <Interactive.Div
        name="Wordmark"
        style={{
          position: "absolute",
          left: LOCKUP_CENTER.x + (LOCKUP_MARK_HEIGHT * 462) / 587 / 2 + 22,
          top: LOCKUP_CENTER.y,
          translate: `0px -50%`,
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: COLORS.text,
          opacity: interpolate(frame, [78, 94], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Sleevy
      </Interactive.Div>
    </AbsoluteFill>
  );
};
