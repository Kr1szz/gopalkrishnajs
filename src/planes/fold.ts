import { BufferAttribute, BufferGeometry } from 'three';

// A sheet folded into a dart, done the way paper does it. The sheet is cut along each crease, every piece remembers
// which folds carry it, and a pose replays those folds as rotations about their creases, in order.
//
//   sheet width 1, height SHEET_H, nose at +Y, its face towards +Z
//   flat folds:  corners to the centre, then the slanted edges to the centre again
//   then:        wing creases and the keel, which leave the nose at +Y, wings along ±X, top towards +Z

export const SHEET_H = 1.45;

type V2 = [number, number];

interface Op {
    a: V2;
    b: V2;
    side: 1 | -1;       // which side of the line a→b is carried
    angle: number;
    up: 1 | -1;         // does the carried side rise towards +Z or sink away
    lift: number;       // stops stacked layers from fighting for the same depth
    flat: boolean;      // a full fold: later creases are drawn on the folded shape
    stage: 0 | 1 | 2;
}

const NOSE: V2 = [0, SHEET_H / 2];
const SLANT: V2 = [Math.sin(Math.PI / 8), -Math.cos(Math.PI / 8)];
const WING_AT = 0.17;           // how far from the keel the wings bend, at the tail
const KEEL = (72 * Math.PI) / 180;
const WING = (65 * Math.PI) / 180;

const OPS: Op[] = [
    { a: NOSE, b: [0.5, SHEET_H / 2 - 0.5], side: 1, angle: Math.PI, up: 1, lift: 0.004, flat: true, stage: 0 },
    { a: NOSE, b: [-0.5, SHEET_H / 2 - 0.5], side: -1, angle: Math.PI, up: 1, lift: 0.004, flat: true, stage: 0 },
    { a: NOSE, b: [NOSE[0] + SLANT[0], NOSE[1] + SLANT[1]], side: 1, angle: Math.PI, up: 1, lift: 0.008, flat: true, stage: 1 },
    { a: NOSE, b: [NOSE[0] - SLANT[0], NOSE[1] + SLANT[1]], side: -1, angle: Math.PI, up: 1, lift: 0.008, flat: true, stage: 1 },
    { a: NOSE, b: [WING_AT, -SHEET_H / 2], side: 1, angle: WING, up: -1, lift: 0, flat: false, stage: 2 },
    { a: NOSE, b: [-WING_AT, -SHEET_H / 2], side: -1, angle: WING, up: -1, lift: 0, flat: false, stage: 2 },
    { a: [0, -1], b: [0, 1], side: -1, angle: KEEL, up: 1, lift: 0, flat: false, stage: 2 },
    { a: [0, -1], b: [0, 1], side: 1, angle: KEEL, up: 1, lift: 0, flat: false, stage: 2 },
];

const WING_BITS = (1 << 4) | (1 << 5);

interface Poly {
    pts: V2[];          // positions on the flat sheet
    mask: number;       // the ops that carry it
}

const across = (op: Op, p: V2) => {
    const dx = op.b[0] - op.a[0];
    const dy = op.b[1] - op.a[1];
    return dx * (p[1] - op.a[1]) - dy * (p[0] - op.a[0]);
};

function reflect(op: Op, p: V2): V2 {
    const dx = op.b[0] - op.a[0];
    const dy = op.b[1] - op.a[1];
    const len = dx * dx + dy * dy;
    const t = ((p[0] - op.a[0]) * dx + (p[1] - op.a[1]) * dy) / len;
    const fx = op.a[0] + t * dx;
    const fy = op.a[1] + t * dy;
    return [2 * fx - p[0], 2 * fy - p[1]];
}

// where a point of the sheet lies once every full fold before op `upto` has been made
function flatten(p: V2, mask: number, upto: number) {
    let out = p;
    for (let k = 0; k < upto; k++) {
        if (OPS[k].flat && mask & (1 << k)) out = reflect(OPS[k], out);
    }
    return out;
}

function cut(poly: Poly, k: number): Poly[] {
    const op = OPS[k];
    const sides = poly.pts.map((p) => across(op, flatten(p, poly.mask, k)) * op.side);
    const carried: V2[] = [];
    const left: V2[] = [];

    poly.pts.forEach((p, i) => {
        const j = (i + 1) % poly.pts.length;
        const a = sides[i];
        const b = sides[j];
        if (a >= -1e-6) carried.push(p);
        if (a <= 1e-6) left.push(p);
        if ((a > 1e-6 && b < -1e-6) || (a < -1e-6 && b > 1e-6)) {
            const t = a / (a - b);
            const q = poly.pts[j];
            const hit: V2 = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
            carried.push(hit);
            left.push(hit);
        }
    });

    const out: Poly[] = [];
    if (carried.length >= 3 && sides.some((s) => s > 1e-6)) out.push({ pts: carried, mask: poly.mask | (1 << k) });
    if (left.length >= 3 && sides.some((s) => s < -1e-6)) out.push({ pts: left, mask: poly.mask });
    return out;
}

