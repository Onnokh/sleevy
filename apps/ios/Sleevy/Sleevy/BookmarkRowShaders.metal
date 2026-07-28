#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

static float bookmarkNoise(float2 point) {
    return fract(sin(dot(point, float2(12.9898, 78.233))) * 43758.5453);
}

[[ stitchable ]] half4 bookmarkAurora(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float2 drifted = uv + float2(time * 0.018, -time * 0.011);

    float waveA = sin((drifted.x * 7.0 + drifted.y * 4.5 + seed * 8.0) + time * 0.7);
    float waveB = cos((drifted.x * 3.0 - drifted.y * 9.0 - seed * 5.0) - time * 0.45);
    float wave = (waveA + waveB) * 0.5;
    float glow = smoothstep(-0.85, 0.95, wave);

    float3 midnight = float3(0.035, 0.055, 0.16);
    float3 violet = float3(0.32, 0.12, 0.72);
    float3 cyan = float3(0.05, 0.68, 0.80);
    float3 coral = float3(0.96, 0.28, 0.48);

    float3 colorA = mix(midnight, violet, smoothstep(0.05, 0.75, uv.x + glow * 0.28));
    float3 colorB = mix(cyan, coral, smoothstep(0.15, 0.9, uv.y + wave * 0.16));
    float3 outputColor = mix(colorA, colorB, 0.22 + glow * 0.3);

    float grain = bookmarkNoise(uv * 180.0 + time * 0.03);
    outputColor += (grain - 0.5) * 0.025;
    outputColor += intensity * float3(0.08, 0.10, 0.08);

    return half4(half3(clamp(outputColor, 0.0, 1.0)), color.a);
}

[[ stitchable ]] half4 bookmarkPrism(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float diagonal = uv.x + uv.y * 0.72 + sin(time * 0.35 + seed * 6.0) * 0.08;
    float band = fract(diagonal * 3.3 - time * 0.08);
    float edge = smoothstep(0.0, 0.18, band) * (1.0 - smoothstep(0.72, 1.0, band));

    float3 ink = float3(0.025, 0.025, 0.045);
    float3 magenta = float3(0.92, 0.10, 0.56);
    float3 blue = float3(0.10, 0.42, 0.98);
    float3 gold = float3(1.0, 0.62, 0.16);

    float3 prism = mix(ink, blue, smoothstep(0.05, 0.55, uv.x));
    prism = mix(prism, magenta, smoothstep(0.12, 0.78, band) * 0.72);
    prism = mix(prism, gold, smoothstep(0.64, 0.94, uv.y) * 0.48);
    prism += edge * float3(0.25, 0.34, 0.45);
    prism += intensity * float3(0.10, 0.08, 0.02);

    return half4(half3(clamp(prism, 0.0, 1.0)), color.a);
}

[[ stitchable ]] half4 bookmarkSheen(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float2 base = float2(0.93, 0.94);
    float sweep = sin((uv.x * 8.0 + uv.y * 2.0) - time * 0.42 + seed * 7.0);
    float highlight = smoothstep(0.78, 1.0, sweep);

    float3 paper = float3(0.91, 0.92, 0.96);
    float3 lilac = float3(0.72, 0.76, 0.98);
    float3 pearl = mix(paper, lilac, highlight * 0.18 + intensity * 0.08);
    pearl += float3(0.04, 0.05, 0.08) * smoothstep(0.6, 1.0, uv.y);

    return half4(half3(clamp(pearl, 0.0, 1.0)), color.a);
}

[[ stitchable ]] half4 bookmarkBlueprint(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float2 gridPoint = abs(fract(uv * float2(13.0, 7.0)) - 0.5);
    float grid = 1.0 - smoothstep(0.46, 0.5, max(gridPoint.x, gridPoint.y));
    float scan = smoothstep(0.0, 0.12, sin((uv.y * 18.0 + time * 0.55 + seed * 3.0)) * 0.5 + 0.5);

    float3 navy = float3(0.015, 0.045, 0.13);
    float3 blue = float3(0.03, 0.16, 0.34);
    float3 cyan = float3(0.08, 0.78, 0.95);
    float3 outputColor = mix(navy, blue, uv.x * 0.7 + uv.y * 0.2);
    outputColor += cyan * grid * 0.10;
    outputColor += cyan * scan * 0.07;
    outputColor += intensity * cyan * 0.08;

    return half4(half3(clamp(outputColor, 0.0, 1.0)), color.a);
}

[[ stitchable ]] half4 bookmarkPlasma(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float2 centered = uv - 0.5;
    float radius = length(centered);
    float angle = atan2(centered.y, centered.x);
    float turbulence = sin(radius * 26.0 - time * 1.25 + sin(angle * 5.0 + time) * 2.0 + seed * 8.0);
    float flare = smoothstep(0.82, 1.0, turbulence) * (1.0 - smoothstep(0.55, 0.95, radius));

    float3 wine = float3(0.25, 0.01, 0.16);
    float3 hotPink = float3(0.95, 0.04, 0.42);
    float3 orange = float3(1.0, 0.36, 0.04);
    float3 electric = float3(0.42, 0.08, 0.98);
    float3 outputColor = mix(wine, electric, smoothstep(0.0, 0.75, uv.x));
    outputColor = mix(outputColor, hotPink, smoothstep(-0.75, 0.85, turbulence) * 0.62);
    outputColor = mix(outputColor, orange, flare * 0.92);
    outputColor += flare * float3(0.24, 0.18, 0.08);
    outputColor += intensity * float3(0.10, 0.06, 0.03);

    return half4(half3(clamp(outputColor, 0.0, 1.0)), color.a);
}

[[ stitchable ]] half4 bookmarkOrbit(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float2 centered = uv - 0.5;
    float radius = length(centered);
    float angle = atan2(centered.y, centered.x);
    float ring = 0.5 + 0.5 * sin(radius * 34.0 - time * 1.1 + seed * 8.0);
    float orbit = 0.5 + 0.5 * sin(angle * 3.0 + time * 0.8 + radius * 11.0);
    float glow = smoothstep(0.58, 0.94, ring * orbit);

    float3 space = float3(0.018, 0.012, 0.07);
    float3 indigo = float3(0.14, 0.07, 0.52);
    float3 cyan = float3(0.03, 0.72, 0.94);
    float3 gold = float3(1.0, 0.56, 0.12);
    float3 outputColor = mix(space, indigo, smoothstep(0.0, 0.72, uv.y));
    outputColor += cyan * glow * 0.60;
    outputColor = mix(outputColor, gold, smoothstep(0.72, 0.98, radius) * orbit * 0.38);
    outputColor += intensity * float3(0.08, 0.06, 0.10);

    return half4(half3(clamp(outputColor, 0.0, 1.0)), color.a);
}

[[ stitchable ]] half4 bookmarkRefraction(
    float2 position,
    SwiftUI::Layer layer,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float wave = sin(uv.y * 20.0 + time * 0.9 + seed * 7.0);
    float2 offset = float2(wave * (2.0 + intensity * 4.0), cos(uv.x * 14.0 + time) * 1.2);
    return layer.sample(position + offset);
}

[[ stitchable ]] float2 bookmarkWarp(
    float2 position,
    float2 size,
    float time,
    float seed,
    float intensity
) {
    float2 uv = position / max(size, float2(1.0));
    float edge = smoothstep(0.0, 0.48, abs(uv.x - 0.5));
    float wave = sin(uv.y * 13.0 + time * 1.25 + seed * 8.0);
    float2 offset = float2(wave * (3.0 + intensity * 8.0) * edge, cos(uv.x * 10.0 + time) * 1.5);
    return position + offset;
}
