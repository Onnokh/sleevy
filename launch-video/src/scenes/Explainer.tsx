import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { Brandmark } from "../Brandmark";
import { LOCKUP_CENTER, LOCKUP_MARK_HEIGHT } from "./BrandIntro";
import { COLORS, FONT_FAMILY, MESH_BACKGROUND } from "../theme";

const FAVICONS = [
  "github.com",
  "youtube.com",
  "wikipedia.org",
  "medium.com",
  "nytimes.com",
  "reddit.com",
  "stackoverflow.com",
  "x.com",
  "figma.com",
  "notion.so",
  "substack.com",
  "theverge.com",
  "dev.to",
  "producthunt.com",
  "arstechnica.com",
  "stripe.com",
  "vercel.com",
  "dribbble.com",
];

// 30 icons flood in; the first 18 (distinct domains) end up saved into the
// grid, the 12 extras get absorbed into the sweeping brandmark.
const SAVED_COUNT = FAVICONS.length;
const TOTAL_ICONS = 30;

// Story beats: flood → sweep → grid ("Saved. Sorted.") → agents streaming
// links through MCP & API → the app builds itself, in sync on every device.
//
// The soundtrack runs at 110 BPM and this scene starts on a downbeat
// (global frame 110), so scene-local beats fall on 0, 17, 33, 49, 66, 82,
// 99, 115, 131, 148, 164, 180, 197, 213, ... — key hits are snapped to it.
const BEAT = 1800 / 110; // 16.36 frames per beat at 30 fps
// The flood icons land in three waves, banging on the song's hits.
const WAVE_LANDINGS = [19, 34, 48];
const SWEEP_START = 49; // on the beat
const SWEEP_END = 99; // lands on the beat, three beats later
const BLAST = 148; // grid icons blast past the camera, on the beat

// Agents beat: the mark hovers while links stream between it and the ports.
const MARK_IN = 154; // glide-in completes on the beat at 176
const STREAM_COUNT = 14;
const STREAM_FLIGHT = 16; // frames a streamed link flies into the mark
// Streamed links land on half-beats, starting on the beat at 180.
const STREAM_FIRST_LANDING = 180;
const MARK_POS = { x: 960, y: 590 };
const AGENTS_OUT = 295; // mark and ports whip out on the beat

// Sync beat: the empty card grows out of the mark to its full-frame apex,
// THEN builds itself in three calm groups — sidebar flying in from the
// right, header, then the rows piece by piece (the queue filling up) —
// and finally settles aside for the phone.
const BUILD_IN = 328; // the apex hits on the beat, the build starts
const DROP = {
  sidebar: BUILD_IN + 2, // panel arrival lands on the beat at 344
  header: BUILD_IN + 51, // header arrival lands on the beat at 393
  rows: BUILD_IN + 59, // +4 per row (quarter-beats), last settles ~437
};
const REVEAL_END = 475; // card settles aside on the beat
const PHONE_IN = 469; // phone arrival lands on the beat at 491
const SYNC_PULSE = 508; // sync rings flash on the beat
const SCENE_DURATION = 555; // hands off to the EndRoll on the beat at 650

// The sweeper glides across this x range while sweeping.
const SWEEP_FROM_X = -500;
const SWEEP_TO_X = 2300;

// The demo Inbox content — real Saved Items from the actual app, shared by
// the desktop card and the phone so the "in sync" claim is literal.
const ROWS = [
  { title: "App Icons", domain: "www.appicons.store", favicon: "appicons.store", date: "10h" },
  { title: "Agents' behavior in the OpenAI / Hugging Face incident", domain: "metr.org", favicon: "metr.org", date: "10h" },
  { title: "eslint/complexity | Oxlint", domain: "oxc.rs", favicon: "oxc.rs", date: "Aug 26" },
  { title: "Vercel Security Dashboard is now generally available", domain: "vercel.com", favicon: "vercel.com", date: "Aug 26" },
  { title: "Make your site work for agents", domain: "ora.ai", favicon: "ora.ai", date: "Aug 21" },
  { title: "Tiny, open, native coding agent", domain: "fx.sh", favicon: "fx.sh", date: "Aug 19" },
  { title: "Designing AI with character: building Berd", domain: "block.xyz", favicon: "block.xyz", date: "Aug 18" },
  { title: "SolidJS", domain: "www.solidjs.com", favicon: "solidjs.com", date: "Aug 16" },
  { title: "Inside a TanStack Router Navigation", domain: "tanstack.com", favicon: "tanstack.com", date: "Aug 15" },
  { title: "Understanding Monomorphism for 60x JS performance", domain: "www.builder.io", favicon: "builder.io", date: "Aug 14" },
  { title: "OpenCode slash command for happy-path-first design", domain: "gist.github.com", favicon: "github.com", date: "Aug 13" },
];

