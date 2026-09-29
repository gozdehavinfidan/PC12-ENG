import * as THREE from 'three'

/**
 * One shader for every image layer. All per-pixel work (window/level, gamma,
 * contrast, unsharp mask, colormap, mask fill/edge, uncertainty flicker, tile
 * reveal) runs on the GPU, so moving a slider costs one uniform write and the
 * CPU never touches pixels (CLAUDE.md s4.7-8).
 *
 * Modes: 0 raw image · 1 mask channel · 2 uncertainty · 3 RGBA overlay · 4 scan grid
 * Colours are passed as raw sRGB triples and written without conversion:
 * the canvas is sRGB and the micrograph must look exactly like the file.
 */
export const MODE = { raw: 0, mask: 1, uncertainty: 2, overlay: 3, scan: 4 } as const

export function hexToVec3(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform int uMode;
uniform sampler2D uTex;
uniform sampler2D uTileAge;
uniform vec2 uSize;          // image size (px)
uniform vec2 uGrid;          // tile grid (cols, rows)
uniform float uTilePx;
uniform float uTime;
uniform float uLive;         // 1 while a job is streaming tiles
uniform vec2 uCurrent;       // tile being processed (col,row), -1 if none
uniform float uOpacity;
uniform vec3 uColor;
uniform int uChannel;
uniform float uFill;         // fill alpha for masks
uniform float uFlicker;      // 0 = static uncertainty (reduced motion / pref)
uniform float uHighlight;    // stack-mode hover
// raw adjustments
uniform int uCmap;           // 0 native 1 gray 2 green 3 magma 4 inverted
uniform float uLevel;
uniform float uWidth;
uniform float uGamma;
uniform float uContrast;
uniform float uUnsharp;

vec3 magma(float t) {
  const vec3 c0 = vec3(-0.002136485, -0.000749655, -0.005386128);
  const vec3 c1 = vec3(0.251660541, 0.677523244, 2.494026599);
  const vec3 c2 = vec3(8.353717279, -3.577719515, 0.314467903);
  const vec3 c3 = vec3(-27.668733086, 14.264730781, -13.649213188);
  const vec3 c4 = vec3(52.176139812, -27.943606072, 12.944169442);
  const vec3 c5 = vec3(-50.768525365, 29.046582821, 4.234152994);
  const vec3 c6 = vec3(18.655705066, -11.489773520, -5.601961509);
  return clamp(c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6))))), 0.0, 1.0);
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float chan(vec4 c) {
  if (uChannel == 0) return c.r;
  if (uChannel == 1) return c.g;
  if (uChannel == 2) return c.b;
  return c.a;
}

// arrival time of this pixel's tile (image rows grow downward)
float tileArrival(vec2 uv) {
  vec2 px = vec2(uv.x * uSize.x, (1.0 - uv.y) * uSize.y);
  vec2 t = floor(px / uTilePx);
  return texture2D(uTileAge, (t + 0.5) / uGrid).r;
}

float revealAt(vec2 uv, float delay) {
  if (uLive < 0.5) return 1.0;
  float a = tileArrival(uv);
  if (a < 0.0) return 0.0;
  return smoothstep(delay, delay + 0.45, uTime - a);
}

