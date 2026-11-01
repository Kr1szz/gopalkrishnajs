// Paints the valley once at boot: six parallax layers on Canvas 2D, from seeded noise plus a few placed objects.
// Nothing here is pixel art yet: the layers are soft colour fields, and shader.ts turns them into dots.
// All coordinates are fractions of the art (x right, y down), so the same painting works at any resolution.

export const LAYERS = ['sky', 'clouds', 'far', 'mid', 'fields', 'fore'] as const;
export type LayerName = (typeof LAYERS)[number];

/** Where the cottage sits, and its windows, for the night glow and chimney smoke. Art fractions, fore layer. */
export const COTTAGE = { x: 0.33, y: 0.905, size: 0.085 };

function rng(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function noise1(seed: number) {
    const r = rng(seed);
    const table = Array.from({ length: 512 }, () => r());
    const at = (x: number) => {
        const i = Math.floor(x);
        const f = x - i;
        const u = f * f * (3 - 2 * f);
        return table[i & 511] * (1 - u) + table[(i + 1) & 511] * u;
    };
    return (x: number, octaves = 4) => {
        let sum = 0;
        let amp = 0.5;
        let freq = 1;
        for (let o = 0; o < octaves; o++) {
            sum += amp * at(x * freq);
            amp *= 0.5;
            freq *= 2.05;
        }
        return sum;
    };
}

type Ctx = CanvasRenderingContext2D;

function canvas(w: number, h: number) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return { c, g: c.getContext('2d', { willReadFrequently: false })! };
}

function ridge(g: Ctx, w: number, h: number, height: (x: number) => number, fill: string | CanvasGradient) {
    g.beginPath();
    g.moveTo(0, h);
    for (let px = 0; px <= w; px += 2) g.lineTo(px, height(px / w) * h);
    g.lineTo(w, h);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
}

function paintSky(g: Ctx, w: number, h: number) {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.68);
    sky.addColorStop(0, '#fbf6ea');
    sky.addColorStop(0.3, '#fbf5e2');
    sky.addColorStop(0.62, '#feefc4');
    sky.addColorStop(0.82, '#ffe2a2');
    sky.addColorStop(1, '#fbcd8e');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);

    // low sun, off to the right
    const sun = g.createRadialGradient(w * 0.66, h * 0.6, 0, w * 0.66, h * 0.6, h * 0.42);
    sun.addColorStop(0, 'rgba(255, 240, 170, 0.95)');
    sun.addColorStop(0.35, 'rgba(255, 228, 150, 0.45)');
    sun.addColorStop(1, 'rgba(255, 228, 150, 0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);

    // a little pink cast in the opposite corner
    const pink = g.createRadialGradient(w * 0.08, h * 0.58, 0, w * 0.08, h * 0.58, h * 0.5);
    pink.addColorStop(0, 'rgba(246, 170, 150, 0.5)');
    pink.addColorStop(1, 'rgba(246, 170, 150, 0)');
    g.fillStyle = pink;
    g.fillRect(0, 0, w, h);
}

function paintClouds(g: Ctx, w: number, h: number) {
    const r = rng(11);
    const puff = (cx: number, cy: number, rx: number, ry: number, colour: string) => {
        g.fillStyle = colour;
        for (const ox of [-w, 0, w]) {
            g.beginPath();
            g.ellipse(cx + ox, cy, rx, ry, 0, 0, Math.PI * 2);
            g.fill();
        }
    };
    const bank = (cx: number, cy: number, span: number, tall: number, shadow: string, light: string) => {
        const n = Math.round(span / (w * 0.006));
        for (let i = 0; i < n; i++) {
            const t = r();
            const fall = 1 - Math.abs(t - 0.5) * 2;
            const x = cx + (t - 0.5) * span;
            const y = cy + (r() - 0.5) * tall * 0.5;
            const rx = w * (0.012 + r() * 0.034) * (0.5 + fall);
            const ry = tall * (0.14 + r() * 0.24) * (0.45 + fall);
            puff(x, y, rx, ry, shadow);
            puff(x + rx * 0.1, y - ry * 0.62, rx * 0.7, ry * 0.52, light);
        }
    };

    bank(w * 0.07, h * 0.59, w * 0.2, h * 0.05, '#ee9a78', '#fccfae');
    bank(w * 0.24, h * 0.615, w * 0.24, h * 0.03, '#f0a27e', '#fcd8b6');
    bank(w * 0.52, h * 0.555, w * 0.12, h * 0.016, '#f6bb91', '#fde2c2');
    bank(w * 0.86, h * 0.585, w * 0.22, h * 0.018, '#f6c07e', '#ffe9a8');

    // thin bright streaks on the sun side
    g.globalAlpha = 0.75;
    for (let i = 0; i < 26; i++) {
        const y = h * (0.56 + r() * 0.06);
        const x = w * (0.55 + r() * 0.45);
        puff(x, y, w * (0.02 + r() * 0.07), h * 0.0016, '#fff0b0');
    }
    g.globalAlpha = 1;
}