const SIDEBAR_FOLDERS = [
  { name: "AI", count: "" },
  { name: "Articles", count: "34" },
  { name: "Design", count: "20" },
  { name: "Libraries", count: "44" },
  { name: "SEO", count: "7" },
];

// Phone geometry: matches the settled desktop card's vertical bounds
// (y 306–914), which also gives true iPhone proportions at 280 wide.
const PHONE = { x: 1470, y: 307, w: 280, h: 606, rowsTop: 168, rowH: 62 };

// Deterministic pseudo-random in [0, 1) per (index, salt).
const seeded = (i: number, salt: number) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Golden-ratio sequence for even coverage (consecutive sine hashes cluster),
// plus seeded jitter so the low-discrepancy lattice doesn't read as diagonal
// lines. Stays below the headline band (top ~230px).
const frac = (v: number) => v - Math.floor(v);
const chaosPos = (i: number) => ({
  x: 200 + frac(i * 0.618034 + 0.13) * 1520 + (seeded(i, 7) - 0.5) * 280,
  y: 300 + frac(i * 0.754878 + 0.37) * 660 + (seeded(i, 8) - 0.5) * 220,
});

// The frame at which the sweeper's leading edge passes an icon's x position.
const captureFrame = (i: number) =>
  SWEEP_START +
  ((chaosPos(i).x - SWEEP_FROM_X) / (SWEEP_TO_X - SWEEP_FROM_X)) *
    (SWEEP_END - SWEEP_START);

// Saved icons take grid cells in sweep order (left to right), so the grid
// assembles column by column in the sweeper's wake.
const savedByX = Array.from({ length: SAVED_COUNT }, (_, i) => i).sort(
  (a, b) => chaosPos(a).x - chaosPos(b).x,
);
const rankOf = new Map(savedByX.map((iconIndex, rank) => [iconIndex, rank]));

// Grid: 6 columns x 3 rows, centered at (960, 640), filled column-first.
const GRID_CELL = 150;
const gridPos = (rank: number) => ({
  x: 585 + Math.floor(rank / 3) * GRID_CELL,
  y: 640 + ((rank % 3) - 1) * GRID_CELL,
});

const Headline: React.FC<{
  children: React.ReactNode;
  name: string;
  inFrom: number;
  outFrom: number;
}> = ({ children, name, inFrom, outFrom }) => {
  const frame = useCurrentFrame();
  if (frame < inFrom - 2 || frame > outFrom + 12) {
    return null;
  }
  return (
    <Interactive.Div
      name={name}
      style={{
        position: "absolute",
        top: 130,
        left: 0,
        right: 0,
        zIndex: 10,
        textAlign: "center",
        fontSize: 84,
        fontWeight: 700,
        letterSpacing: "-0.04em",
        color: COLORS.text,
        opacity: interpolate(frame, [inFrom, inFrom + 8, outFrom, outFrom + 8], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        // Slam in with a scale punch, drift up and grow slightly on exit.
        scale: String(
          interpolate(frame, [inFrom, inFrom + 12, outFrom, outFrom + 10], [0.8, 1, 1, 1.06], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [Easing.bezier(0.19, 1, 0.22, 1), Easing.linear, Easing.bezier(0.4, 0, 1, 1)],
            output: "perceptual-scale",
          }),
        ),
        translate: `0px ${interpolate(frame, [inFrom, inFrom + 12], [70, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.19, 1, 0.22, 1),
        })}px`,
      }}
    >
      {children}
    </Interactive.Div>
  );
};

// The brandmark squeegee. It IS the intro's lockup mark: during the
// crossfade both scenes draw it at the identical spot (match cut), then it
// winds up off-left while the flood rains in, growing to sweeper size, and
// sweeps through capturing every icon whose x it passes.
const Sweeper: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame > SWEEP_END + 8) {
    return null;
  }

  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  const path = [14, SWEEP_START - 3, SWEEP_START, SWEEP_END];
  const pathEase = [
    Easing.bezier(0.45, 0, 0.55, 1),
    Easing.linear,
    Easing.bezier(0.45, 0, 0.55, 1),
  ];

  const x = interpolate(frame, path, [LOCKUP_CENTER.x, -430, SWEEP_FROM_X, SWEEP_TO_X], {
    ...clamp,
    easing: pathEase,
  });
  const y = interpolate(frame, path, [LOCKUP_CENTER.y, 640, 640, 640], {
    ...clamp,
    easing: pathEase,
  });
  const height = interpolate(frame, path, [LOCKUP_MARK_HEIGHT, 380, 380, 380], {
    ...clamp,
    easing: pathEase,
  });
  const width = (height * 462) / 587;
  // The hover bob fades in with the wind-up so the match cut stays still.
  const bob =
    Math.sin(frame * 0.18) *
    14 *
    interpolate(frame, [14, 50], [0, 1], clamp);

  return (
    <Interactive.Div
      name="Sweeper"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 5,
        translate: `${x - width / 2}px ${y - height / 2 + bob}px`,
        rotate: `${interpolate(frame, path, [0, -6, -6, -6], { ...clamp, easing: pathEase })}deg`,
        opacity: interpolate(frame, [SWEEP_END - 4, SWEEP_END + 6], [1, 0], clamp),
      }}
    >
      <Brandmark height={height} assembleFrom={-100} />
    </Interactive.Div>
  );
};

