// The homepage's glass, live, for the sign-in screens: out-of-focus satin
// ribbons in the dark, lit by soft coloured lights that wander and breathe.
// A port of apps/web/src/components/marketing/glass-background/glass-shader.ts;
// keep the two the same. The web shader explains each step.
//
// SwiftUI gives the position in points, from the top left; the web shader
// works in pixels from the bottom left, so y is flipped first.

#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

namespace glass {
    constant float3 navy = float3(0.02, 0.13, 0.27);
    constant float3 steel = float3(0.34, 0.50, 0.72);
    constant float3 rose = float3(0.95, 0.30, 0.50);
    constant float3 gold = float3(1.00, 0.64, 0.26);

    constant float ANGLE = 0.733;
    constant float WIDTH = 0.36;
    constant float DRIFT = 0.012;
    constant float STAGE = 1.6;
    constant float ZOOM = 0.75;

    float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
    float hash2(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

    float3 lit(float3 n, float2 q, float3 lpos, float3 tint) {
        float3 l = normalize(lpos - float3(q, 0.0));
        float3 h = normalize(l + float3(0.0, 0.0, 1.0));
        float nh = max(dot(n, h), 0.0);
        float sheen = pow(nh, 5.0) * 0.5 + pow(nh, 16.0) * 0.55;
        float diffuse = max(dot(n, l), 0.0) * 0.12;
        float2 d = lpos.xy - q;
        return tint * (sheen + diffuse) / (1.0 + dot(d, d) * 3.0);
    }
}

[[ stitchable ]] half4 signInGlass(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float2 pointer,
    float lightOn
) {
    using namespace glass;

    float2 pixel = float2(position.x, size.y - position.y);
    float aspect = size.x / size.y;
    float2 uv = pixel / size;
    float2 q = float2((uv.x - 0.5) * aspect, uv.y - 0.5);
    float t = time * 0.56 + 35.0;
    float wt = time * 1.26 + 35.0;
    float2 g = q * ZOOM;

    float2 along = float2(cos(ANGLE), sin(ANGLE));
    float2 across = float2(-along.y, along.x);
    float v = dot(g, along);
    float u0 = dot(g, across);
    float u = u0
        + 0.018 * sin(v * 2.2 + t * 0.30)
        + 0.014 * sin(v * 3.1 - t * 0.26 + u0 * 5.0)
        - DRIFT * t;

    float w = u / WIDTH;
    float ph = w * 1.3 + v * 0.4 + 0.7 + t * 0.1;
    w += 0.28 * sin(ph);
    float id = floor(w);
    float s = fract(w);
    float span = WIDTH / (1.0 + 0.364 * cos(ph));
    float fromEdge = (1.0 - s) * span;
    float fromFoot = s * span;

    float r1 = hash1(id + 11.0);
    float r2 = hash1(id + 23.0);
    float r3 = hash1(id + 37.0);
    float tilt = 0.8 * sin(v * 1.8 + wt * 0.50 + r1 * 6.28) + 0.35 * sin(v * 3.4 - wt * 0.37 + r2 * 6.28);
    float rise = 0.9 * cos(v * 3.6 - wt * 0.45 + r3 * 6.28) + 0.35 * cos(v * 6.5 + wt * 0.35 + r1 * 6.28);
    float slope = tilt + 1.0 * (s - 0.5) + 9.0 * pow(s, 40.0);
    float2 k1 = float2(cos(-0.35), sin(-0.35));
    float2 k2 = float2(cos(2.2), sin(2.2));
    float2 swells = k1 * 0.7 * cos(dot(g, k1) * 3.5 - wt * 0.42) + k2 * 0.4 * cos(dot(g, k2) * 5.0 + wt * 0.31 + 1.7);
    float3 n = normalize(float3(-(slope * across + rise * along + swells), 1.0));

    float shade = mix(0.25, 1.0, smoothstep(0.0, mix(0.03, 0.1, r2), fromFoot));
    float crisp = smoothstep(0.0, 0.006, fromEdge);

    float3 cool = float3(0.55 * STAGE * sin(t * 0.13), 0.38 * sin(t * 0.17 + 1.0), 0.45);
    float3 warm = float3(0.5 * STAGE * sin(t * 0.11 + 2.4), 0.36 * sin(t * 0.15 + 4.0), 0.4);
    float3 blue = float3(0.5 * STAGE * sin(t * 0.09 + 4.4), 0.4 * sin(t * 0.12 + 2.2), 0.6);
    float3 blush = float3(0.45 * STAGE * sin(t * 0.12 + 5.39), 0.34 * sin(t * 0.16 + 0.51), 0.42);
    float3 light = lit(n, q, cool, steel) * (0.8 + 0.2 * sin(t * 0.23 + 0.5));
    light += lit(n, q, warm, gold) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * 0.19 + 2.0), 1.5));
    light += lit(n, q, blush, rose) * (0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * 0.17 + 1.56), 1.5));
    light += lit(n, q, blue, navy * 3.0) * 0.5;
    light += lit(n, q, float3((pointer.x - 0.5) * aspect, pointer.y - 0.5, 0.4), steel) * lightOn * 0.8;
    light += navy * 0.12 * pow(max(n.z, 0.0), 4.0);

    float3 c = light * shade * crisp;
    c = c * c / (c + 0.1);
    c *= mix(1.0, 0.6, smoothstep(0.8, 1.0, uv.y));
    c = 1.0 - exp(-c * 0.7);

    // The screen-door of the web's CSS: 4 pt cells, a darker line on two sides.
    float2 cell = fmod(position, 4.0);
    if (cell.x < 1.0 || cell.y < 1.0) { c *= 0.85; }

    c += (hash2(position + fract(time * 7.0)) - 0.5) * (2.0 / 255.0);
    return half4(half3(c), 1.0);
}