function paintFar(g: Ctx, w: number, h: number) {
    const a = noise1(3);
    const b = noise1(4);
    ridge(g, w, h, (x) => 0.655 - a(x * 6 + 1.2, 5) * 0.11 + 0.012, '#d9c3b6');
    ridge(g, w, h, (x) => 0.672 - b(x * 9 + 5.0, 5) * 0.075 + 0.004, '#c3b3a0');
}

function paintMid(g: Ctx, w: number, h: number) {
    const a = noise1(21);
    const b = noise1(22);
    const c = noise1(23);

    // the long hill falling from the left into the valley
    const hillA = (x: number) => 0.615 + Math.pow(x, 0.85) * 0.105 - a(x * 7 + 2, 5) * 0.035 + 0.012;
    const grey = g.createLinearGradient(0, h * 0.58, 0, h * 0.74);
    grey.addColorStop(0, '#928f78');
    grey.addColorStop(1, '#7c8360');
    ridge(g, w, h, hillA, grey);

    // the same on the right, much hazier and lower
    const hillR = (x: number) => 0.7 - Math.max(0, x - 0.55) * 0.13 - b(x * 8 + 9, 5) * 0.03 + 0.012;
    ridge(g, w, h, hillR, '#a6a585');

    // a darker, greener shoulder in front on the left
    const hillB = (x: number) => 0.668 + Math.pow(x, 0.8) * 0.095 - c(x * 11 + 4, 6) * 0.03 + 0.012;
    const green = g.createLinearGradient(0, h * 0.64, 0, h * 0.76);
    green.addColorStop(0, '#5d7145');
    green.addColorStop(1, '#4f6c38');
    ridge(g, w, h, hillB, green);

    // woodland speckle along those slopes
    const r = rng(29);
    for (let i = 0; i < 1400; i++) {
        const x = r();
        const top = hillA(x);
        const y = top + r() * 0.07;
        g.fillStyle = r() < 0.6 ? 'rgba(78, 92, 58, 0.5)' : 'rgba(134, 138, 96, 0.45)';
        g.beginPath();
        g.ellipse(x * w, y * h, w * (0.0012 + r() * 0.0028), h * (0.001 + r() * 0.0022), 0, 0, Math.PI * 2);
        g.fill();
    }
}

// the river, as (x, y, half width) stations from the far bend to the near edge
const RIVER: [number, number, number][] = [
    [0.9, 0.727, 0.0008],
    [0.76, 0.733, 0.002],
    [0.6, 0.74, 0.0032],
    [0.5, 0.748, 0.0042],
    [0.56, 0.76, 0.0055],
    [0.7, 0.772, 0.0075],
    [0.76, 0.79, 0.0105],
    [0.66, 0.808, 0.0145],
    [0.555, 0.83, 0.018],
    [0.585, 0.858, 0.022],
    [0.74, 0.882, 0.03],
    [0.93, 0.905, 0.042],
    [1.1, 0.925, 0.06],
];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
}