// A subtle settle: fade in with a short directional glide into place.
const settleStyle = (
  frame: number,
  from: number,
  dx = 0,
  dy = -28,
  dur = 12,
): React.CSSProperties => ({
  opacity: interpolate(frame, [from, from + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }),
  translate: `${interpolate(frame, [from, from + dur], [dx, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  })}px ${interpolate(frame, [from, from + dur], [dy, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.19, 1, 0.22, 1),
  })}px`,
});

// The desktop app, rebuilt as components so the flyover stays vector-crisp.
// It assembles piece by piece beneath the camera: sidebar panel first, its
// items cascading, then the header drops in, then the rows stream in.
const InboxApp: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: 1460,
        height: 920,
        borderRadius: 24,
        display: "flex",
        backgroundColor: "#101113",
        border: `2px solid ${COLORS.cardBorder}`,
        boxShadow: `${COLORS.cardHighlight}, 0 40px 100px rgba(0, 0, 0, 0.5)`,
      }}
    >
      <div
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: `1px solid ${COLORS.cardBorder}`,
          padding: "26px 20px",
          position: "relative",
          fontSize: 17,
          color: COLORS.muted,
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          // The panel surface arrives first, then its items cascade in.
          ...settleStyle(frame, DROP.sidebar, 320, 0, 14),
        }}
      >
        {/* Items fly in from the right, subtly staggered top to bottom. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 30,
            ...settleStyle(frame, DROP.sidebar + 10, 48, 0, 12),
          }}
        >
          <Brandmark height={28} assembleFrom={-100} />
          <span style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.03em" }}>
            Sleevy
          </span>
        </div>
        {["Capture item", "Settings", "Keyboard shortcuts"].map((item, i) => (
          <div
            key={item}
            style={{ padding: "8px 10px", ...settleStyle(frame, DROP.sidebar + 12 + i * 2, 48, 0, 12) }}
          >
            {item}
          </div>
        ))}
        <div style={{ fontSize: 14, margin: "22px 10px 8px", opacity: 0.7, ...settleStyle(frame, DROP.sidebar + 18, 48, 0, 12) }}>
          Sleeve
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "9px 10px",
            borderRadius: 8,
            backgroundColor: "rgba(255, 255, 255, 0.07)",
            color: COLORS.text,
            ...settleStyle(frame, DROP.sidebar + 20, 48, 0, 12),
          }}
        >
          <span>Inbox</span>
          <span style={{ color: COLORS.muted }}>81</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "9px 10px",
            ...settleStyle(frame, DROP.sidebar + 22, 48, 0, 12),
          }}
        >
          <span>Library</span>
          <span>13</span>
        </div>
        <div style={{ fontSize: 14, margin: "22px 10px 8px", opacity: 0.7, ...settleStyle(frame, DROP.sidebar + 24, 48, 0, 12) }}>
          Folders
        </div>
        {SIDEBAR_FOLDERS.map((folder, i) => (
          <div
            key={folder.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "8px 10px",
              ...settleStyle(frame, DROP.sidebar + 26 + i * 2, 48, 0, 12),
            }}
          >
            <span>{folder.name}</span>
            <span>{folder.count}</span>
          </div>
        ))}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            left: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            ...settleStyle(frame, DROP.sidebar + 38, 48, 0, 12),
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: "linear-gradient(135deg, #525BA9, #80397F)",
            }}
          />
          <span style={{ fontSize: 15 }}>Onno Klein Hofmeijer</span>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <div
          style={{
            height: 180,
            background: [
              "radial-gradient(420px 220px at 68% -10%, rgba(247, 85, 171, 0.4), transparent 70%)",
              "radial-gradient(520px 260px at 88% -20%, rgba(82, 91, 169, 0.55), transparent 70%)",
              "radial-gradient(400px 200px at 45% -15%, rgba(128, 57, 127, 0.35), transparent 70%)",
              "linear-gradient(#17181c, #101113)",
            ].join(", "),
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "0 44px 18px",
            // The whole header settles in as one unit.
            ...settleStyle(frame, DROP.header, 0, -44, 14),
          }}
        >
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: COLORS.text,
              letterSpacing: "-0.03em",
            }}
          >
            Inbox
          </div>
          <div style={{ fontSize: 17, color: COLORS.muted, marginTop: 6 }}>
            81 unread
          </div>
        </div>
        <div style={{ padding: "10px 44px" }}>
          {ROWS.map((row, i) => {
            // The rows are the build: they settle in on quarter-beats.
            const rowIn = DROP.rows + i * 4;
            return (
              <div
                key={row.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  height: 62,
                  borderBottom: `1px solid rgba(255, 255, 255, 0.04)`,
                  ...settleStyle(frame, rowIn, 0, -22, 10),
                }}
              >
                <Img
                  src={staticFile(`favicons/${row.favicon}.png`)}
                  style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: COLORS.text,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.title}
                  </div>
                  <div style={{ fontSize: 14, color: COLORS.muted, marginTop: 3 }}>{row.domain}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.7)" }} />
                  <span style={{ fontSize: 15, color: COLORS.muted }}>{row.date}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// The build stage: the card bursts in from the icon blast and then never
// sits still — a slow product-shot rotation and push-in carry it through
// the calm three-group build, until it straightens flat and glides aside
// for the phone.
const InboxAppPlane: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < AGENTS_OUT - 2) {
    return null;
  }

  const settle = Easing.bezier(0.3, 0, 0.15, 1);
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
  // Two motions: the empty card grows out of the dissolving mark's
  // footprint in one arc to its apex, holds there (with a barely-there
  // drift) while the UI builds, then settles to the side-by-side position.
  const camFrames = [AGENTS_OUT + 2, BUILD_IN, REVEAL_END - 26, REVEAL_END];
  const camEase = [Easing.bezier(0.35, 0, 0.25, 1), Easing.linear, settle];

  const scale = interpolate(frame, camFrames, [0.16, 1.02, 1.08, 0.66], {
    ...clamp,
    easing: camEase,
  });
  const screenX = interpolate(frame, [REVEAL_END - 26, REVEAL_END], [0, -180], {
    ...clamp,
    easing: settle,
  });
  const screenY = interpolate(frame, camFrames, [50, 0, 0, 70], {
    ...clamp,
    easing: camEase,
  });

  return (
    <AbsoluteFill>
      <Interactive.Div
        name="InboxAppPlane"
        style={{
          position: "absolute",
          left: 230,
          top: 80,
          width: 1460,
          height: 920,
          transformOrigin: "50% 50%",
          translate: `${screenX}px ${screenY}px`,
          scale: String(scale),
          opacity: interpolate(frame, [AGENTS_OUT + 2, AGENTS_OUT + 10], [0, 1], clamp),
        }}
      >
        <InboxApp />
        {/* Sync pulse ring on the settled card. */}
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 24,
            border: "4px solid rgba(255, 255, 255, 0.8)",
            pointerEvents: "none",
            opacity: interpolate(frame, [SYNC_PULSE, SYNC_PULSE + 6, SYNC_PULSE + 18], [0, 0.7, 0], clamp),
          }}
        />
      </Interactive.Div>
    </AbsoluteFill>
  );
};

