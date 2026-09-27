import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { Brandmark } from "./Brandmark";
import { FONT_FAMILY } from "./theme";
import { BrandIntro } from "./scenes/BrandIntro";
import { Explainer } from "./scenes/Explainer";
import { EndRoll } from "./scenes/EndRoll";

// A small lockup in the bottom-left corner, present once the intro hands
// off and gone when the EndRoll shows the big lockup itself.
const Watermark: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        left: 44,
        bottom: 34,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: FONT_FAMILY,
        fontSize: 22,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        color: "rgba(255, 255, 255, 0.75)",
        opacity: interpolate(frame, [118, 134, 640, 652], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `0px ${interpolate(frame, [118, 138], [14, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px`,
      }}
    >
      <Brandmark height={26} assembleFrom={-100} />
      sleevy.app
    </div>
  );
};

// 125 + 555 + 118 - 15 - 15 = 768 frames ≈ 25.6s at 30 fps.
//
// The video has no soundtrack. Its timing still follows the 110 BPM grid of
// the track it was cut to (first beat at frame ~12, one beat = 16.36 frames):
// the Explainer starts on the beat at frame 110, the EndRoll at 650.
export const LaunchVideo: React.FC = () => {
  return (
    <>
      <TransitionSeries
        style={{
          translate: "-4px 0px",
        }}
      >
        <TransitionSeries.Sequence durationInFrames={125} name="BrandIntro">
          <BrandIntro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={555} name="Explainer">
          <Explainer />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={118} name="EndRoll">
          <EndRoll />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Watermark />
    </>
  );
};