function riverPoints(step = 24) {
    const out: [number, number, number][] = [];
    const s = (i: number) => RIVER[Math.max(0, Math.min(RIVER.length - 1, i))];
    for (let i = 0; i < RIVER.length - 1; i++) {
        for (let k = 0; k < step; k++) {
            const t = k / step;
            const [a, b, c, d] = [s(i - 1), s(i), s(i + 1), s(i + 2)];
            out.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t), catmull(a[2], b[2], c[2], d[2], t)]);
        }
    }
    return out;
}

function paintFields(g: Ctx, w: number, h: number) {
    const a = noise1(31);
    const r = rng(37);
    const top = (x: number) => 0.725 + Math.sin(x * 3.1 + 0.4) * 0.006 - a(x * 9 + 2, 4) * 0.012 + 0.006;

    const base = g.createLinearGradient(0, h * 0.71, 0, h);
    base.addColorStop(0, '#c0bf72');
    base.addColorStop(0.16, '#a2b257');
    base.addColorStop(0.42, '#74983f');
    base.addColorStop(1, '#4d7a30');
    ridge(g, w, h, top, base);

    // patchwork parcels, flatter and smaller towards the horizon
    const tints = ['#d9c95c', '#e4d56a', '#a9c04c', '#8fae42', '#6d9a3a', '#5a8634', '#b5c656'];
    for (let row = 0; row < 16; row++) {
        const t = row / 15;
        const y = 0.735 + t * t * 0.19;
        const tall = 0.006 + t * t * 0.03;
        let x = -0.04 + r() * 0.04;
        while (x < 1.04) {
            const wide = (0.03 + r() * 0.05) * (0.45 + t * 1.3);
            const skew = (x - 0.5) * tall * 1.6;
            g.fillStyle = tints[Math.floor(r() * tints.length)];
            g.globalAlpha = 0.38 + r() * 0.45;
            g.beginPath();
            g.moveTo(x * w, y * h);
            g.lineTo((x + wide) * w, (y + (r() - 0.5) * 0.003) * h);
            g.lineTo((x + wide + skew) * w, (y + tall) * h);
            g.lineTo((x + skew) * w, (y + tall) * h);
            g.closePath();
            g.fill();
            x += wide * (0.8 + r() * 0.45);
        }
    }
    g.globalAlpha = 1;

    // terraces cut into the left side
    for (let i = 0; i < 9; i++) {
        const y = 0.775 + i * 0.0105;
        g.strokeStyle = i % 2 ? '#c4c55c' : '#4f7433';
        g.lineWidth = h * (0.0028 + i * 0.0003);
        g.globalAlpha = 0.8;
        g.beginPath();
        for (let x = 0; x <= 0.34 - i * 0.012; x += 0.01) {
            const yy = y + Math.sin(x * 11 + i * 0.5) * 0.007 + x * x * 0.1;
            if (x === 0) g.moveTo(0, yy * h);
            else g.lineTo(x * w, yy * h);
        }
        g.stroke();
    }
    g.globalAlpha = 1;

    // the sunlit stretch in the middle of the valley
    const glow = g.createRadialGradient(w * 0.44, h * 0.79, 0, w * 0.44, h * 0.79, w * 0.2);
    glow.addColorStop(0, 'rgba(248, 226, 92, 0.72)');
    glow.addColorStop(0.5, 'rgba(238, 216, 90, 0.32)');
    glow.addColorStop(1, 'rgba(238, 216, 90, 0)');
    g.save();
    g.translate(0, h * 0.79);
    g.scale(1, 0.42);
    g.translate(0, -h * 0.79);
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h * 1.4);
    g.restore();

    // big soft shadows, so the plain rolls instead of lying in stripes
    for (let i = 0; i < 46; i++) {
        const t = r();
        const y = 0.74 + t * t * 0.2;
        const x = r();
        const rx = (0.03 + r() * 0.09) * (0.5 + t);
        const shade = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, rx * w);
        const colour = r() < 0.68 ? '42, 74, 38' : '236, 216, 96';
        shade.addColorStop(0, `rgba(${colour}, 0.34)`);
        shade.addColorStop(1, `rgba(${colour}, 0)`);
        g.save();
        g.translate(0, y * h);
        g.scale(1, 0.26);
        g.translate(0, -y * h);
        g.fillStyle = shade;
        g.fillRect(0, (y - 1) * h, w, h * 3);
        g.restore();
    }

    // grain of crops and grass
    for (let i = 0; i < 9000; i++) {
        const t = r();
        const y = 0.73 + t * t * 0.25;
        const x = r();
        const light = r() < 0.5;
        g.fillStyle = light ? 'rgba(226, 216, 110, 0.32)' : 'rgba(40, 72, 38, 0.3)';
        g.fillRect(x * w, y * h, w * (0.0008 + t * 0.003), Math.max(1, h * (0.0006 + t * 0.0016)));
    }

    // hedgerows: short lines of bushes running along the parcels
    const bush = (x: number, y: number, size: number) => {
        g.fillStyle = r() < 0.65 ? '#3f6330' : '#2d4b28';
        g.beginPath();
        g.ellipse(x * w, y * h, size * w, size * w * 0.72, 0, 0, Math.PI * 2);
        g.fill();
    };
    for (let i = 0; i < 64; i++) {
        const t = r();
        const y = 0.738 + t * t * 0.19;
        const x = r();
        const slope = (r() - 0.5) * 0.5;
        const reach = (0.012 + r() * 0.03) * (0.5 + t);
        for (let k = 0; k < 18; k++) {
            const q = k / 17;
            bush(x + q * reach, y + q * reach * slope + (r() - 0.5) * 0.001, (0.0009 + t * t * 0.0026) * (0.7 + r() * 0.7));
        }
    }
    // lone trees, thinly scattered
    for (let i = 0; i < 240; i++) {
        const t = r();
        bush(r(), 0.74 + t * t * 0.19, (0.0008 + t * t * 0.0034) * (0.6 + r()));
    }

    // river: dark bank first, then water, then a bright core
    const wobble = noise1(38);
    const pts = riverPoints();
    const stamp = (dy: number, grow: number, colour: string) => {
        g.fillStyle = colour;
        pts.forEach(([x, y, half], i) => {
            const rx = (half * (0.8 + wobble(i * 0.09, 3) * 0.5) + grow) * w;
            if (rx <= 0) return;
            g.beginPath();
            g.ellipse(x * w, (y + dy) * h, rx, Math.max(1, rx * 0.34), 0, 0, Math.PI * 2);
            g.fill();
        });
    };
    stamp(0.0026, 0.0028, '#3b5730');
    stamp(0.0008, 0.0012, '#b9bf9a');
    stamp(0, -0.0002, '#efe9d2');
    stamp(-0.0004, -0.0016, '#fbf6e2');

    // sand bars and glints
    for (let i = 0; i < pts.length; i += 2) {
        const [x, y, half] = pts[i];
        const side = r() < 0.5 ? -1 : 1;
        g.fillStyle = r() < 0.5 ? 'rgba(255, 232, 160, 0.6)' : 'rgba(150, 168, 120, 0.42)';
        g.beginPath();
        g.ellipse((x + side * half * r()) * w, (y + (r() - 0.5) * half * 0.3) * h, half * w * (0.2 + r() * 0.4), Math.max(1, half * w * 0.05), 0, 0, Math.PI * 2);
        g.fill();
    }
}