void main() {
  vec2 texel = 1.0 / uSize;
  vec4 outc = vec4(0.0);

  if (uMode == 0) {
    vec3 c = texture2D(uTex, vUv).rgb;
    if (uUnsharp > 0.0) {
      vec3 b = vec3(0.0);
      b += texture2D(uTex, vUv + texel * vec2(-1.5, 0.0)).rgb;
      b += texture2D(uTex, vUv + texel * vec2(1.5, 0.0)).rgb;
      b += texture2D(uTex, vUv + texel * vec2(0.0, -1.5)).rgb;
      b += texture2D(uTex, vUv + texel * vec2(0.0, 1.5)).rgb;
      c = c + uUnsharp * (c - b * 0.25);
    }
    float lo = uLevel - uWidth * 0.5;
    float hi = uLevel + uWidth * 0.5;
    float l = max(c.r, max(c.g, c.b));
    vec3 col;
    if (uCmap == 0) {
      col = clamp((c - lo) / max(hi - lo, 1e-4), 0.0, 1.0);
      col = pow(col, vec3(1.0 / uGamma));
      col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
    } else {
      float v = clamp((l - lo) / max(hi - lo, 1e-4), 0.0, 1.0);
      v = pow(v, 1.0 / uGamma);
      v = clamp((v - 0.5) * uContrast + 0.5, 0.0, 1.0);
      if (uCmap == 1) col = vec3(v);
      else if (uCmap == 2) col = vec3(v * 0.25, v, v * 0.35);
      else if (uCmap == 3) col = magma(v);
      else col = vec3(1.0 - v);
    }
    outc = vec4(col, uOpacity);
  } else if (uMode == 1) {
    float m = step(0.5, chan(texture2D(uTex, vUv)));
    if (m > 0.0) {
      // edge = any 4-neighbour outside the mask -> crisp outline over a soft fill
      float n = step(0.5, chan(texture2D(uTex, vUv + vec2(texel.x, 0.0))))
              * step(0.5, chan(texture2D(uTex, vUv - vec2(texel.x, 0.0))))
              * step(0.5, chan(texture2D(uTex, vUv + vec2(0.0, texel.y))))
              * step(0.5, chan(texture2D(uTex, vUv - vec2(0.0, texel.y))));
      float a = mix(1.0, uFill, n);
      float r = revealAt(vUv, 0.22);
      outc = vec4(uColor * (1.0 + 0.35 * uHighlight), a * uOpacity * r);
    }
  } else if (uMode == 2) {
    float u = texture2D(uTex, vUv).b;
    if (u > 0.02) {
      float a = pow(u, 0.9);
      // "blue flicker": each 3x3 px cell twinkles at its own phase (s6)
      vec2 cell = floor(vec2(vUv.x * uSize.x, vUv.y * uSize.y) / 3.0);
      float ph = hash(cell) * 6.2831;
      float fl = mix(1.0, 0.55 + 0.45 * sin(uTime * 4.0 + ph), uFlicker);
      float boost = 1.0;
      float r = 1.0;
      if (uLive > 0.5) {
        float arr = tileArrival(vUv);
        if (arr < 0.0) { r = 0.0; } else {
          float age = uTime - arr;
          r = smoothstep(0.0, 0.12, age);
          boost = 1.0 + 1.6 * (1.0 - smoothstep(0.1, 0.9, age)); // flares, then settles
        }
      }
      outc = vec4(uColor * (0.8 + 0.4 * fl), clamp(a * fl * boost, 0.0, 1.0) * uOpacity * r * 0.9);
    }
  } else if (uMode == 3) {
    vec4 c = texture2D(uTex, vUv);
    outc = vec4(c.rgb, c.a * uOpacity);
  } else if (uMode == 4) {
    if (uLive < 0.5) discard;
    vec2 px = vec2(vUv.x * uSize.x, (1.0 - vUv.y) * uSize.y);
    vec2 t = floor(px / uTilePx);
    vec2 f = fract(px / uTilePx);
    float arr = texture2D(uTileAge, (t + 0.5) / uGrid).r;
    vec2 d = min(f, 1.0 - f) * uTilePx;          // px distance to tile border
    float edge = 1.0 - smoothstep(0.0, 1.6, min(d.x, d.y));
    if (arr < 0.0) {
      outc = vec4(vec3(0.74, 0.58, 0.98), edge * 0.22);
      if (t == uCurrent) {
        float pulse = 0.5 + 0.5 * sin(uTime * 7.0);
        float sweep = smoothstep(0.0, 0.08, fract(uTime * 0.9) - f.y) * smoothstep(0.2, 0.0, fract(uTime * 0.9) - f.y);
        outc = vec4(vec3(0.74, 0.58, 0.98), edge * (0.55 + 0.45 * pulse) + sweep * 0.18 + 0.05);
      }
    } else {
      float age = uTime - arr;
      float flash = 1.0 - smoothstep(0.0, 0.7, age);
      outc = vec4(vec3(0.74, 0.58, 0.98), (edge * 0.8 + 0.06) * flash);
    }
  }
  if (outc.a <= 0.002) discard;
  gl_FragColor = outc;
}
`

export function createLayerMaterial(mode: number) {
  const empty = new THREE.DataTexture(new Float32Array([-1]), 1, 1, THREE.RedFormat, THREE.FloatType)
  empty.needsUpdate = true
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uMode: { value: mode },
      uTex: { value: null },
      uTileAge: { value: empty },
      uSize: { value: new THREE.Vector2(1, 1) },
      uGrid: { value: new THREE.Vector2(1, 1) },
      uTilePx: { value: 256 },
      uTime: { value: 0 },
      uLive: { value: 0 },
      uCurrent: { value: new THREE.Vector2(-1, -1) },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Vector3(1, 1, 1) },
      uChannel: { value: 0 },
      uFill: { value: 0.3 },
      uFlicker: { value: 1 },
      uHighlight: { value: 0 },
      uCmap: { value: 0 },
      uLevel: { value: 0.5 },
      uWidth: { value: 1 },
      uGamma: { value: 1 },
      uContrast: { value: 1 },
      uUnsharp: { value: 0 },
    },
  })
}
