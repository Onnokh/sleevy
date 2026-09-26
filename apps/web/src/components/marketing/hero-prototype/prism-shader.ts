// PROTOTYPE — throwaway. A reverse prism: one coloured beam per Capture Channel
// converges into a glass Sleevy mark and leaves it as a single white beam —
// "every channel, one queue". Drawn as one full-screen fragment pass, output
// opaque (alpha 1) so no premultiplied-alpha surprises.

export type PrismFrame = {
  readonly time: number
  readonly width: number
  readonly height: number
  /** Eased pointer, -1…1 on both axes, y up. */
  readonly pointer: readonly [number, number]
  /** Per-beam brightness, one per channel. */
  readonly intensity: readonly number[]
  readonly colors: readonly (readonly [number, number, number])[]
}

const vertexSource = `#version 300 es
void main() {
  vec2 positions[3] = vec2[](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
}
`

const fragmentSource = `#version 300 es
precision highp float;

out vec4 fragmentColor;

uniform vec2 resolution;
uniform float time;
uniform vec2 pointer;
uniform float intensity[6];
uniform vec3 beamColor[6];
// Layout, in height units with the origin at the canvas centre, y up.
uniform vec2 markCenter;
uniform float markHeight;
uniform float fanStart;   // radians, direction from the entry point to the first source
uniform float fanStep;
uniform float exitAngle;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

// iq's rounded box with one radius per corner: r = (top-right, bottom-right, top-left, bottom-left).
float roundBox(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

// The three-bar mark from logo-mark.svg (462 x 587 units), y up, centred.
float markShape(vec2 p) {
  float s = markHeight / 587.0;
  vec2 q = (p - markCenter) / s;
  vec2 half_ = vec2(231.0, 88.0);
  float top = roundBox(q - vec2(0.0, 205.5), half_, vec4(0.0, 128.0, 128.0, 0.0));
  float middle = roundBox(q - vec2(0.0, 0.5), half_, vec4(128.0, 0.0, 0.0, 128.0));
  float bottom = roundBox(q - vec2(0.0, -205.0), half_, vec4(0.0, 128.0, 128.0, 0.0));
  return min(top, min(middle, bottom)) * s;
}

// Distance to a ray from a (the far source) to b (the entry point), and how far along it we are.
vec2 segment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * resolution) / resolution.y;
  float aspect = resolution.x / resolution.y;

  vec3 color = vec3(0.012, 0.013, 0.018);
  // Faint cool floor so the black is not dead flat.
  color += vec3(0.02, 0.025, 0.05) * smoothstep(1.2, 0.0, length(p - markCenter));

  float markWidth = markHeight * 462.0 / 587.0;
  vec2 entry = markCenter + vec2(-markWidth * 0.36, -markHeight * 0.02) + pointer * 0.01;
  vec2 exitPoint = markCenter + vec2(markWidth * 0.34, markHeight * 0.06);

  float d = markShape(p);
  float outside = smoothstep(0.0, 0.004, d);

  // ── Incoming channel beams ──
  float angleShift = pointer.y * 0.06 - pointer.x * 0.03;
  for (int i = 0; i < 6; i += 1) {
    float angle = fanStart + fanStep * float(i) + angleShift;
    vec2 source = entry + vec2(cos(angle), sin(angle)) * (aspect + 1.5);
    vec2 s = segment(p, source, entry);
    // Tight at the mark, wider where it enters the frame.
    float width = mix(0.016, 0.0045, s.y);
    float core = exp(-(s.x * s.x) / (width * width));
    float halo = exp(-s.x / (width * 7.0)) * 0.22;
    // Drifting dust in the beam.
    float dust = 0.82 + 0.3 * noise(vec2(s.y * 70.0 - time * 1.6, float(i) * 13.0));
    color += beamColor[i] * (core * dust + halo) * intensity[i] * outside * 0.9;
  }

  // ── Outgoing white beam ──
  vec2 exitDir = vec2(cos(exitAngle), sin(exitAngle));
  vec2 exitFar = exitPoint + exitDir * (aspect + 1.5);
  vec2 e = segment(p, exitFar, exitPoint);
  float exitWidth = mix(0.03, 0.009, e.y);
  float exitCore = exp(-(e.x * e.x) / (exitWidth * exitWidth));
  float exitHalo = exp(-e.x / (exitWidth * 5.0)) * 0.3;
  // A thin spectral fringe on either side, the last trace of the colours.
  float side = dot(p - exitPoint, vec2(-exitDir.y, exitDir.x));
  vec3 fringe = 0.5 + 0.5 * cos(6.2831 * (side / exitWidth * 0.18 + vec3(0.0, 0.33, 0.67)));
  color += (vec3(1.0) * exitCore * 1.4 + mix(vec3(0.8, 0.85, 1.0), fringe, 0.35) * exitHalo) * outside;

  // ── Flares where light meets the glass ──
  float flareIn = exp(-length(p - entry) / 0.012) * 0.9;
  float streakIn = exp(-abs(p.y - entry.y) / 0.0018) * exp(-abs(p.x - entry.x) / 0.22) * 0.35;
  float flareOut = exp(-length(p - exitPoint) / 0.016);
  float streakOut = exp(-abs(p.y - exitPoint.y) / 0.0022) * exp(-abs(p.x - exitPoint.x) / 0.3) * 0.45;
  color += vec3(1.0, 0.97, 0.94) * (flareIn + streakIn + flareOut + streakOut);

  // ── The glass mark ──
  if (d < 0.06) {
    vec2 k = vec2(0.0015, 0.0);
    vec2 normal = normalize(vec2(markShape(p + k.xy) - markShape(p - k.xy), markShape(p + k.yx) - markShape(p - k.yx)));
    vec2 light = normalize(vec2(-0.55, 0.85) + pointer * 0.6);
    float facing = max(dot(normal, light), 0.0);
    float edge = exp(-abs(d) / 0.0016);
    float inside = 1.0 - smoothstep(-0.0015, 0.0015, d);

    // Body: dark smoked glass that lifts toward its edges.
    vec3 body = vec3(0.035, 0.04, 0.055) + vec3(0.12, 0.13, 0.16) * exp(d / 0.018);
    // The light travelling through: merged white, a touch of spectrum at the entry.
    vec2 inner = segment(p, entry, exitPoint);
    float path = exp(-(inner.x * inner.x) / (0.02 * 0.02));
    vec3 spectrum = 0.5 + 0.5 * cos(6.2831 * (inner.y * 0.9 + vec3(0.0, 0.33, 0.67)));
    body += mix(spectrum, vec3(1.0), smoothstep(0.0, 0.7, inner.y)) * path * 0.55;
    // Light scattered through the whole slab, strongest near the path.
    body += vec3(0.5, 0.55, 0.7) * exp(-inner.x / 0.08) * 0.12;
    // A glossy diagonal sheen that slides with the pointer.
    float sheen = dot(p - markCenter, normalize(vec2(1.0, 1.2))) / markHeight + pointer.x * 0.08;
    body += vec3(1.0) * smoothstep(0.05, 0.0, abs(sheen - 0.1)) * 0.06;

    color = mix(color, body, inside);
    // Lit rim: bright where it faces the light, never fully dark.
    color += vec3(0.95, 0.97, 1.0) * edge * (0.25 + 1.1 * facing);
    // Soft outer glow hugging the glass.
    color += vec3(0.45, 0.5, 0.75) * exp(-max(d, 0.0) / 0.02) * 0.05 * (1.0 - inside);
  }

  // Filmic shoulder, then grain against banding.
  color = 1.0 - exp(-color * 1.25);
  color += (hash(gl_FragCoord.xy + fract(time)) - 0.5) / 255.0 * 2.0;
  fragmentColor = vec4(color, 1.0);
}
`