function paintTree(g: Ctx, x: number, y: number, size: number, r: () => number) {
    g.fillStyle = '#3a2c20';
    g.fillRect(x - size * 0.035, y - size * 0.5, size * 0.07, size * 0.5);

    const blob = (ox: number, oy: number, rad: number, colour: string) => {
        g.fillStyle = colour;
        g.beginPath();
        g.ellipse(x + ox * size, y + oy * size, rad * size, rad * size * 0.85, 0, 0, Math.PI * 2);
        g.fill();
    };
    const crown = (n: number, reach: number, big: number, colour: string, ox = 0, oy = 0) => {
        for (let i = 0; i < n; i++) {
            const a = r() * Math.PI * 2;
            const d = reach * Math.sqrt(r());
            blob(ox + Math.cos(a) * d, -0.84 + oy + Math.sin(a) * d * 0.82, big * (0.4 + r() * 0.6), colour);
        }
    };
    crown(70, 0.38, 0.13, '#1f3a26');
    crown(90, 0.34, 0.08, '#3a5e30', 0.02, -0.02);
    crown(70, 0.27, 0.055, '#5f8238', 0.08, -0.06);
    crown(46, 0.2, 0.035, '#b2b348', 0.15, -0.12);
    crown(16, 0.1, 0.022, '#ecdc6a', 0.2, -0.17);
}

