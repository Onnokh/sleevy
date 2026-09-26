// The marketing glass: tall fluted glass panels leaning on a diagonal, with
// slow beams of Sleevy blue light moving behind them. It began as a live take
// on the looping glass video behind payloadcms.com's hero; the homepage hero
// runs it at full strength and the highlight cards run it toned down.
//
// Each rib bends the light behind it like a thin lens, and the three colour
// channels bend by different amounts, so the rib edges split into faint
// spectra. The glass has real surface normals (ribs, bevels, tilted panels)
// and the pointer is a low raking light over it, so moving the pointer reveals
// the relief: facets turned toward it brighten, the others fall into shade,
// and glints run along the rib flanks. Opaque output (alpha 1).

export type GlassFrame = {
  readonly time: number
  readonly width: number
  readonly height: number
  /** The light's position in canvas UV (0…1, y up). */
  readonly pointer: readonly [number, number]
  /** Strength of the light over the glass. */
  readonly lightOn: number
  /** Brightness of the light behind the glass; the hero uses 1. */
  readonly tone: number
  /** Dim the top for text: from `start` to `end` (UV height, y up) down to `floor`. */
  readonly calm: readonly [start: number, end: number, floor: number]
  /** Varies the panel pattern and the beams' timing between frames. */
  readonly seed: number
  /** The height in pixels that one unit of the glass pattern spans. */
  readonly glassUnit: number
  /** The height in pixels that one unit of the light behind the glass spans. */
  readonly lightUnit: number
  /**
   * Where this canvas sits in a larger wall of glass, in pixels from the wall's
   * bottom-left, and the wall's size. A lone frame is its own wall.
   */
  readonly origin: readonly [number, number]
  readonly wall: readonly [number, number]
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
// Where the light stands, in canvas UV (y up), and how strong it is.
uniform vec2 pointer;
uniform float lightOn;
// Brightness of the light behind the glass (the hero uses 1).
uniform float tone;
// Where the top dims for text: from calm.x to calm.y (UV height, y up), down to calm.z.
uniform vec3 calm;
// Varies the panel pattern and the beams' timing between frames.
uniform float seed;
// The height in pixels that one unit of the glass spans, and one unit of the
// light behind it. The hero uses its own height for both; a smaller frame can
// zoom into the glass (bigger ribs) and the light (broader beams) separately.
uniform float glassUnit;
uniform float lightUnit;
// Where this canvas sits in a larger wall of glass (pixels from the wall's
// bottom-left) and the wall's size, so several canvases can show one wall.
uniform vec2 origin;
uniform vec2 wall;

// Deep glass blue with a steel-white hot core, like the reference; the violet
// and ember accents come from Sleevy's mesh palette.
const vec3 deepBlue = vec3(0.02, 0.10, 0.62);
const vec3 blue = vec3(0.10, 0.34, 1.00);
const vec3 core = vec3(0.62, 0.78, 1.00);
const vec3 violet = vec3(0.42, 0.14, 0.72);
const vec3 ember = vec3(1.00, 0.50, 0.22);

// Panels lean like the reference: their long axis runs up and to the right at ~62 degrees.
const vec2 along = vec2(0.4695, 0.8829);
const vec2 across = vec2(0.8829, -0.4695);

float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
}

// One beam: a narrow hot core inside a wide coloured glow.
vec3 beam(float d, float coreWidth, float glowWidth, vec3 glowColor, float coreAmount) {
  float c = exp(-pow(d / coreWidth, 2.0));
  float g = exp(-pow(d / glowWidth, 2.0));
  return glowColor * g + core * c * coreAmount;
}

