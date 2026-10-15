// Renders the homepage hero's glass (apps/web/.../glass-background/glass-shader.ts)
// offline, as a seamless loop for the App Store creative asset videos. The
// fragment shader is ported to Metal as is; only the loop is new.
//
//   swiftc -O scripts/app-store-screenshots/glass-loop.swift -o /tmp/glass-loop
//   /tmp/glass-loop <width> <height> <out.mp4> [seconds=15] [fade=3] [fps=30]
//
// The shader's time does not repeat, so the last `fade` seconds cross-fade
// into the frames just before time 0: the loop's last frame runs straight into
// its first, which is the web still's frame (time 0). Video is H.264 through
// ffmpeg, with a silent audio track.
import Foundation
import Metal

let shaderSource = """
#include <metal_stdlib>
using namespace metal;

constant float3 navy = float3(0.02, 0.13, 0.27);
constant float3 steel = float3(0.34, 0.50, 0.72);
constant float3 rose = float3(0.95, 0.30, 0.50);
constant float3 gold = float3(1.00, 0.64, 0.26);
constant float ANGLE = 0.733;
constant float WIDTH = 0.36;
constant float DRIFT = 0.012;
constant float STAGE = 1.6;
constant float ZOOM = 0.75;

static float hash1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
static float hash2(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

static float3 lit(float3 n, float2 q, float3 lpos, float3 tint) {
  float3 l = normalize(lpos - float3(q, 0.0));
  float3 h = normalize(l + float3(0.0, 0.0, 1.0));
  float nh = max(dot(n, h), 0.0);
  float sheen = pow(nh, 5.0) * 0.5 + pow(nh, 16.0) * 0.55;
  float diffuse = max(dot(n, l), 0.0) * 0.12;
  float2 d = lpos.xy - q;
  return tint * (sheen + diffuse) / (1.0 + dot(d, d) * 3.0);
}

// The web canvas's roaming pointer light (glass-background.tsx).
static float2 roam(float seconds) {
  return float2(0.5 + 0.2 * sin(seconds * 0.21), 0.46 + 0.2 * sin(seconds * 0.33 + 1.1));
}

// glass-shader.ts's main(), for one frame at `time`. `pixel` is y up.
static float3 glass(float2 pixel, float2 resolution, float time) {
  float aspect = resolution.x / resolution.y;
  float2 uv = pixel / resolution;
  float2 q = float2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float t = time * 0.56 + 35.0;
  float wt = time * 1.26 + 35.0;
  float2 g = q * ZOOM;

  float2 along = float2(cos(ANGLE), sin(ANGLE));
  float2 across = float2(-along.y, along.x);
  float v = dot(g, along);
  float u0 = dot(g, across);
  float u = u0 + 0.018 * sin(v * 2.2 + t * 0.30) + 0.014 * sin(v * 3.1 - t * 0.26 + u0 * 5.0) - DRIFT * t;

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
  float2 pointer = roam(time);
  light += lit(n, q, float3((pointer.x - 0.5) * aspect, pointer.y - 0.5, 0.4), steel) * 0.25 * 0.8;
  light += navy * 0.12 * pow(max(n.z, 0.0), 4.0);

  float3 color = light * shade * crisp;
  color = color * color / (color + 0.1);
  color *= mix(1.0, 0.6, smoothstep(0.8, 1.0, uv.y));
  return 1.0 - exp(-color * 0.7);
}

struct Frame { float2 resolution; float timeA; float timeB; float mixB; float grain; };

kernel void render(texture2d<float, access::write> out [[texture(0)]],
                   constant Frame &f [[buffer(0)]],
                   uint2 gid [[thread_position_in_grid]]) {
  if (gid.x >= out.get_width() || gid.y >= out.get_height()) return;
  float2 pixel = float2(gid.x + 0.5, f.resolution.y - gid.y - 0.5);
  float3 color = glass(pixel, f.resolution, f.timeA);
  if (f.mixB > 0.0) color = mix(color, glass(pixel, f.resolution, f.timeB), f.mixB);
  color += (hash2(pixel + f.grain) - 0.5) * (2.0 / 255.0);
  out.write(float4(saturate(color), 1.0), gid);
}
"""

struct Frame { var resolution: SIMD2<Float>; var timeA: Float; var timeB: Float; var mixB: Float; var grain: Float }

let a = CommandLine.arguments
guard a.count >= 4, let W = Int(a[1]), let H = Int(a[2]) else {
    print("usage: glass-loop <width> <height> <out.mp4> [seconds] [fade] [fps]")
    exit(64)
}
let output = a[3]
let seconds = a.count > 4 ? Double(a[4])! : 15
let fade = a.count > 5 ? Double(a[5])! : 3
let fps = a.count > 6 ? Int(a[6])! : 30

let device = MTLCreateSystemDefaultDevice()!
let library = try device.makeLibrary(source: shaderSource, options: nil)
let pipeline = try device.makeComputePipelineState(function: library.makeFunction(name: "render")!)
let queue = device.makeCommandQueue()!
let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .rgba8Unorm, width: W, height: H, mipmapped: false)
descriptor.usage = [.shaderWrite]
descriptor.storageMode = .shared
let texture = device.makeTexture(descriptor: descriptor)!
var bytes = [UInt8](repeating: 0, count: W * H * 4)

func draw(_ index: Int) -> [UInt8] {
    let time = Double(index) / Double(fps)
    // The last `fade` seconds blend toward the same moment one loop earlier,
    // so frame `seconds * fps` would be frame 0 exactly.
    let fadeStart = seconds - fade
    let mixB = time > fadeStart ? (time - fadeStart) / fade : 0
    let eased = mixB * mixB * (3 - 2 * mixB)
    var frame = Frame(resolution: SIMD2(Float(W), Float(H)), timeA: Float(time), timeB: Float(time - seconds),
                      mixB: Float(eased), grain: Float(index % 97) * 0.731)
    let buffer = queue.makeCommandBuffer()!
    let encoder = buffer.makeComputeCommandEncoder()!
    encoder.setComputePipelineState(pipeline)
    encoder.setTexture(texture, index: 0)
    encoder.setBytes(&frame, length: MemoryLayout<Frame>.stride, index: 0)
    encoder.dispatchThreads(MTLSize(width: W, height: H, depth: 1), threadsPerThreadgroup: MTLSize(width: 16, height: 16, depth: 1))
    encoder.endEncoding()
    buffer.commit()
    buffer.waitUntilCompleted()
    texture.getBytes(&bytes, bytesPerRow: W * 4, from: MTLRegionMake2D(0, 0, W, H), mipmapLevel: 0)
    return bytes
}

let ffmpeg = Process()
ffmpeg.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/ffmpeg")
ffmpeg.arguments = ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "\(W)x\(H)", "-r", "\(fps)", "-i", "-",
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                    "-map", "0:v", "-map", "1:a", "-shortest",
                    "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "14",
                    "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output]
let pipe = Pipe()
ffmpeg.standardInput = pipe
try ffmpeg.run()
let frames = Int(seconds * Double(fps))
for index in 0..<frames {
    pipe.fileHandleForWriting.write(Data(draw(index)))
}
try pipe.fileHandleForWriting.close()
ffmpeg.waitUntilExit()
guard ffmpeg.terminationStatus == 0 else { fatalError("ffmpeg failed") }
print("\(output) \(W)x\(H) \(frames) frames")
