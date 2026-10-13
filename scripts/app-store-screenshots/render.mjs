#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "../..");
const root = join(projectRoot, "app-store-screenshots");
const backgrounds = join(root, "_backgrounds");
const translations = JSON.parse(await readFile(join(scriptDir, "translations.json"), "utf8"));

const artboards = {
  iphone: [
    {
      index: 1,
      width: 1284,
      height: 2778,
      texts: [{ key: "oneTap", x: 171, y: 425, width: 942, fontSize: 110.145, weight: 700, color: "#ffffff", lines: 2 }],
    },
    { index: 2, width: 1284, height: 2778, texts: [] },
    {
      index: 3,
      width: 1284,
      height: 2778,
      texts: [
        { key: "organize", x: 241, y: 443, width: 832, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "folders", x: 235, y: 580.682, width: 844, fontSize: 94.410, weight: 500, color: "#929297" },
      ],
    },
    {
      index: 4,
      width: 1284,
      height: 2778,
      texts: [
        { key: "oneHandle", x: 135, y: 447, width: 1014, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "publish", x: 97, y: 584.682, width: 1090, fontSize: 94.410, weight: 500, color: "#929297" },
      ],
    },
    {
      index: 5,
      width: 1284,
      height: 2778,
      texts: [
        { key: "workflow", x: 278, y: 443, width: 759, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "alreadyThere", x: 400, y: 580.682, width: 515, fontSize: 94.410, weight: 500, color: "#929297" },
        { key: "browser", x: 287.728, y: 1736.785, width: 710, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "chrome", x: 419.228, y: 1864.520, width: 447, fontSize: 70.808, weight: 500, color: "#adadad" },
        { key: "launcher", x: 258.380, y: 1168, width: 768, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "raycast", x: 528.380, y: 1292.785, width: 228, fontSize: 70.808, weight: 500, color: "#adadad" },
        { key: "phone", x: 329.732, y: 2308.520, width: 626, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "nativeShare", x: 464.232, y: 2450.023, width: 357, fontSize: 70.808, weight: 500, color: "#adadad" },
      ],
    },
  ],
  ipad: [
    {
      index: 1,
      width: 2048,
      height: 2732,
      texts: [{ key: "oneTap", x: 553, y: 458, width: 942, fontSize: 110.145, weight: 700, color: "#ffffff", lines: 2 }],
    },
    {
      index: 2,
      width: 2048,
      height: 2732,
      texts: [
        { key: "organize", x: 608, y: 458, width: 832, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "folders", x: 602, y: 595.682, width: 844, fontSize: 94.410, weight: 500, color: "#929297" },
      ],
    },
    {
      index: 3,
      width: 2048,
      height: 2732,
      texts: [
        { key: "saveNow", x: 753, y: 432, width: 542, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "readReady", x: 546, y: 569.682, width: 957, fontSize: 94.410, weight: 500, color: "#929297" },
      ],
    },
    {
      index: 4,
      width: 2048,
      height: 2732,
      texts: [
        { key: "oneHandle", x: 517, y: 392.734, width: 1014, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "publish", x: 479, y: 530.416, width: 1090, fontSize: 94.410, weight: 500, color: "#929297" },
      ],
    },
    {
      index: 5,
      width: 2048,
      height: 2732,
      texts: [
        { key: "workflow", x: 644.5, y: 312.734, width: 759, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "alreadyThere", x: 766.5, y: 450.416, width: 515, fontSize: 94.410, weight: 500, color: "#929297" },
        { key: "browser", x: 681.784, y: 1667.917, width: 710, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "chrome", x: 813.284, y: 1795.652, width: 447, fontSize: 70.808, weight: 500, color: "#adadad" },
        { key: "launcher", x: 652.784, y: 1072.935, width: 768, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "raycast", x: 922.784, y: 1197.719, width: 228, fontSize: 70.808, weight: 500, color: "#adadad" },
        { key: "phone", x: 724.276, y: 2268.799, width: 626, fontSize: 110.145, weight: 700, color: "#ffffff" },
        { key: "nativeShare", x: 858.776, y: 2410.302, width: 357, fontSize: 70.808, weight: 500, color: "#adadad" },
      ],
    },
  ],
};

// The iPhone Duo backgrounds are made locally with compose-duo.swift, not
// exported from Figma. Wide shots show the inner display, tall ones the cover.
const duoInner = { width: 2853, height: 2007 };
const duoCover = { width: 1398, height: 2034 };

function duoHeadline(headline, subline) {
  const box = { x: 200, width: 2453 };
  const texts = [{ key: headline, ...box, y: 345, fontSize: 120, weight: 700, color: "#ffffff" }];
  if (subline) texts.push({ key: subline, ...box, y: 495, fontSize: 103, weight: 500, color: "#929297" });
  return texts;
}