// The light behind the glass, in light units (x 0…aspect, y up).
vec3 backlight(vec2 p) {
  float aspect = wall.x / lightUnit;
  // Beams run a little steeper than the panels, so they cut across the ribs.
  vec2 beamAcross = normalize(vec2(0.80, -0.60));
  float x = dot(p, beamAcross);
  float y = dot(p, vec2(0.60, 0.80));
  float t = time + seed * 37.0;

  // Streaky density along each beam, drifting slowly upward.
  float grain = noise(vec2(x * 7.0, y * 1.2 - t * 0.04));
  float streak = 0.5 + 0.8 * grain;

  // Along-beam falloff, so light pools instead of striping the whole frame.
  float mid = smoothstep(-0.1, 0.55, y) * (1.0 - smoothstep(0.75, 1.55, y));

  vec3 color = vec3(0.0);
  // Main beam through the middle of the stage.
  color += beam(x - (aspect * 0.30 + 0.05 * sin(t * 0.11)), 0.028, 0.15, blue * 0.8, 1.0) * streak * mid;
  // A second, thinner beam further right, behind the product shots.
  color += beam(x - (aspect * 0.52 + 0.08 * sin(t * 0.08 + 1.3)), 0.016, 0.10, deepBlue, 0.6) * streak * smoothstep(0.1, 0.9, y);
  // A deep wash on the far right.
  color += deepBlue * exp(-pow((x - aspect * 0.78) / 0.3, 2.0)) * 0.35 * smoothstep(0.2, 1.0, y);
  // A thin warm blade low on the left, under the call to action, like the reference's amber streak.
  float blade = x - (aspect * 0.03 + 0.04 * sin(t * 0.09 + 2.1));
  float low = 1.0 - smoothstep(0.15, 0.85, y);
  color += mix(violet, ember, 0.55 + 0.3 * grain) * exp(-pow(blade / 0.022, 2.0)) * low * 0.9;
  color += violet * exp(-pow(blade / 0.09, 2.0)) * low * 0.25;
  return color * tone;
}