// The iOS app: status bar, capture pill, large Inbox title — the same rows
// as the desktop card, because the queue is in sync.
const PhoneApp: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < PHONE_IN - 2) {
    return null;
  }

  const ringOpacity = interpolate(
    frame,
    [SYNC_PULSE + 8, SYNC_PULSE + 14, SYNC_PULSE + 26],
    [0, 0.7, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <Interactive.Div
      name="PhoneApp"
      style={{
        position: "absolute",
        left: PHONE.x,
        top: PHONE.y,
        width: PHONE.w,
        height: PHONE.h,
        borderRadius: 40,
        border: `2px solid ${COLORS.cardBorder}`,
        backgroundColor: "#0b0b0d",
        boxShadow: `${COLORS.cardHighlight}, 0 30px 80px rgba(0, 0, 0, 0.45)`,
        overflow: "hidden",
        opacity: interpolate(frame, [PHONE_IN, PHONE_IN + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: `${interpolate(frame, [PHONE_IN, PHONE_IN + 22], [360, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.22, 1.35, 0.36, 1),
        })}px 0px`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "radial-gradient(220px 150px at 30% -6%, rgba(128, 57, 127, 0.5), transparent 70%)",
            "radial-gradient(180px 130px at 75% -8%, rgba(82, 91, 169, 0.45), transparent 70%)",
          ].join(", "),
          pointerEvents: "none",
        }}
      />
      {/* Status bar + dynamic island */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 22px 0",
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.text,
        }}
      >
        <span>09:41</span>
        <div style={{ width: 22, height: 11, borderRadius: 3.5, border: "1px solid rgba(255,255,255,0.6)", padding: 1.5 }}>
          <div style={{ width: "80%", height: "100%", borderRadius: 2, backgroundColor: COLORS.text }} />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 10,
          left: "50%",
          width: 76,
          height: 20,
          borderRadius: 11,
          backgroundColor: "#000",
          translate: "-50% 0",
        }}
      />
      {/* Capture pill */}
      <div
        style={{
          position: "absolute",
          top: 44,
          right: 18,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 7px 5px 12px",
          borderRadius: 17,
          backgroundColor: "rgba(255, 255, 255, 0.1)",
          fontSize: 15,
          color: COLORS.text,
        }}
      >
        +
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            background: "linear-gradient(135deg, #525BA9, #80397F)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          OK
        </div>
      </div>
      <div style={{ padding: "48px 24px 0" }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Inbox
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>81 unread</div>
      </div>
      <div style={{ position: "absolute", top: PHONE.rowsTop, left: 24, right: 20 }}>
        {ROWS.slice(0, 7).map((row, i) => {
          const rowIn = PHONE_IN + 12 + i * 3;
          return (
            <div
              key={row.title}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                height: PHONE.rowH,
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                opacity: interpolate(frame, [rowIn, rowIn + 10], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <Img
                src={staticFile(`favicons/${row.favicon}.png`)}
                style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.title}
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{row.domain}</div>
              </div>
              <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{row.date}</span>
            </div>
          );
        })}
      </div>
      {/* Sync pulse ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 38,
          border: "3px solid rgba(255, 255, 255, 0.8)",
          pointerEvents: "none",
          opacity: ringOpacity,
        }}
      />
    </Interactive.Div>
  );
};

// The agents beat, in the sweep's visual language: the brandmark hovers
// while favicon tiles stream between it and two named ports — MCP and API.
// Inbound tiles are agents saving links; a few flow back out, agents
// retrieving from the Sleeve. Access, both directions.
// Claude and OpenAI stand for MCP agents; the </> chip is the REST API —
// links flowing from code. The ports triangulate around the centered mark,
// hub-and-spoke: everything connects to Sleevy.
const PORTS: { label: string; icon?: string; x: number; y: number }[] = [
  { label: "Claude", icon: "favicons/claude.ai.png", x: 430, y: 390 },
  { label: "OpenAI", icon: "favicons/openai.com.png", x: 1490, y: 390 },
  { label: "API", x: 960, y: 935 },
];

const STREAM_TILES = Array.from({ length: STREAM_COUNT }, (_, i) => ({
  index: i,
  port: PORTS[i % PORTS.length],
  // A few tiles flow the other way: the agent reading from the Sleeve.
  outbound: i === 5 || i === 9 || i === 12,
  // Each landing hits a half-beat of the 110 BPM track.
  launch: Math.round(STREAM_FIRST_LANDING + (i * BEAT) / 2) - STREAM_FLIGHT,
}));

// The mark swells when it absorbs an inbound tile or emits an outbound one.
const markSwellTimes = STREAM_TILES.map((tile) =>
  tile.outbound ? tile.launch : tile.launch + STREAM_FLIGHT,
);

// A port chip pulses when a tile departs from it or arrives at it.
const portPulseTimes = (port: (typeof PORTS)[number]) =>
  STREAM_TILES.filter((tile) => tile.port === port).map((tile) =>
    tile.outbound ? tile.launch + STREAM_FLIGHT : tile.launch,
  );

const PortChip: React.FC<{ port: (typeof PORTS)[number]; index: number }> = ({
  port,
  index,
}) => {
  const frame = useCurrentFrame();
  const appear = MARK_IN + 8 + index * 6;
  if (frame < appear - 2 || frame > AGENTS_OUT + 16) {
    return null;
  }

  let pulse = 0;
  for (const at of portPulseTimes(port)) {
    pulse += interpolate(frame, [at, at + 3, at + 10], [0, 0.08, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <Interactive.Div
      name={`Port-${port.label}`}
      style={{
        // A labeled glass pill (the site's card recipe), visually distinct
        // from the white saved-link tiles: this is a source, not a bookmark.
        position: "absolute",
        left: port.x,
        top: port.y,
        height: 68,
        padding: "0 26px 0 18px",
        borderRadius: 34,
        backgroundColor: "rgba(255, 255, 255, 0.07)",
        border: `1px solid ${COLORS.cardBorder}`,
        boxShadow: COLORS.cardHighlight,
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontSize: 26,
        fontWeight: 600,
        color: COLORS.text,
        zIndex: 5,
        marginTop: -34,
        opacity:
          interpolate(frame, [appear, appear + 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) *
          interpolate(frame, [AGENTS_OUT, AGENTS_OUT + 12], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        // The pills recede quietly while the mark opens into the app.
        scale: String(
          interpolate(frame, [appear, appear + 16], [0.4, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.34, 1.5, 0.64, 1),
            output: "perceptual-scale",
          }) *
            interpolate(frame, [AGENTS_OUT, AGENTS_OUT + 12], [1, 0.8], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }) +
            pulse,
        ),
        translate: `-50% ${Math.sin(frame * 0.07 + index * 2) * 7}px`,
      }}
    >
      {port.icon ? (
        <Img
          src={staticFile(port.icon)}
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            // The OpenAI blossom is black; invert it to white on the glass.
            filter: port.label === "OpenAI" ? "invert(1)" : undefined,
          }}
        />
      ) : (
        <span
          style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            fontSize: 25,
            fontWeight: 700,
          }}
        >
          {"</>"}
        </span>
      )}
      {port.label}
    </Interactive.Div>
  );
};

const AgentMark: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < MARK_IN - 2 || frame > AGENTS_OUT + 16) {
    return null;
  }

  let swell = 0;
  for (const at of markSwellTimes) {
    swell += interpolate(frame, [at, at + 3, at + 10], [0, 0.045, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <Interactive.Div
      name="AgentMark"
      style={{
        position: "absolute",
        left: MARK_POS.x,
        top: MARK_POS.y,
        zIndex: 5,
        opacity:
          interpolate(frame, [MARK_IN, MARK_IN + 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) *
          interpolate(frame, [AGENTS_OUT, AGENTS_OUT + 12], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        translate: `calc(-50% + ${interpolate(frame, [MARK_IN, MARK_IN + 22], [420, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.19, 1, 0.22, 1),
        })}px) calc(-50% + ${Math.sin(frame * 0.14) * 12}px)`,
        rotate: "-6deg",
        // The mark opens up into the app: it swells and dissolves exactly as
        // the card grows out of its footprint.
        scale: String(
          (1 + swell) *
            interpolate(frame, [AGENTS_OUT, AGENTS_OUT + 14], [1, 1.9], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.3, 0, 0.7, 1),
            }),
        ),
      }}
    >
      <Brandmark height={360} assembleFrom={-100} />
    </Interactive.Div>
  );
};

const StreamTile: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const tile = STREAM_TILES[index];
  const land = tile.launch + STREAM_FLIGHT;
  if (frame < tile.launch || frame > land + 2) {
    return null;
  }

  const domain = FAVICONS[(index * 5 + 3) % FAVICONS.length];
  const from = tile.outbound ? MARK_POS : { x: tile.port.x, y: tile.port.y };
  const to = tile.outbound ? { x: tile.port.x, y: tile.port.y } : MARK_POS;

  const progress = interpolate(frame, [tile.launch, land], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.7, 1),
  });
  const x = from.x + (to.x - from.x) * progress;
  const y =
    from.y + (to.y - from.y) * progress - 70 * Math.sin(progress * Math.PI);
  // Small near the mark, full-size near the port — in both directions.
  const size = tile.outbound ? 38 + 46 * progress : 84 - 46 * progress;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: size,
        height: size,
        borderRadius: size * 0.24,
        backgroundColor: "#ffffff",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4,
        translate: `${x - size / 2}px ${y - size / 2}px`,
        rotate: `${(seeded(index, 12) - 0.5) * 30 * (1 - progress)}deg`,
        opacity: interpolate(
          frame,
          [tile.launch, tile.launch + 3, land - 2, land + 1],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        ),
      }}
    >
      <Img
        src={staticFile(`favicons/${domain}.png`)}
        style={{ width: "68%", height: "68%", borderRadius: 6 }}
      />
    </div>
  );
};

// One saved link visibly hops from the settled desktop card into the
// arriving phone — the sync, shown rather than implied. Both pulse after.
const SyncHop: React.FC = () => {
  const frame = useCurrentFrame();
  const launch = SYNC_PULSE - 16;
  const land = SYNC_PULSE - 2;
  if (frame < launch || frame > land + 2) {
    return null;
  }

  // The desktop card's top-row favicon and the phone's top row, in settled
  // screen coordinates (card center (780, 610) at 0.66 scale).
  const from = { x: 537, y: 452 };
  const to = { x: PHONE.x + 24 + 12, y: PHONE.y + PHONE.rowsTop + 31 };
  const progress = interpolate(frame, [launch, land], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  });
  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress - 90 * Math.sin(progress * Math.PI);
  const size = 42 - 14 * progress;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: size,
        height: size,
        borderRadius: size * 0.24,
        backgroundColor: "#ffffff",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 6,
        translate: `${x - size / 2}px ${y - size / 2}px`,
        opacity: interpolate(frame, [launch, launch + 3, land - 1, land + 2], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <Img
        src={staticFile(`favicons/${ROWS[0].favicon}.png`)}
        style={{ width: "68%", height: "68%", borderRadius: 6 }}
      />
    </div>
  );
};

const FlyingFavicon: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const domain = FAVICONS[index % FAVICONS.length];
  const chaos = chaosPos(index);
  const rank = rankOf.get(index);
  const saved = rank !== undefined;
  const capture = captureFrame(index);

  // The flood arrives in three waves that bang onto the canvas on the
  // song's hits (scene-local 19, 34, 48 = global 129, 144, 158).
  const entryEnd = WAVE_LANDINGS[index % WAVE_LANDINGS.length] + seeded(index, 9) * 3;
  const entryStart = entryEnd - 12;

  // Fly in from off-screen along the outward direction of the chaos position.
  const entryX = 960 + (chaos.x - 960) * 2.6;
  const entryY = 540 + (chaos.y - 540) * 2.6;

  // Lively swirl while loose, killed the moment the sweeper captures it.
  const driftAmp = interpolate(frame, [capture, capture + 8], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const driftX = Math.sin(frame * 0.09 + index * 2.4) * 34 * driftAmp;
  const driftY = Math.cos(frame * 0.075 + index * 1.7) * 28 * driftAmp;

  const tilt = (seeded(index, 3) - 0.5) * 56;

  if (!saved) {
    // Absorbed: sucked into the sweeper and gone — Sleevy saved it.
    const gone = capture + 12;
    if (frame < entryStart - 2 || frame > gone + 2) {
      return null;
    }
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 100,
          height: 100,
          borderRadius: 24,
          backgroundColor: "#ffffff",
          boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: interpolate(frame, [entryStart, entryStart + 4, capture + 4, gone], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: `${interpolate(frame, [entryStart, entryEnd, capture, gone], [entryX - 50, chaos.x - 50, chaos.x - 50, chaos.x + 90], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.bezier(0.5, 0, 1, 1)],
          })}px ${interpolate(frame, [entryStart, entryEnd, capture, gone], [entryY - 50, chaos.y - 50 + driftY, chaos.y - 50 + driftY, 590], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: [Easing.bezier(0.16, 1, 0.3, 1), Easing.linear, Easing.bezier(0.5, 0, 1, 1)],
          })}px`,
          marginLeft: driftX,
          scale: String(
            interpolate(frame, [capture, gone], [1, 0.1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.5, 0, 1, 1),
            }),
          ),
          rotate: `${tilt}deg`,
        }}
      >
        <Img
          src={staticFile(`favicons/${domain}.png`)}
          style={{ width: "68%", height: "68%", borderRadius: 6 }}
        />
      </div>
    );
  }

  const grid = gridPos(rank);

  // After the grid beat the icons blast past the camera as we dive into the
  // app — outward from center, scaling up and streaking out.
  const blastStart = BLAST + rank * 0.5;
  const blastEnd = blastStart + 14;
  if (frame < entryStart - 2 || frame > blastEnd + 2) {
    return null;
  }
  const pastX = 960 + (grid.x - 960) * 3.4;
  const pastY = 540 + (grid.y - 540) * 3.4;

  const keyframes = [entryStart, entryEnd, capture, capture + 18, blastStart, blastEnd];
  const ease = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    // Fast arrival, overshooting snap into the grid, accelerating blast-off.
    easing: [
      Easing.bezier(0.16, 1, 0.3, 1),
      Easing.linear,
      Easing.bezier(0.34, 1.45, 0.64, 1),
      Easing.linear,
      Easing.bezier(0.55, 0, 1, 0.45),
    ],
  };

  const x = interpolate(
    frame,
    keyframes,
    [entryX, chaos.x, chaos.x, grid.x, grid.x, pastX],
    ease,
  );
  const y = interpolate(
    frame,
    keyframes,
    [entryY, chaos.y, chaos.y, grid.y, grid.y, pastY],
    ease,
  );
  const size = interpolate(frame, keyframes, [100, 100, 100, 92, 92, 260], ease);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: size,
        height: size,
        borderRadius: size * 0.24,
        backgroundColor: "#ffffff",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 4,
        opacity:
          interpolate(frame, [entryStart, entryStart + 4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) *
          interpolate(frame, [blastStart + 6, blastEnd], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        translate: `${x - size / 2}px ${y - size / 2 + driftY}px`,
        marginLeft: driftX,
        rotate: `${interpolate(frame, [capture, capture + 18], [tilt, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.34, 1.45, 0.64, 1),
        })}deg`,
      }}
    >
      <Img
        src={staticFile(`favicons/${domain}.png`)}
        style={{ width: "68%", height: "68%", borderRadius: 6 }}
      />
    </div>
  );
};

const SceneContent: React.FC = () => {
  const frame = useCurrentFrame();

  // Camera: a continuous slow push-in, with quick impact bumps when the sweep
  // completes, when the app card settles, and when the terminal lands.
  const push = interpolate(frame, [0, SCENE_DURATION], [1, 1.07], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Small camera hits as each flood wave bangs onto the canvas.
  const waveBump = WAVE_LANDINGS.reduce(
    (acc, land) =>
      acc *
      interpolate(frame, [land, land + 2, land + 11], [1, 1.014, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: [Easing.bezier(0.3, 0, 0.4, 1), Easing.bezier(0.3, 0, 0.4, 1)],
      }),
    1,
  );
  const sweepBump = interpolate(frame, [98, 103, 118], [1, 1.022, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: [Easing.bezier(0.3, 0, 0.4, 1), Easing.bezier(0.3, 0, 0.4, 1)],
  });
  const revealBump = interpolate(frame, [REVEAL_END, REVEAL_END + 5, REVEAL_END + 20], [1, 1.016, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: [Easing.bezier(0.3, 0, 0.4, 1), Easing.bezier(0.3, 0, 0.4, 1)],
  });
  const terminalBump = interpolate(frame, [MARK_IN + 22, MARK_IN + 27, MARK_IN + 42], [1, 1.016, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: [Easing.bezier(0.3, 0, 0.4, 1), Easing.bezier(0.3, 0, 0.4, 1)],
  });

  return (
    <AbsoluteFill
      style={{ scale: String(push * waveBump * sweepBump * revealBump * terminalBump) }}
    >
      <Headline name="Headline-Chaos" inFrom={0} outFrom={58}>
        Links pile up everywhere.
      </Headline>
      <Headline name="Headline-Saved" inFrom={99} outFrom={140}>
        Saved. Sorted.
      </Headline>
      <Headline name="Headline-Agents" inFrom={164} outFrom={287}>
        Agents welcome — MCP &amp; API.
      </Headline>
      <Headline name="Headline-Sync" inFrom={475} outFrom={540}>
        In sync on every device.
      </Headline>

      <InboxAppPlane />
      <PhoneApp />
      <SyncHop />
      {/* Platform labels under the two settled screens. */}
      {[
        { text: "Web", x: 780 },
        { text: "Mobile", x: 1610 },
      ].map((label, i) => (
        <Interactive.Div
          key={label.text}
          name={`ScreenLabel-${label.text}`}
          style={{
            position: "absolute",
            top: 948,
            left: label.x - 200,
            width: 400,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: COLORS.muted,
            opacity: interpolate(frame, [REVEAL_END + 4 + i * 6, REVEAL_END + 16 + i * 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: `0px ${interpolate(frame, [REVEAL_END + 4 + i * 6, REVEAL_END + 20 + i * 6], [16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
          }}
        >
          {label.text}
        </Interactive.Div>
      ))}

      <AgentMark />
      {PORTS.map((port, i) => (
        <PortChip key={port.label} port={port} index={i} />
      ))}
      {Array.from({ length: STREAM_COUNT }, (_, i) => (
        <StreamTile key={i} index={i} />
      ))}

      {Array.from({ length: TOTAL_ICONS }, (_, i) => (
        <FlyingFavicon key={i} index={i} />
      ))}

      <Sweeper />
    </AbsoluteFill>
  );
};

// The multi-sample motion blur multiplies render cost, so it only runs while
// things move fast; segment switches happen on visually static frames.
const SEGMENTS = [
  { from: 0, to: 340, blur: true }, // flood, sweep, grid, agent stream, morph
  { from: 340, to: 445, blur: false }, // apex build (calm settles only)
  { from: 445, to: 512, blur: true }, // settle aside, phone, sync hop
  { from: 512, to: SCENE_DURATION, blur: false }, // synced hold, long read
];

export const Explainer: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: MESH_BACKGROUND, fontFamily: FONT_FAMILY }}>
      {SEGMENTS.map((segment) => (
        <Sequence
          key={segment.from}
          from={segment.from}
          trimBefore={segment.from}
          durationInFrames={segment.to - segment.from}
          layout="absolute-fill"
        >
          {segment.blur ? (
            <CameraMotionBlur shutterAngle={180} samples={4}>
              <SceneContent />
            </CameraMotionBlur>
          ) : (
            <SceneContent />
          )}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
