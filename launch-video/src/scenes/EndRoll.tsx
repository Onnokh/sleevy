import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  Img,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Brandmark } from "../Brandmark";
import { COLORS, FONT_FAMILY, MESH_BACKGROUND } from "../theme";

// Hierarchy: brand mark → the site (sleevy.app, the hero) → one designed
// row of places to get it. The finale flies everything toward the camera.
// This scene starts on a downbeat (global frame 650 at 110 BPM); local
// beats fall on 0, 17, 33, 49, 66, 82, 98, 115. The exits fire on beats.
const EXIT_START = 65;
const DURATION = 118;

// The platforms row: uniform glass pills in the same vocabulary as the
// agents beat.
const PLATFORM_PILLS: {
  label: string;
  icon?: string;
  mono?: boolean;
  stack?: boolean;
}[] = [
  { label: "iOS", icon: "platforms/ios.webp" },
  { label: "Chrome", icon: "platforms/chrome.webp" },
  { label: "Raycast", icon: "platforms/raycast.webp" },
  { label: "MCP", stack: true },
  { label: "API", mono: true },
];

const accelerate = Easing.bezier(0.5, 0, 0.75, 0.5);
const riseEase = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// Fly toward the camera: scale up hard along a direction vector while
// fading out over the last stretch of the flight.
const flyOut = (
  frame: number,
  from: number,
  peakScale: number,
  dirY = 0,
  dur = 16,
) => ({
  scale: interpolate(frame, [from, from + dur], [1, peakScale], {
    ...clamp,
    easing: accelerate,
  }),
  y: interpolate(frame, [from, from + dur], [0, dirY], {
    ...clamp,
    easing: accelerate,
  }),
  opacity: interpolate(frame, [from + dur * 0.5, from + dur], [1, 0], clamp),
});

const riseIn = (frame: number, from: number) => ({
  opacity: interpolate(frame, [from, from + 14], [0, 1], { ...clamp, easing: riseEase }),
  translate: `0px ${interpolate(frame, [from, from + 18], [28, 0], {
    ...clamp,
    easing: riseEase,
  })}px`,
});

const EndContent: React.FC = () => {
  const frame = useCurrentFrame();

  // Exit on consecutive beats, peeling away around the URL: the mark goes
  // first, the platforms row follows, and sleevy.app — the takeaway — holds
  // the frame alone for a beat before flying at the camera.
  const markExit = flyOut(frame, EXIT_START, 6);
  const rowExit = flyOut(frame, EXIT_START + 17, 3.5, 200);
  const domainExit = flyOut(frame, EXIT_START + 33, 7);

  return (
    <AbsoluteFill
      style={{
        background: MESH_BACKGROUND,
        fontFamily: FONT_FAMILY,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 0,
      }}
    >
      <Interactive.Div
        name="EndBrandmark"
        style={{
          scale: String(
            interpolate(frame, [0, 60], [1.08, 1], {
              ...clamp,
              easing: riseEase,
              output: "perceptual-scale",
            }) * markExit.scale,
          ),
          opacity: markExit.opacity,
        }}
      >
        <Brandmark height={170} assembleFrom={-100} />
      </Interactive.Div>
      <Interactive.Div
        name="Domain"
        style={{
          marginTop: 52,
          fontSize: 116,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: COLORS.text,
          ...riseIn(frame, 4),
          opacity:
            interpolate(frame, [4, 18], [0, 1], { ...clamp, easing: riseEase }) *
            domainExit.opacity,
          scale: String(domainExit.scale),
        }}
      >
        sleevy.app
      </Interactive.Div>
      <Interactive.Div
        name="Platforms"
        style={{
          marginTop: 72,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          opacity:
            interpolate(frame, [16, 28], [0, 1], { ...clamp, easing: riseEase }) *
            rowExit.opacity,
          scale: String(rowExit.scale),
          translate: `0px ${rowExit.y}px`,
        }}
      >
        <div
          style={{
            fontSize: 21,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.muted,
            ...riseIn(frame, 16),
          }}
        >
          Available on
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {PLATFORM_PILLS.map((pill, i) => (
            <div
              key={pill.label}
              style={{
                height: 58,
                padding: "0 24px 0 18px",
                borderRadius: 29,
                backgroundColor: "rgba(255, 255, 255, 0.07)",
                border: `1px solid ${COLORS.cardBorder}`,
                boxShadow: COLORS.cardHighlight,
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 23,
                fontWeight: 600,
                color: COLORS.text,
                ...riseIn(frame, 26 + i * 4),
              }}
            >
              {pill.icon && (
                <Img
                  src={staticFile(pill.icon)}
                  style={{ width: 30, height: 30, borderRadius: 8 }}
                />
              )}
              {pill.stack && (
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Img
                    src={staticFile("favicons/claude.ai.png")}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      border: "2px solid #14151d",
                    }}
                  />
                  <Img
                    src={staticFile("favicons/openai.com.png")}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      border: "2px solid #14151d",
                      marginLeft: -10,
                      filter: "invert(1)",
                    }}
                  />
                </div>
              )}
              {pill.label === "API" && (
                <span
                  style={{
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                    fontSize: 20,
                    fontWeight: 700,
                    color: COLORS.muted,
                  }}
                >
                  {"</>"}
                </span>
              )}
              {pill.label}
            </div>
          ))}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const EndRoll: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: MESH_BACKGROUND }}>
      {/* The exit deserves motion blur; the calm entrance does not need it. */}
      <Sequence durationInFrames={EXIT_START} layout="absolute-fill">
        <EndContent />
      </Sequence>
      <Sequence
        from={EXIT_START}
        trimBefore={EXIT_START}
        durationInFrames={DURATION - EXIT_START}
        layout="absolute-fill"
      >
        <CameraMotionBlur shutterAngle={200} samples={4}>
          <EndContent />
        </CameraMotionBlur>
      </Sequence>
    </AbsoluteFill>
  );
};
