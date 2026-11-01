// Project covers. There are no screenshots to show, so each project gets a small dithered picture of what it does:
// a function from a point on the cover to a tone, pushed through an ordered dither onto a four-colour ramp.

type Tone = (u: number, v: number) => number;

const BAYER = [
    0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function rand(x: number, y: number) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

const blob = (u: number, v: number, x: number, y: number, r: number) => Math.exp(-((u - x) ** 2 + (v - y) ** 2) / (r * r));
const ring = (d: number, at: number, width: number) => Math.max(0, 1 - Math.abs(d - at) / width);

const heatmap: Tone = (u, v) => {
    let t = 0.08;
    const routes: [number, number, number, number][] = [[0.05, 0.75, 0.95, 0.2], [0.1, 0.2, 0.9, 0.8], [0, 0.45, 1, 0.5]];
    for (const [a, b, c, d] of routes) {
        const k = (u - a) / (c - a);
        const yy = b + (d - b) * k + Math.sin(k * 3.1) * -0.1;
        t += Math.exp(-((v - yy) ** 2) / 0.0016) * (0.3 + 0.2 * Math.sin(u * 30));
    }
    t += blob(u, v, 0.34, 0.42, 0.13) * 0.85 + blob(u, v, 0.68, 0.58, 0.16) * 0.7 + blob(u, v, 0.8, 0.3, 0.07) * 0.6;
    return t;
};

const shield: Tone = (u, v) => {
    const x = Math.abs(u - 0.5) * 1.5;
    const y = v - 0.14;
    const edge = y < 0.34 ? 0.34 : 0.34 * (1 - ((y - 0.34) / 0.56) ** 1.5);
    const inside = y > 0 && x < edge;
    const bands = Math.sin((x - y) * 34) * 0.5 + 0.5;
    if (!inside) return 0.1 + bands * 0.08;
    return x > edge - 0.035 || y < 0.035 ? 0.98 : 0.42 + bands * 0.26;
};

const radar: Tone = (u, v) => {
    const dx = u - 0.5;
    const dy = (v - 0.5) * 0.8;
    const d = Math.hypot(dx, dy);
    let t = 0.1;
    for (const at of [0.14, 0.27, 0.4]) t += ring(d, at, 0.012) * 0.55;
    const sweep = ((Math.atan2(dy, dx) + Math.PI * 1.3) % (Math.PI * 2)) / (Math.PI * 2);
    if (d < 0.42) t += sweep ** 3 * 0.6;
    t += blob(u, v, 0.62, 0.36, 0.022) + blob(u, v, 0.34, 0.62, 0.02) + blob(u, v, 0.7, 0.66, 0.016);
    return t;
};

const receipt: Tone = (u, v) => {
    const x = (u - 0.5) * 2.4;
    const teeth = Math.abs(((u * 26) % 2) - 1) * 0.022;
    if (Math.abs(x) > 0.62 || v < 0.1 - teeth || v > 0.9 + teeth) return 0.14 + rand(Math.floor(u * 30), Math.floor(v * 30)) * 0.06;
    const line = Math.floor(v * 15);
    const on = (v * 15) % 1 < 0.42 && line > 2 && line < 13;
    const left = u < 0.5 + (rand(line, 3) - 0.5) * 0.14;
    const price = u > 0.66;
    if (on && (left || price)) return line === 11 ? 0.04 : 0.34;
    return 0.96;
};

const onion: Tone = (u, v) => {
    const dx = (u - 0.5) * 1.3;
    const dy = v - 0.54;
    const shape = Math.hypot(dx * (1 + dy * 0.9), dy);
    let t = 0.12;
    if (shape < 0.38) t = 0.3 + Math.cos(shape * 46) * 0.22 + (0.38 - shape);
    t += Math.exp(-(dx * dx) / 0.0009) * Math.max(0, 0.16 - v) * 6;
    return t;
};

const book: Tone = (u, v) => {
    const mid = 0.5;
    const n = 15;
    const i = Math.floor(u * n);
    const dist = Math.abs(i + 0.5 - n * mid) / n;
    const depth = 0.14 + dist * dist * 3.1 * (0.8 + rand(i, 1) * 0.4);
    const top = Math.max(0.05, 1 - depth);      // the bars stand on the bottom edge of the cover
    const inBar = (u * n) % 1 > 0.14 && v > top;
    if (!inBar) return 0.08;
    return u < mid ? 0.5 : 0.92;
};

const crop: Tone = (u, v) => {
    const cx = Math.floor(u * 7 + Math.sin(v * 6) * 0.6);
    const cy = Math.floor(v * 6 + Math.sin(u * 5) * 0.4);
    let t = 0.3 + rand(cx, cy) * 0.36;
    t += (rand(Math.floor(u * 90), Math.floor(v * 90)) - 0.5) * 0.08;
    t += blob(u, v, 0.66, 0.34, 0.1) * 0.7 + blob(u, v, 0.28, 0.7, 0.07) * 0.6;
    return t;
};

const COVERS: Record<string, { tone: Tone; ramp: string[] }> = {
    heatmap: { tone: heatmap, ramp: ['#1b2238', '#7a3f6d', '#f0946a', '#f6d860'] },
    shield: { tone: shield, ramp: ['#23261c', '#3f5a2e', '#a9c183', '#fbf6ea'] },
    radar: { tone: radar, ramp: ['#10231f', '#1f5147', '#5fb39a', '#e6f6c8'] },
    receipt: { tone: receipt, ramp: ['#3d2a55', '#8c4a5e', '#f0c9a0', '#fffaf0'] },
    onion: { tone: onion, ramp: ['#1c1830', '#4b3a7c', '#a08bd6', '#f4eefb'] },
    book: { tone: book, ramp: ['#14181f', '#2f5266', '#7fc0a4', '#f0946a'] },
    crop: { tone: crop, ramp: ['#23351f', '#4f7a30', '#a9c04c', '#f0946a'] },
};

export function drawCovers() {
    document.querySelectorAll<HTMLElement>('.project[data-cover]').forEach((project) => {
        const canvas = project.querySelector<HTMLCanvasElement>('.project__cover');
        const cover = COVERS[project.dataset.cover ?? ''];
        if (!canvas || !cover) return;

        const W = 200;
        const H = 190;
        canvas.width = W;
        canvas.height = H;
        const g = canvas.getContext('2d')!;
        const image = g.createImageData(W, H);
        const ramp = cover.ramp.map(hex);
        for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
                const t = Math.min(0.999, Math.max(0, cover.tone(x / W, y / H))) * (ramp.length - 1);
                const threshold = BAYER[(y % 8) * 8 + (x % 8)];
                const step = Math.floor(t);
                const c = ramp[Math.min(ramp.length - 1, step + (t - step > threshold ? 1 : 0))];
                image.data.set([c[0], c[1], c[2], 255], (y * W + x) * 4);
            }
        }
        g.putImageData(image, 0, 0);
    });
}
