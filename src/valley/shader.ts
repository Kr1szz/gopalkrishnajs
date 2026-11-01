export const VERT = /* glsl */ `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uSky, uClouds, uFar, uMid, uFields, uFore;
uniform vec2 uCells;          // size of the buffer: one texel is one dot
uniform vec2 uOrigin, uSpan;  // the window of the art on screen
uniform vec3 uPan;            // far, middle and near horizontal offset
uniform vec2 uLook;           // small vertical drift from the pointer
uniform float uTime, uDay, uNight, uCloudX;
uniform vec3 uCottage;        // x, y, size in art space

out vec4 outColor;

// ordered dither, 8x8, returns 0..1
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec4 over(vec4 front, vec4 back) { return front + back * (1.0 - front.a); }

float rect(vec2 p, vec4 r) {
    return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w);
}

const vec3 CREAM = vec3(0.984, 0.965, 0.918);
const vec3 NIGHT_PAPER = vec3(0.055, 0.075, 0.133);

void main() {
    vec2 cell = gl_FragCoord.xy;
    vec2 screen = vec2(cell.x / uCells.x, 1.0 - cell.y / uCells.y);
    vec2 uv = uOrigin + screen * uSpan;
    uv.y += uLook.y * (uv.y - 0.5);

    // ---- layers, back to front, each with its own parallax ----
    vec2 farUv = vec2(uv.x + uPan.x * 0.35 + uLook.x * 0.3, uv.y);
    vec2 midUv = vec2(uv.x + uPan.x * 0.7 + uLook.x * 0.55, uv.y);
    vec2 fieldUv = vec2(uv.x + uPan.y + uLook.x, uv.y);
    vec2 foreUv = vec2(uv.x + uPan.z + uLook.x * 1.7, uv.y);

    vec3 sky = texture(uSky, uv).rgb;
    vec4 clouds = texture(uClouds, vec2(uv.x + uCloudX, uv.y));
    vec4 far = texture(uFar, farUv);
    vec4 mid = texture(uMid, midUv);
    vec4 fields = texture(uFields, fieldUv);
    vec4 fore = texture(uFore, foreUv);

    // river shimmer: only the pale water in the fields moves
    float water = smoothstep(0.82, 0.92, dot(fields.rgb, vec3(0.34, 0.36, 0.3))) * fields.a;
    if (water > 0.0) {
        float ripple = sin(fieldUv.y * 1300.0 + sin(fieldUv.x * 70.0) * 2.5 - uTime * 2.2);
        fields.rgb -= water * (0.03 + 0.05 * ripple) * vec3(0.8, 0.7, 0.5);
    }

    vec4 land = over(fore, over(fields, over(mid, far)));

    // ---- time of day: scroll takes the morning to dusk ----
    float gold = smoothstep(0.0, 0.5, uDay) * (1.0 - smoothstep(0.55, 1.0, uDay));
    float dusk = smoothstep(0.45, 1.0, uDay);
    vec3 skyDay = sky;
    skyDay = mix(skyDay, skyDay * vec3(1.02, 0.95, 0.82), gold);
    skyDay = mix(skyDay, mix(vec3(0.98, 0.78, 0.66), vec3(0.93, 0.56, 0.47), smoothstep(0.1, 0.62, uv.y)), dusk * 0.8);
    vec3 landDay = land.rgb;
    landDay = mix(landDay, landDay * vec3(1.06, 0.93, 0.72), gold);
    landDay = mix(landDay, landDay * vec3(0.66, 0.5, 0.56), dusk);
    vec3 cloudDay = mix(clouds.rgb, clouds.rgb * vec3(0.96, 0.62, 0.62), dusk);

    // night: its own sky, and the land keeps only its brightness
    vec3 skyNight = mix(vec3(0.055, 0.075, 0.133), vec3(0.2, 0.2, 0.36), smoothstep(0.3, 0.68, uv.y));
    float lum = dot(land.rgb, vec3(0.3, 0.55, 0.15));
    vec3 landNight = land.a > 0.0 ? lum * vec3(0.27, 0.34, 0.5) * (0.42 + lum * 0.85) : vec3(0.0);
    vec3 cloudNight = vec3(dot(clouds.rgb, vec3(0.33))) * vec3(0.2, 0.2, 0.32);

    vec3 skyColour = mix(skyDay, skyNight, uNight);
    vec3 landColour = mix(landDay, landNight, uNight);
    vec3 cloudColour = mix(cloudDay, cloudNight, uNight);

    vec3 base = mix(skyColour, cloudColour / max(clouds.a, 0.001), clouds.a);
    vec3 colour = mix(base, land.a > 0.0 ? landColour / land.a : base, land.a);

    // chimney smoke, carried right by the wind
    vec2 chimney = vec2(uCottage.x - uCottage.z * 0.255, uCottage.y - uCottage.z * 1.26);
    vec2 sm = foreUv - chimney;
    float rise = clamp(-sm.y / 0.13, 0.0, 1.0);
    float sway = sin(rise * 8.0 - uTime * 1.3) * 0.006 * rise + rise * rise * 0.03;
    float smoke = (1.0 - smoothstep(0.0, 0.004 + rise * 0.016, abs(sm.x - sway)));
    smoke *= step(sm.y, 0.0) * (1.0 - rise) * 0.72;
    colour = mix(colour, mix(vec3(0.93, 0.9, 0.84), vec3(0.42, 0.45, 0.58), uNight), smoke);

    // lit windows after dark (positions match paintCottage in paint.ts)
    float s = uCottage.z * 0.62;
    vec2 w = (foreUv - uCottage.xy) / vec2(s, s * 1.6);
    float glow = rect(w, vec4(0.32, -0.32, 0.46, -0.14)) + rect(w, vec4(0.64, -0.32, 0.78, -0.14))
        + rect(w, vec4(-0.34, -0.32, -0.2, -0.14)) + rect(w, vec4(-0.82, -0.32, -0.68, -0.14));
    colour = mix(colour, vec3(1.0, 0.78, 0.36), clamp(glow, 0.0, 1.0) * uNight);

    // ---- dots ----
    // The sky is paper with sparse coloured dots on a loose grid; they thicken towards the land until the picture
    // takes over completely. The density follows the art, so it travels with the horizon.
    vec3 paper = mix(CREAM, vec3(0.97, 0.82, 0.7), dusk * 0.85);
    paper = mix(paper, NIGHT_PAPER, uNight);

    float density = smoothstep(0.1, 0.7, uv.y);
    density = pow(density, 1.35) * mix(1.0, 0.6, uNight * (1.0 - land.a)) + land.a * 0.2;

    float d0 = bayer8(cell);
    float d1 = bayer8(cell + vec2(3.0, 5.0));
    float d2 = bayer8(cell + vec2(6.0, 1.0));

    // By day each channel dithers on its own, which gives the coloured speckle. At night that just reads as static, so
    // the channels move together in finer steps and the picture stays calm.
    float levels = mix(5.0, 16.0, uNight);
    vec3 thresholds = mix(vec3(d0, d1, d2), vec3(d0), uNight);
    vec3 dotted = floor(colour * levels + thresholds) / levels;

    // the highest dots are too close to paper to read, so they get a pastel ink of their own
    float tint = hash(floor(cell / 2.0) + 7.0);
    vec3 pastel = mix(vec3(0.98, 0.74, 0.74), vec3(1.0, 0.85, 0.5), tint);
    pastel = mix(pastel, vec3(0.19, 0.22, 0.34), uNight);
    dotted = mix(mix(paper, pastel, 0.5 + density * 0.9), dotted, smoothstep(0.34, 0.74, density));

    // tiny gaps in the sky, none on the land
    float grid = step(mod(cell.x, 2.0), 0.5) * step(mod(cell.y, 2.0), 0.5);
    float gridded = mix(grid, 1.0, smoothstep(0.66, 1.0, density));

    // on the grid only every other cell is used, so its thresholds have to come from a half-size pattern
    float threshold = mix(bayer8(floor(cell / 2.0)), d2, smoothstep(0.66, 1.0, density));
    float show = step(threshold * 0.98 + 0.01, density * 1.5) * gridded;
    vec3 result = mix(paper, dotted, show);

    if (uNight > 0.0) {
        // the moon sits on the sky directly: up here the dots are too sparse to draw it
        // clear of the name: beside it on wide screens, below it on tall ones
        vec2 moonAt = uCells.x > uCells.y ? vec2(0.885, 0.23) : vec2(0.78, 0.33);
        vec2 m = (screen - moonAt) * vec2(uCells.x / uCells.y, 1.0);
        float moon = 1.0 - smoothstep(0.052, 0.056, length(m));
        moon *= 1.0 - 0.5 * step(0.5, d0 + 1.0 - smoothstep(0.02, 0.05, length(m - vec2(-0.018, 0.014))));
        result = mix(result, vec3(0.97, 0.94, 0.8), moon * uNight * (1.0 - land.a));

        float star = step(0.9965, hash(floor(cell / 2.0))) * (1.0 - land.a) * (1.0 - smoothstep(0.34, 0.62, uv.y));
        float twinkle = 0.55 + 0.45 * sin(uTime * 1.6 + hash(floor(cell / 3.0)) * 40.0);
        result = mix(result, vec3(0.92, 0.92, 0.82), star * twinkle * uNight);
    }

    outColor = vec4(result, 1.0);
}
`;
