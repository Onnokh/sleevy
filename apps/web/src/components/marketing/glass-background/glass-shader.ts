// The glass behind the homepage hero and the footer's closing band: out of
// focus satin ribbons in the dark, lit by soft coloured lights. It is a live
// take on the looping video behind payloadcms.com's hero, in Sleevy's colours:
// navy and steel, with a rose and a gold light.
//
// What it takes from the reference: a few wide ribbons all run one way, about
// 42° up to the right, overlapping like shingles. Each is a surface in 3D: it
// rocks about its long axis, twists, and rises and falls in waves that run
// along it, so the light slides over it and the parts turned away go black.
// Its top edge rolls over and catches the light as a thin rim. Most of the
// frame is near black. The lights wander slowly and breathe; the waves run
// faster, so the colour moves over the ribbons. The pointer is one more soft
// light. The screen-door grid over it is CSS (glass-background.module.scss),
// so it stays crisp at any pixel ratio. Opaque output (alpha 1).

export type GlassFrame = {
  readonly time: number
  readonly width: number
  readonly height: number
  /**
   * The height the scene is drawn for, in device pixels, when the canvas is a
   * shorter band across its middle: the blades keep that scale. The
   * canvas height when absent.
   */
  readonly sceneHeight?: number
  /** The light's position in scene UV (0…1, y up). */
  readonly pointer: readonly [number, number]
  /** Strength of the light over the glass. */
  readonly lightOn: number
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

// The scene's size, and where the canvas sits in it (a band across its middle).
uniform vec2 resolution;
uniform vec2 origin;
uniform float time;
// Where the pointer's light stands, in scene UV (y up), and how strong it is.
uniform vec2 pointer;
uniform float lightOn;

// The light colours: navy from the dark sky over the ribbons, steel from the
// cool light, as in the reference, and Sleevy's warm pair from its mesh
// palette, rose and gold. The ribbons have no colour of their own.
const vec3 navy = vec3(0.02, 0.13, 0.27);
const vec3 steel = vec3(0.34, 0.50, 0.72);
const vec3 rose = vec3(0.95, 0.30, 0.50);
const vec3 gold = vec3(1.00, 0.64, 0.26);

// The ribbons: their direction, their mean width, and how fast they drift, in
// scene heights.
const float ANGLE = 0.733;
const float WIDTH = 0.36;
const float DRIFT = 0.012;
// The width, in scene heights, of the stage the lights roam: 16:10, whatever
// the screen's shape. The scene is then the same on every screen, only seen
// through a wider or narrower window, so one still matches them all.
const float STAGE = 1.6;
// How far in the camera is: under 1 draws the ribbons larger, so only a few
// fill the frame and they read as shapes of light more than as ribbons.
const float ZOOM = 0.75;

float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// A light close over the ribbons at lpos. Satin has a broad sheen and a
// tighter shine; a light only reaches so far.
vec3 lit(vec3 n, vec2 q, vec3 lpos, vec3 tint) {
  vec3 l = normalize(lpos - vec3(q, 0.0));
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, h), 0.0);
  float sheen = pow(nh, 5.0) * 0.5 + pow(nh, 16.0) * 0.55;
  float diffuse = max(dot(n, l), 0.0) * 0.12;
  vec2 d = lpos.xy - q;
  return tint * (sheen + diffuse) / (1.0 + dot(d, d) * 3.0);
}