void main() {
  float aspect = resolution.x / resolution.y;
  vec2 uv = gl_FragCoord.xy / resolution;
  vec2 p = uv * vec2(aspect, 1.0);
  vec2 lightXY = pointer * vec2(aspect, 1.0);

  // ── Glass geometry ──
  vec2 frag = gl_FragCoord.xy + origin;
  vec2 g = frag / glassUnit;
  float a = dot(g, across) + 0.3;
  float panelWidth = 0.21;
  float panel = floor(a / panelWidth) + seed * 13.0;
  float u = fract(a / panelWidth);
  float seed = hash(panel);
  float seed2 = hash(panel + 17.0);
  float seed3 = hash(panel + 41.0);
  // Rib pitch: coarse panels (7–17 ribs) between fine ones (22–36), so the
  // light reads the relief at two scales.
  float flutes = seed3 < 0.45 ? floor(7.0 + seed3 * 22.0) : floor(22.0 + seed3 * 14.0);
  float f = fract(u * flutes);
  float lens = f * 2.0 - 1.0;
  // About one panel in four is a clear sheet: no ribs, only its own tilt.
  float fluted = step(0.25, seed);

  // Depth: every panel sits at its own distance behind the frame, so moving
  // the light slides the panels against each other.
  float depth = seed2;
  vec2 lean = (pointer - 0.5) * vec2(aspect, 1.0);
  vec2 parallax = -lean * (0.02 + depth * 0.09);

  // Surface slope across the panel: a half-cylinder per rib, bevelled panel
  // edges, and a tilt of the whole panel about its long axis.
  float bevel = smoothstep(0.955, 1.0, u) - (1.0 - smoothstep(0.0, 0.045, u));
  float slope = lens * 0.85 * fluted + bevel * 1.2 + (seed - 0.5) * 0.45;
  vec3 normal = normalize(vec3(across * slope, 1.0));

  // ── The light: low and raking, so the relief throws highlights and shade ──
  vec3 toLight = vec3(lightXY - p, 0.12);
  vec3 L = normalize(toLight);
  // A wide reach: the relief should light up across a big area, not in a spot.
  float reach = 1.0 / (1.0 + pow(length(toLight.xy) / 0.62, 2.0)) * lightOn;
  // Which way the light rakes across the ribs: -1…1.
  float rake = dot(across, normalize(toLight.xy + 1e-4));
  // How much more (or less) this facet faces the light than flat glass would.
  float relief = dot(normal, L) - L.z;
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float NdotH = max(dot(normal, H), 0.0);
  // Only curved glass glints: ribs and bevels. Flat sheets would only mirror
  // the light as a round spot, which reads as a cursor, not as glass.
  float curved = max(fluted, abs(bevel));
  float glint = pow(NdotH, 90.0) * curved;
  float sheen = pow(NdotH, 10.0);

  // ── What shows through: the backlight, refracted per panel and per rib ──
  vec2 panelShift = across * (seed - 0.5) * 0.16 + along * (seed2 - 0.5) * 0.2 + parallax;
  vec2 fluteBend = across * lens * 0.03 * fluted;
  // Three samples, one per channel, each bent a little more: rib edges split into spectra.
  vec3 color;
  vec2 l = frag / lightUnit;
  color.r = backlight(l + panelShift + fluteBend * 0.92).r;
  color.g = backlight(l + panelShift + fluteBend * 1.10).g;
  color.b = backlight(l + panelShift + fluteBend * 1.30).b;
  // Each rib focuses what passes through into a bright band, and the band
  // leans toward the light as it moves.
  float focus = lens - rake * 0.45 * reach;
  color *= mix(1.0, 0.5 + 0.75 * max(0.0, 1.0 - focus * focus), fluted);
  // Facets turned toward the light brighten; facets turned away fall into shade.
  color *= max(0.0, 1.0 + relief * 2.2 * reach);

  // ── The glass surface catching the light: this is what draws the shapes ──
  // Neutral white, so light ON the glass reads apart from the blue light behind it.
  vec3 lightColor = vec3(0.92, 0.94, 1.00);
  color += lightColor * max(relief, 0.0) * reach * 0.9;
  color += lightColor * sheen * reach * 0.05 * curved;
  // Glints on rib flanks and bevels, split by angle into a spectrum: the prism.
  vec3 spectrum = 0.5 + 0.5 * cos(6.2831 * (slope * 0.55 + dot(p, along) * 0.7 + vec3(0.0, 0.33, 0.67)));
  color += mix(vec3(1.0), spectrum, 0.55) * glint * reach * 3.0;

  // Seams: a hairline edge, then a dark gap between panels.
  float seam = exp(-u * panelWidth / 0.0016) + exp(-(1.0 - u) * panelWidth / 0.0011) * 0.5;
  color += vec3(0.75, 0.84, 1.0) * seam * (0.012 + reach * 0.25);
  color *= smoothstep(0.0, 0.03, u) * 0.35 + 0.65;

  // Faint cool ambient so the black is not dead.
  color += vec3(0.006, 0.009, 0.022);
  // Keep the top calm for whatever text sits there.
  color *= mix(1.0, calm.z, smoothstep(calm.x, calm.y, uv.y));

  // Filmic shoulder, then grain against banding.
  color = 1.0 - exp(-color * 1.05);
  color += (hash2(gl_FragCoord.xy + fract(time * 7.0)) - 0.5) * (2.0 / 255.0);
  fragmentColor = vec4(color, 1.0);
}
`

export class GlassRenderer {
  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly uniforms: Record<string, WebGLUniformLocation | null>,
  ) {}

  static create(canvas: HTMLCanvasElement): GlassRenderer | null {
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

    const uniforms = Object.fromEntries(
      ["resolution", "time", "pointer", "lightOn", "tone", "calm", "seed", "glassUnit", "lightUnit", "origin", "wall"].map((name) => [name, gl.getUniformLocation(program, name)]),
    )
    return new GlassRenderer(gl, uniforms)
  }

  render(frame: GlassFrame) {
    const { gl, uniforms } = this
    const canvas = gl.canvas as HTMLCanvasElement
    if (canvas.width !== frame.width || canvas.height !== frame.height) {
      canvas.width = frame.width
      canvas.height = frame.height
    }
    gl.viewport(0, 0, frame.width, frame.height)
    gl.uniform2f(uniforms.resolution, frame.width, frame.height)
    gl.uniform1f(uniforms.time, frame.time)
    gl.uniform2f(uniforms.pointer, frame.pointer[0], frame.pointer[1])
    gl.uniform1f(uniforms.lightOn, frame.lightOn)
    gl.uniform1f(uniforms.tone, frame.tone)
    gl.uniform3f(uniforms.calm, frame.calm[0], frame.calm[1], frame.calm[2])
    gl.uniform1f(uniforms.seed, frame.seed)
    gl.uniform1f(uniforms.glassUnit, frame.glassUnit)
    gl.uniform1f(uniforms.lightUnit, frame.lightUnit)
    gl.uniform2f(uniforms.origin, frame.origin[0], frame.origin[1])
    gl.uniform2f(uniforms.wall, frame.wall[0], frame.wall[1])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
