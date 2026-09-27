import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

// The three sleeve bars of the Sleevy brandmark (apps/web/public/logo-mark.svg),
// each with the horizontal direction it slides in from during assembly.
const PIECES: { d: string; direction: 1 | -1 }[] = [
  {
    d: "M0 128C0 57.3076 57.3076 0 128 0H462V48C462 118.692 404.692 176 334 176H0V128Z",
    direction: -1,
  },
  {
    d: "M0 205H334C404.692 205 462 262.308 462 333V381H128C57.3075 381 0 323.692 0 253V205Z",
    direction: 1,
  },
  {
    d: "M0 538C0 467.308 57.3076 410 128 410H462V459C462 529.692 404.692 587 334 587H0V538Z",
    direction: -1,
  },
];

export const Brandmark: React.FC<{
  height: number;
  color?: string;
  /** Frame at which the first bar starts sliding in. Pass a negative value to render fully assembled. */
  assembleFrom?: number;
  staggerFrames?: number;
  pieceDurationFrames?: number;
  /** Horizontal slide distance in viewBox units (462 = the mark's width). */
  slideDistance?: number;
}> = ({
  height,
  color = "#ffffff",
  assembleFrom = 0,
  staggerFrames = 7,
  pieceDurationFrames = 42,
  slideDistance = 180,
}) => {
  const frame = useCurrentFrame();

  return (
    <svg
      width={(height * 462) / 587}
      height={height}
      viewBox="0 0 462 587"
      fill="none"
      style={{ overflow: "visible" }}
    >
      {PIECES.map((piece, i) => {
        const start = assembleFrom + i * staggerFrames;
        const end = start + pieceDurationFrames;
        return (
          <g
            key={i}
            style={{
              opacity: interpolate(frame, [start, start + 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: `${interpolate(
                frame,
                [start, end],
                [piece.direction * slideDistance, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.19, 1, 0.22, 1),
                },
              )}px 0px`,
            }}
          >
            <path d={piece.d} fill={color} />
          </g>
        );
      })}
    </svg>
  );
};