function paintCottage(g: Ctx, x: number, y: number, s: number) {
    const px = (v: number) => v * s;
    g.save();
    g.translate(x, y);

    const shape = (pts: [number, number][], colour: string) => {
        g.fillStyle = colour;
        g.beginPath();
        pts.forEach(([a, b], i) => (i ? g.lineTo(px(a), px(b)) : g.moveTo(px(a), px(b))));
        g.closePath();
        g.fill();
    };

    // long side wall, in shade
    shape([[-1.05, -0.02], [0.18, 0.04], [0.18, -0.42], [-1.05, -0.46]], '#b9aea6');
    // gable end, facing the sun
    shape([[0.18, 0.04], [0.92, -0.04], [0.92, -0.48], [0.56, -0.86], [0.18, -0.42]], '#f5efe4');
    shape([[0.18, 0.04], [0.92, -0.04], [0.92, -0.08], [0.18, -0.01]], '#b8ae9f');

    // roof
    shape([[-1.2, -0.4], [0.14, -0.36], [0.56, -0.92], [-0.76, -0.98]], '#3a3638');
    shape([[-1.2, -0.4], [0.14, -0.36], [0.2, -0.44], [-1.13, -0.48]], '#54504f');
    shape([[-0.76, -0.98], [0.56, -0.92], [0.5, -0.84], [-0.8, -0.9]], '#6c6664');
    shape([[0.56, -0.92], [1.0, -0.45], [0.92, -0.42], [0.54, -0.8], [0.2, -0.4], [0.14, -0.36]], '#2c292a');

    // chimney
    shape([[-0.5, -0.94], [-0.32, -0.93], [-0.32, -1.24], [-0.5, -1.24]], '#7f5a4b');
    shape([[-0.54, -1.24], [-0.28, -1.24], [-0.28, -1.3], [-0.54, -1.3]], '#4c3a33');

    // windows and door
    const win = (a: number, b: number, c: number, d: number, frame: string) => {
        shape([[a - 0.02, b - 0.02], [c + 0.02, b - 0.02], [c + 0.02, d + 0.02], [a - 0.02, d + 0.02]], frame);
        shape([[a, b], [c, b], [c, d], [a, d]], '#4a2f2a');
    };
    win(0.32, -0.32, 0.46, -0.14, '#8a5a48');
    win(0.64, -0.32, 0.78, -0.14, '#8a5a48');
    win(0.5, -0.62, 0.62, -0.48, '#8a5a48');
    win(-0.82, -0.32, -0.68, -0.14, '#6d5346');
    win(-0.34, -0.32, -0.2, -0.14, '#6d5346');
    shape([[-0.6, -0.28], [-0.44, -0.28], [-0.44, 0], [-0.6, 0]], '#5a3a2c');

    g.restore();
}