void main() {
  float aspect = resolution.x / resolution.y;
  vec2 pixel = gl_FragCoord.xy + origin;
  vec2 uv = pixel / resolution;
  // Scene heights, centred.
  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  // Slow, so it flows under the hero rather than performs. It starts at a
  // moment where every band has some light on it.
  float t = time * 0.56 + 35.0;
  // The waves in the bands run faster than the lights move, so the colour
  // slides over the bands instead of resting on one. Same first frame.
  float wt = time * 1.26 + 35.0;
  // The ribbons are drawn closer; the lights still roam the whole frame.
  vec2 g = q * ZOOM;

  vec2 along = vec2(cos(ANGLE), sin(ANGLE));
  vec2 across = vec2(-along.y, along.x);
  float v = dot(g, along);
  // Across the ribbons, toward the upper left; the field drifts that way.
  // The edges bend, and not all in step.
  float u0 = dot(g, across);
  float u = u0
    + 0.018 * sin(v * 2.2 + t * 0.30)
    + 0.014 * sin(v * 3.1 - t * 0.26 + u0 * 5.0)
    - DRIFT * t;

  // Which ribbon, and where across it: s runs 0 → 1 from the side that dives
  // under the ribbon below to the edge that lies over the ribbon above. The
  // phase term makes the widths uneven and moves them, so the ribbons taper
  // and slide over each other.
  float w = u / WIDTH;
  float ph = w * 1.3 + v * 0.4 + 0.7 + t * 0.1;
  w += 0.28 * sin(ph);
  float id = floor(w);
  float s = fract(w);
  float span = WIDTH / (1.0 + 0.364 * cos(ph));
  float fromEdge = (1.0 - s) * span;
  float fromFoot = s * span;

  // ── Each ribbon in 3D ──
  // It rocks about its long axis, twisting along its length, and rises and
  // falls in waves that run along it: where it turns away from the light it
  // goes black, so dark waves roll through every ribbon. Across, it is gently
  // curved, and at its top edge it rolls over, so the edge catches the light
  // as a rim.
  float r1 = hash1(id + 11.0);
  float r2 = hash1(id + 23.0);
  float r3 = hash1(id + 37.0);
  float tilt = 0.8 * sin(v * 1.8 + wt * 0.50 + r1 * 6.28) + 0.35 * sin(v * 3.4 - wt * 0.37 + r2 * 6.28);
  float rise = 0.9 * cos(v * 3.6 - wt * 0.45 + r3 * 6.28) + 0.35 * cos(v * 6.5 + wt * 0.35 + r1 * 6.28);
  float slope = tilt + 1.0 * (s - 0.5) + 9.0 * pow(s, 40.0);
  // Two long swells run through the whole sheet, across the ribbons.
  vec2 k1 = vec2(cos(-0.35), sin(-0.35));
  vec2 k2 = vec2(cos(2.2), sin(2.2));
  vec2 swells = k1 * 0.7 * cos(dot(g, k1) * 3.5 - wt * 0.42) + k2 * 0.4 * cos(dot(g, k2) * 5.0 + wt * 0.31 + 1.7);
  vec3 n = normalize(vec3(-(slope * across + rise * along + swells), 1.0));

  // The ribbon below lies over this one's foot and shades it; the edge on
  // top is crisp.
  float shade = mix(0.25, 1.0, smoothstep(0.0, mix(0.03, 0.1, r2), fromFoot));
  float crisp = smoothstep(0.0, 0.006, fromEdge);

  // ── The lights, moving over the ribbons ──
  // A cool light, a rose one and a gold one wander slow loops close over the
  // glass and breathe, never quite going out; a dimmer blue one keeps the
  // other side from dying. The rose light is near its fullest, left of
  // centre, on the first frame, so the glass opens with colour.
  vec3 cool = vec3(0.55 * STAGE * sin(t * 0.13), 0.38 * sin(t * 0.17 + 1.0), 0.45);
  vec3 warm = vec3(0.5 * STAGE * sin(t * 0.11 + 2.4), 0.36 * sin(t * 0.15 + 4.0), 0.4);
  vec3 blue = vec3(0.5 * STAGE * sin(t * 0.09 + 4.4), 0.4 * sin(t * 0.12 + 2.2), 0.6);
  vec3 blush = vec3(0.45 * STAGE * sin(t * 0.12 + 5.39), 0.34 * sin(t * 0.16 + 0.51), 0.42);
  vec3 light = lit(n, q, cool, steel) * (0.8 + 0.2 * sin(t * 0.23 + 0.5));
  light += lit(n, q, warm, gold) * (0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * 0.19 + 2.0), 1.5));
  light += lit(n, q, blush, rose) * (0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * 0.17 + 1.56), 1.5));
  light += lit(n, q, blue, navy * 3.0) * 0.5;
  // The pointer: one more cool light.
  light += lit(n, q, vec3((pointer.x - 0.5) * aspect, pointer.y - 0.5, 0.4), steel) * lightOn * 0.8;
  // The dark sky over it all, on the faces turned up.
  light += navy * 0.12 * pow(max(n.z, 0.0), 4.0);

  vec3 color = light * shade * crisp;
  // A toe: what gets little light falls away to black, as in the reference;
  // what is lit keeps its light.
  color = color * color / (color + 0.1);
  // Calm under the navigation.
  color *= mix(1.0, 0.6, smoothstep(0.8, 1.0, uv.y));

  // Soft shoulder for the brightest light.
  color = 1.0 - exp(-color * 0.7);

  // Grain against banding.
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
      ["resolution", "origin", "time", "pointer", "lightOn"].map((name) => [name, gl.getUniformLocation(program, name)]),
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
    const sceneHeight = frame.sceneHeight ?? frame.height
    gl.uniform2f(uniforms.resolution, frame.width, sceneHeight)
    gl.uniform2f(uniforms.origin, 0, (sceneHeight - frame.height) / 2)
    gl.uniform1f(uniforms.time, frame.time)
    gl.uniform2f(uniforms.pointer, frame.pointer[0], frame.pointer[1])
    gl.uniform1f(uniforms.lightOn, frame.lightOn)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
