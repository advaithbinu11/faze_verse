// All GLSL for the app. ShaderMaterial compiles as GLSL ES 3.00; every fragment ends with the two
// output includes so colours match the DOM (the Canvas is `flat`, so no tone mapping alters brand red).

const OUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// ---- FaZe logo: extruded mark with flat-shaded white faces, red sides and rim light, and the texture-driven dissolve reveal ----
export const logo = {
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uPulse;
    varying vec3 vPos;
    varying vec3 vWorldPos;
    void main() {
      // A click sends a ripple through the mark in depth, so the flat outline never distorts.
      float ripple = uPulse * sin(position.x * 6.0 - uTime * 9.0) * 0.05;
      vec3 p = position + vec3(0.0, 0.0, ripple);
      vPos = p;
      vec4 world = modelMatrix * vec4(p, 1.0);
      vWorldPos = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uProgress;
    uniform float uPulse;
    uniform vec3 uAccent;
    uniform sampler2D uNoise;
    varying vec3 vPos;
    varying vec3 vWorldPos;
    void main() {
      float n = texture(uNoise, vPos.xy * 0.6 + vPos.z * 0.2 + 0.5).r;
      float threshold = uProgress * 1.12;
      if (n > threshold) discard;
      float edge = 1.0 - smoothstep(0.0, 0.07, threshold - n);

      vec3 objNormal = normalize(cross(dFdx(vPos), dFdy(vPos)));
      vec3 worldNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, worldNormal), 0.0), 2.6);
      float key = max(dot(worldNormal, normalize(vec3(0.5, 0.8, 0.6))), 0.0);
      // The mark's flat faces (normal along the extrusion axis) are white; its sides and bevel are brand red.
      float face = smoothstep(0.7, 0.95, abs(objNormal.z));

      vec3 col = mix(uAccent * (0.35 + 0.65 * key), vec3(0.96) * (0.8 + 0.2 * key), face);
      col += uAccent * fresnel * (0.55 + uPulse);
      col += uAccent * 0.07 * face * (0.5 + 0.5 * sin(vPos.y * 14.0 - uTime * 1.5));
      col += uAccent * edge * 1.6 + vec3(edge * 0.25);

      gl_FragColor = vec4(col, 1.0);
      ${OUT}
    }
  `,
};

// ---- Backdrop: brand-black field with the diagonal slash, grid, scanlines and a pointer glow ----
export const backdrop = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.999, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uAspect;
    uniform vec2 uPointer;
    uniform vec3 uBase;
    uniform vec3 uAccent;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      vec3 col = uBase;

      float s = p.x * 0.58 + p.y * 0.81 + 0.02 + sin(uTime * 0.35) * 0.03;
      float band = smoothstep(0.0, 0.003, s) * (1.0 - smoothstep(0.17, 0.173, s));
      col = mix(col, uAccent * 0.78, band);

      vec2 g = abs(fract(p * 14.0) - 0.5);
      col += vec3(0.05) * smoothstep(0.47, 0.5, max(g.x, g.y)) * (1.0 - band * 0.8);
      col -= vec3(0.018) * (0.5 + 0.5 * sin(vUv.y * 900.0));

      float glow = exp(-length(p - uPointer * vec2(uAspect, 1.0) * 0.5) * 3.0);
      col += uAccent * glow * 0.12;
      col *= 1.0 - smoothstep(0.35, 0.95, length(vUv - 0.5) * 1.35);

      gl_FragColor = vec4(col, 1.0);
      ${OUT}
    }
  `,
};

// ---- Embers: rising additive points, red with the occasional white spark ----
export const embers = {
  vertexShader: /* glsl */ `
    attribute float aSeed;
    uniform float uTime;
    uniform float uSize;
    uniform float uPixelRatio;
    varying float vAlpha;
    varying float vSpark;
    void main() {
      vec3 p = position;
      float t = fract(uTime * 0.035 * (0.5 + aSeed) + aSeed * 7.0);
      p.y = mix(-4.0, 4.0, t);
      p.x += sin(uTime * 0.4 + aSeed * 40.0) * 0.3;
      vAlpha = sin(t * 3.14159);
      vSpark = step(0.82, fract(aSeed * 13.0));
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uSize * (0.4 + aSeed) * uPixelRatio * (6.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uAccent;
    varying float vAlpha;
    varying float vSpark;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d) * vAlpha;
      gl_FragColor = vec4(mix(uAccent, vec3(1.0), vSpark), a);
      ${OUT}
    }
  `,
};

// ---- Pool bars: gradient column with travelling scan lines and a bright cap ----
export const bar = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uHeight;
    uniform float uEmphasis;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float lines = smoothstep(0.42, 0.5, abs(fract(vUv.y * uHeight * 7.0 - uTime * 0.7) - 0.5));
      vec3 col = uColor * (0.28 + 0.72 * vUv.y) * (0.75 + 0.25 * uEmphasis);
      col += vec3(lines * 0.09);
      col += vec3(smoothstep(0.97, 1.0, vUv.y) * 0.6);
      gl_FragColor = vec4(col, 1.0);
      ${OUT}
    }
  `,
};