// Scales an artboard's text the way compose-duo.swift scales its background:
// to cover the canvas, centered, anchored at the top.
function fitTexts(artboard, canvas) {
  const scale = Math.max(canvas.width / artboard.width, canvas.height / artboard.height);
  const offsetX = (canvas.width - artboard.width * scale) / 2;
  return artboard.texts.map((text) => ({
    ...text,
    x: text.x * scale + offsetX,
    y: text.y * scale,
    width: text.width * scale,
    fontSize: text.fontSize * scale,
  }));
}

artboards["iphone-duo"] = [
  { index: 1, ...duoInner, texts: duoHeadline("unfold", "beside") },
  { index: 2, ...duoCover, texts: [] },
  { index: 3, ...duoInner, texts: duoHeadline("organize", "folders") },
  { index: 4, ...duoInner, texts: duoHeadline("oneTap") },
  { index: 5, ...duoCover, texts: fitTexts(artboards.ipad[4], duoCover) },
];

const fontFamily = ".SF NS";
const fontFamilies = {
  ja: "Hiragino Sans",
  ko: "Apple SD Gothic Neo",
  "zh-Hans": "Hiragino Sans GB",
  "zh-Hant": "Hiragino Sans GB",
  "ar-SA": "Geeza Pro",
  he: "SF Hebrew",
  "bn-BD": "Kohinoor Bangla",
  "gu-IN": "Gujarati Sangam MN",
  hi: "Kohinoor Devanagari",
  "kn-IN": "SF Kannada",
  "ml-IN": "Malayalam MN",
  "mr-IN": "Kohinoor Devanagari",
  "or-IN": "Noto Sans Oriya",
  "pa-IN": "Gurmukhi MN",
  "ta-IN": "SF Tamil",
  "te-IN": "Telugu Sangam MN",
  th: "Thonburi",
  "ur-PK": "Geeza Pro",
};
const trackingRatio = -0.04;
const textSafeArea = 0.88;

function fontFamilyForLocale(locale) {
  return fontFamilies[locale] ?? fontFamily;
}

// Core Text draws the text (see text-overlay.swift): ImageMagick without a
// shaping engine reverses Arabic and Hebrew, breaks Indic and Thai marks, and
// draws nothing for a script its font lacks.
async function renderOverlay(artboard, locale, output) {
  const localeTranslations = translations[locale] ?? translations.en;
  const texts = artboard.texts.map(({ key, ...spec }) => {
    const value = localeTranslations?.[key];
    if (value == null) throw new Error(`Missing ${locale}.${key}`);
    return { value, ...spec };
  });
  const spec = {
    width: artboard.width,
    height: artboard.height,
    output,
    family: fontFamilyForLocale(locale),
    tracking: trackingRatio,
    safeArea: textSafeArea,
    texts,
  };
  const specPath = `${output}.json`;
  await writeFile(specPath, JSON.stringify(spec));
  await execFileAsync(textOverlay, [specPath]);
}

async function ensureMagick() {
  try {
    await execFileAsync("magick", ["-version"]);
  } catch {
    throw new Error("ImageMagick (`magick`) is required to render localized screenshots.");
  }
}

const args = process.argv.slice(2);
const requestedLocales = args.filter((arg) => !arg.startsWith("--"));
const locales = requestedLocales.length > 0 ? requestedLocales : ["en", "nl"];
const requestedDevices = args.filter((arg) => arg.startsWith("--device=")).map((arg) => arg.slice("--device=".length));
const devices = requestedDevices.length > 0 ? requestedDevices : Object.keys(artboards);
for (const device of devices) {
  if (!artboards[device]) throw new Error(`Unknown device: ${device}. Use one of ${Object.keys(artboards).join(", ")}.`);
}
await ensureMagick();
const temp = await mkdtemp(join(tmpdir(), "sleevy-app-store-")).catch(() => null);
if (!temp) throw new Error("Could not create a temporary render directory.");
const textOverlay = join(temp, "text-overlay");
await execFileAsync("swiftc", ["-O", join(scriptDir, "text-overlay.swift"), "-o", textOverlay]);

try {
  for (const locale of locales) {
    if (!translations[locale] && !translations.en) throw new Error(`No translations configured for locale: ${locale}`);
    for (const device of devices) {
      const outputDir = join(root, device, locale);
      await mkdir(outputDir, { recursive: true });
      for (const artboard of artboards[device]) {
        const input = join(backgrounds, device, `${String(artboard.index).padStart(2, "0")}.png`);
        const output = join(outputDir, `${String(artboard.index).padStart(2, "0")}.png`);
        // App Store Connect rejects screenshots with an alpha channel, and the
        // Figma backgrounds have one (fully opaque), so drop it.
        if (artboard.texts.length === 0) {
          await execFileAsync("magick", [input, "-alpha", "off", output]);
          continue;
        }
        const overlay = join(temp, `${device}-${locale}-${artboard.index}.png`);
        await renderOverlay(artboard, locale, overlay);
        await execFileAsync("magick", [input, "-background", "none", overlay, "-compose", "over", "-composite", "-alpha", "off", output]);
      }
    }
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}

console.log(`Rendered ${locales.length} locale(s) × ${devices.join(", ")}.`);