type Layout = { markCenter: [number, number]; markHeight: number; fanStart: number; fanStep: number; exitAngle: number }

function layoutFor(width: number, height: number): Layout {
  const aspect = width / height
  const degrees = Math.PI / 180
  if (aspect < 1) {
    // Portrait: mark above the copy, beams rising from the lower left.
    return { markCenter: [0.02, 0.26], markHeight: 0.2, fanStart: 196 * degrees, fanStep: 7 * degrees, exitAngle: 12 * degrees }
  }
  // Landscape: mark at ~66% of the width, beams sweeping in from the lower left.
  return {
    markCenter: [aspect * 0.17, 0.0],
    markHeight: Math.min(0.46, (aspect * 0.3) / (462 / 587)),
    fanStart: 186 * degrees,
    fanStep: 6.2 * degrees,
    exitAngle: -9 * degrees,
  }
}

export class PrismRenderer {
  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly uniforms: Record<string, WebGLUniformLocation | null>,
  ) {}

  static create(canvas: HTMLCanvasElement): PrismRenderer | null {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false })
    if (!gl) return null

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader))
        return null
      }
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexSource)
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
    if (!vertex || !fragment) return null

    const program = gl.createProgram()!
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program))
      return null
    }
    gl.useProgram(program)
    gl.bindVertexArray(gl.createVertexArray())

    const names = ["resolution", "time", "pointer", "intensity", "beamColor", "markCenter", "markHeight", "fanStart", "fanStep", "exitAngle"]
    const uniforms = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]))
    return new PrismRenderer(gl, uniforms)
  }

  render(frame: PrismFrame) {
    const { gl, uniforms } = this
    const canvas = gl.canvas as HTMLCanvasElement
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width
      canvas.height = frame.height
    }
    const layout = layoutFor(frame.width, frame.height)
    gl.viewport(0, 0, frame.width, frame.height)
    gl.uniform2f(uniforms.resolution, frame.width, frame.height)
    gl.uniform1f(uniforms.time, frame.time)
    gl.uniform2f(uniforms.pointer, frame.pointer[0], frame.pointer[1])
    gl.uniform1fv(uniforms.intensity, frame.intensity)
    gl.uniform3fv(uniforms.beamColor, frame.colors.flat())
    gl.uniform2f(uniforms.markCenter, layout.markCenter[0], layout.markCenter[1])
    gl.uniform1f(uniforms.markHeight, layout.markHeight)
    gl.uniform1f(uniforms.fanStart, layout.fanStart)
    gl.uniform1f(uniforms.fanStep, layout.fanStep)
    gl.uniform1f(uniforms.exitAngle, layout.exitAngle)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
