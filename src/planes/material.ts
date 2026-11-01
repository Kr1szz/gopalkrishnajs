import { Color, DoubleSide, ShaderMaterial } from 'three';

// Planes are lit in three flat tones with ordered dither between them, so they belong to the valley.
// At uFlat = 1 the paper is exactly the card's colour: that is what lets the sheet hand over to the HTML card unseen.

const vertex = /* glsl */ `
attribute float aWing;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;

void main() {
    vec3 pos = position;
    vUv = uv;
#ifdef USE_INSTANCING
    pos.z += aWing * abs(pos.x) * sin(uTime * 5.0 + aPhase) * 0.5;
    mat4 world = modelMatrix * instanceMatrix;
    vTint = aColor;
#else
    mat4 world = modelMatrix;
    vTint = vec3(-1.0);
#endif
    vNormal = normalize(mat3(world) * normal);
    gl_Position = projectionMatrix * viewMatrix * world * vec4(pos, 1.0);
}
`;

const fragment = /* glsl */ `
uniform vec3 uColor;
uniform float uFlat, uRadius, uCell;
uniform vec2 uSize;
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vTint;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

void main() {
    if (uRadius > 0.0) {
        vec2 q = abs(vUv - 0.5) * uSize - uSize * 0.5 + uRadius;
        if (length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius > 0.0) discard;
    }

    vec3 base = vTint.r < 0.0 ? uColor : vTint;
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    float light = dot(n, normalize(vec3(0.3, 0.75, 0.6))) * 0.5 + 0.5;
    float tone = floor(light * 3.0 + bayer4(floor(gl_FragCoord.xy / uCell))) / 3.0;

    vec3 lit = mix(base * 0.6, mix(base, vec3(1.0), 0.2), tone);
    if (!gl_FrontFacing) lit *= 0.82;
    gl_FragColor = vec4(mix(lit, base, uFlat), 1.0);
}
`;

export function createPaper(cell: number) {
    return new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        side: DoubleSide,
        uniforms: {
            uColor: { value: new Color('#ffffff') },
            uFlat: { value: 0 },
            uRadius: { value: 0 },
            uSize: { value: [1, 1] },
            uCell: { value: cell },
            uTime: { value: 0 },
        },
    });
}