function pieces() {
    let polys: Poly[] = [{
        pts: [[-0.5, -SHEET_H / 2], [0.5, -SHEET_H / 2], [0.5, SHEET_H / 2], [-0.5, SHEET_H / 2]],
        mask: 0,
    }];
    OPS.forEach((_, k) => {
        polys = polys.flatMap((poly) => cut(poly, k));
    });

    const verts: number[] = [];
    const masks: number[] = [];
    for (const { pts, mask } of polys) {
        for (let i = 1; i < pts.length - 1; i++) {
            for (const p of [pts[0], pts[i], pts[i + 1]]) {
                verts.push(p[0], p[1]);
                masks.push(mask);
            }
        }
    }
    return { verts: new Float32Array(verts), masks: new Uint16Array(masks), count: masks.length };
}

const ramp = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
};

// creases as axis + a sign, so "rises towards +Z" holds whichever way each line was drawn
const CREASES = OPS.map((op) => {
    const dx = op.b[0] - op.a[0];
    const dy = op.b[1] - op.a[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    // a point just on the carried side: cross(u, side normal).z tells which way a positive rotation lifts it
    const nx = -uy * op.side;
    const ny = ux * op.side;
    const lifts = ux * ny - uy * nx;
    return { ux, uy, px: op.a[0], py: op.a[1], sign: Math.sign(lifts) * op.up };
});

const stageOf = (f: number): [number, number, number] => [ramp(0, 0.3, f), ramp(0.27, 0.55, f), ramp(0.52, 1, f)];

function pose(target: Float32Array, src: { verts: Float32Array; masks: Uint16Array; count: number }, f: number) {
    const stages = stageOf(f);
    for (let i = 0; i < src.count; i++) {
        let x = src.verts[i * 2];
        let y = src.verts[i * 2 + 1];
        let z = 0;
        const mask = src.masks[i];
        for (let k = 0; k < OPS.length; k++) {
            if (!(mask & (1 << k))) continue;
            const op = OPS[k];
            const t = stages[op.stage];
            if (t === 0) continue;
            const c = CREASES[k];
            const angle = op.angle * t * c.sign;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rx = x - c.px;
            const ry = y - c.py;
            const dot = rx * c.ux + ry * c.uy;
            x = c.px + rx * cos + c.uy * z * sin + c.ux * dot * (1 - cos);
            y = c.py + ry * cos - c.ux * z * sin + c.uy * dot * (1 - cos);
            z = z * cos + (c.ux * ry - c.uy * rx) * sin + op.lift * t;
        }
        target[i * 3] = x;
        target[i * 3 + 1] = y;
        target[i * 3 + 2] = z - stages[2] * 0.09;
    }
}

export interface Sheet {
    geometry: BufferGeometry;
    fold(f: number): void;
}

function build(wings: boolean) {
    const src = pieces();
    const geometry = new BufferGeometry();
    const position = new Float32Array(src.count * 3);
    const uv = new Float32Array(src.count * 2);
    for (let i = 0; i < src.count; i++) {
        uv[i * 2] = src.verts[i * 2] + 0.5;
        uv[i * 2 + 1] = src.verts[i * 2 + 1] / SHEET_H + 0.5;
    }
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    if (wings) {
        const wing = new Float32Array(src.count);
        for (let i = 0; i < src.count; i++) wing[i] = src.masks[i] & WING_BITS ? 1 : 0;
        geometry.setAttribute('aWing', new BufferAttribute(wing, 1));
    }
    return { src, geometry, position };
}

/** One sheet that can sit at any point of the fold (0 flat, 1 plane). */
export function createSheet(): Sheet {
    const { src, geometry, position } = build(false);
    const attr = geometry.getAttribute('position') as BufferAttribute;
    let last = -1;
    const fold = (f: number) => {
        if (f === last) return;
        last = f;
        pose(position, src, f);
        attr.needsUpdate = true;
        geometry.computeVertexNormals();
    };
    fold(0);
    return { geometry, fold };
}

/** A finished plane, for the flock. */
export function createPlaneGeometry() {
    const { src, geometry, position } = build(true);
    pose(position, src, 1);
    geometry.computeVertexNormals();
    return geometry;
}