function paintFore(g: Ctx, w: number, h: number) {
    const a = noise1(41);
    const b = noise1(42);
    const r = rng(47);

    // the knoll the cottage stands on, sloping away to the right
    const knoll = (x: number) => 0.9 + Math.pow(Math.abs(x - 0.27), 1.5) * 0.28 - a(x * 7 + 3, 4) * 0.022 + 0.012;
    const grass = g.createLinearGradient(0, h * 0.88, 0, h);
    grass.addColorStop(0, '#6a8a3c');
    grass.addColorStop(0.38, '#476a30');
    grass.addColorStop(1, '#233a22');
    ridge(g, w, h, knoll, grass);

    // rough tufts so the slope isn't a flat gradient
    for (let i = 0; i < 2400; i++) {
        const x = r();
        const y = knoll(x) + r() * 0.1;
        const light = r() < 0.5;
        g.fillStyle = light ? 'rgba(146, 164, 74, 0.5)' : 'rgba(34, 58, 32, 0.5)';
        g.fillRect(x * w, y * h, w * (0.002 + r() * 0.005), h * (0.0016 + r() * 0.0022));
    }

    // vegetable rows in front of the house
    const garden = [COTTAGE.x + 0.02, COTTAGE.y + 0.03];
    for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#2d4a2a' : '#7a6a3c';
        g.fillRect((garden[0] - 0.03) * w, (garden[1] + i * 0.0048) * h, w * 0.1, h * 0.0032);
    }

    // path
    g.strokeStyle = '#b6a877';
    g.lineWidth = h * 0.0045;
    g.beginPath();
    g.moveTo((COTTAGE.x - 0.02) * w, (COTTAGE.y + 0.002) * h);
    g.bezierCurveTo((COTTAGE.x - 0.01) * w, (COTTAGE.y + 0.04) * h, (COTTAGE.x - 0.09) * w, 0.955 * h, (COTTAGE.x - 0.12) * w, h);
    g.stroke();

    // fence running off to the left
    g.fillStyle = '#6a5233';
    for (let i = 0; i < 14; i++) {
        const fx = COTTAGE.x - 0.07 - i * 0.012;
        const fy = 0.915 + i * 0.0018;
        g.fillRect(fx * w, fy * h, Math.max(1, w * 0.0014), h * 0.012);
    }
    g.fillRect((COTTAGE.x - 0.238) * w, 0.921 * h, w * 0.17, Math.max(1, h * 0.0014));

    const unit = COTTAGE.size * w;
    paintCottage(g, COTTAGE.x * w, COTTAGE.y * h, unit * 0.62);

    paintTree(g, (COTTAGE.x + 0.062) * w, 0.908 * h, unit * 0.62, r);
    paintTree(g, (COTTAGE.x + 0.118) * w, 0.925 * h, unit * 0.82, r);
    paintTree(g, (COTTAGE.x - 0.12) * w, 0.902 * h, unit * 0.48, r);
    paintTree(g, 0.07 * w, 0.92 * h, unit * 0.95, r);
    paintTree(g, 0.15 * w, 0.915 * h, unit * 0.6, r);
    paintTree(g, 0.92 * w, 0.955 * h, unit * 1.05, r);

    // dark scrub along the near edge, so the page ends on shadow without a hard line
    const edge = (x: number) => 0.972 - b(x * 9 + 1, 5) * 0.04 + 0.014;
    const dark = g.createLinearGradient(0, h * 0.945, 0, h);
    dark.addColorStop(0, 'rgba(37, 58, 32, 0.72)');
    dark.addColorStop(0.5, '#1a2818');
    dark.addColorStop(1, '#0d120c');
    ridge(g, w, h, edge, dark);
    for (let i = 0; i < 420; i++) {
        const x = r();
        const y = edge(x) + r() * 0.03 - 0.008;
        g.fillStyle = r() < 0.6 ? 'rgba(26, 42, 25, 0.8)' : 'rgba(45, 67, 38, 0.65)';
        g.beginPath();
        g.ellipse(x * w, y * h, w * (0.001 + r() * 0.004), h * (0.001 + r() * 0.004), 0, 0, Math.PI * 2);
        g.fill();
    }
}

export function paintValley(width: number) {
    const w = width;
    const h = Math.round(width * 0.625);
    const painters: Record<LayerName, (g: Ctx, w: number, h: number) => void> = {
        sky: paintSky,
        clouds: paintClouds,
        far: paintFar,
        mid: paintMid,
        fields: paintFields,
        fore: paintFore,
    };
    return LAYERS.map((name) => {
        const { c, g } = canvas(w, h);
        painters[name](g, w, h);
        return c;
    });
}
