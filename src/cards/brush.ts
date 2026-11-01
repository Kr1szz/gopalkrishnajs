// The cursor paints a soft trail over a card, and inside the trail the card's surface is redrawn in that card's style:
// dither, halftone dots or ASCII. One small WebGL canvas moves into whichever card is hovered, behind its text.

const VERT = /* glsl */ `#version 300 es
in vec2 p;
out vec2 vUv;
void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uMask, uGlyphs;
uniform vec3 uInk, uCard;
uniform float uMode, uTime, uScale;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 valley(float t) {
    vec3 a = vec3(0.94, 0.58, 0.42), b = vec3(0.96, 0.85, 0.38), c = vec3(0.42, 0.66, 0.62);
    t = fract(t) * 3.0;
    return t < 1.0 ? mix(a, b, t) : t < 2.0 ? mix(b, c, t - 1.0) : mix(c, a, t - 2.0);
}

void main() {
    vec2 px = gl_FragCoord.xy / uScale;
    float mask = texture(uMask, vUv).r;
    vec4 colour = vec4(0.0);

    if (uMode < 0.5) {
        // dither: ink dots in a Bayer pattern, thinning at the edge of the trail
        vec2 c = floor(px / 3.0);
        float b = bayer4(c);
        float on = step(b + (hash(c) - 0.5) * 0.25, mask * 1.05) * step(0.5, mod(c.x + c.y, 2.0) + mask);
        colour = vec4(uInk, 1.0) * on;
    } else if (uMode < 1.5) {
        // holo dots: beads that swell with the trail, their colour sweeping over the card
        vec2 c = floor(px / 10.0);
        vec2 f = fract(px / 10.0) - 0.5;
        float r = 0.46 * smoothstep(0.08, 0.8, mask) * (0.7 + 0.3 * sin(uTime * 2.0 + hash(c) * 6.3));
        float on = 1.0 - smoothstep(r - 0.06, r, length(f));
        colour = vec4(mix(uCard, valley(hash(c) * 0.3 + (c.x + c.y) * 0.02 + uTime * 0.1), 0.5), 1.0) * on;
    } else {
        // ASCII: tiles of glyphs, denser where the brush has been
        vec2 c = floor(px / vec2(8.0, 13.0));
        vec2 f = fract(px / vec2(8.0, 13.0));
        float level = floor(clamp(mask + (hash(c) - 0.5) * 0.3, 0.0, 0.999) * 8.0);
        float glyph = texture(uGlyphs, vec2((level + f.x) / 8.0, 1.0 - f.y)).r;
        colour = vec4(uInk, 1.0) * glyph * step(0.12, mask + hash(c) * 0.1);
    }
    outColor = colour;
}
`;

const MODES: Record<string, number> = { dither: 0, dots: 1, ascii: 2 };
const FADE = 0.035;
const INK = 0.26;
const MASK_W = 64;
const MASK_H = 92;

function glyphAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = 8 * 16;
    canvas.height = 26;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#fff';
    g.font = '700 20px monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    ' .:-=+*#'.split('').forEach((ch, i) => g.fillText(ch, 8 + i * 16, 13));
    return canvas;
}

export function createBrush() {
    if (!matchMedia('(pointer: fine)').matches) return null;

    const canvas = document.createElement('canvas');
    canvas.className = 'card__fx';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;

    const shader = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

    const texture = (unit: number, name: string) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(program, name), unit);
    };
    texture(1, 'uGlyphs');
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glyphAtlas());
    texture(0, 'uMask');

    const u = {
        mode: gl.getUniformLocation(program, 'uMode'),
        ink: gl.getUniformLocation(program, 'uInk'),
        card: gl.getUniformLocation(program, 'uCard'),
        time: gl.getUniformLocation(program, 'uTime'),
        scale: gl.getUniformLocation(program, 'uScale'),
    };

    const mask = document.createElement('canvas');
    mask.width = MASK_W;
    mask.height = MASK_H;
    const m = mask.getContext('2d')!;

    let host: HTMLElement | null = null;
    let live = 0;       // frames left before the trail has fully faded
    let px = -1;
    let py = -1;

    const rgb = (value: string) => {
        m.fillStyle = value;        // the canvas turns any CSS colour into #rrggbb
        const hex = m.fillStyle;
        return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    };

    function attach(card: HTMLElement) {
        if (host === card) return;
        host = card;
        m.globalCompositeOperation = 'source-over';
        m.fillStyle = '#000';
        m.fillRect(0, 0, MASK_W, MASK_H);
        card.prepend(canvas);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = card.offsetWidth * dpr;
        canvas.height = card.offsetHeight * dpr;
        gl!.viewport(0, 0, canvas.width, canvas.height);
        gl!.uniform1f(u.mode, MODES[card.dataset.effect ?? 'dither'] ?? 0);
        // the trail is tone on tone, a step from the card towards its text, so the text always stays on top of it
        const style = getComputedStyle(card);
        const paper = rgb(style.getPropertyValue('--c').trim());
        const text = rgb(style.color);
        gl!.uniform3f(u.card, paper[0], paper[1], paper[2]);
        gl!.uniform3f(u.ink, ...(paper.map((c, i) => c + (text[i] - c) * INK) as [number, number, number]));
        gl!.uniform1f(u.scale, dpr);
    }

    function paint(card: HTMLElement, e: PointerEvent) {
        attach(card);
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * MASK_W;
        const y = ((e.clientY - rect.top) / rect.height) * MASK_H;
        const steps = px < 0 ? 1 : Math.min(8, Math.ceil(Math.hypot(x - px, y - py) / 3));
        m.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= steps; i++) {
            const q = px < 0 ? 1 : i / steps;
            const cx = px < 0 ? x : px + (x - px) * q;
            const cy = px < 0 ? y : py + (y - py) * q;
            const spot = m.createRadialGradient(cx, cy, 0, cx, cy, 13);
            spot.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
            spot.addColorStop(1, 'rgba(255, 255, 255, 0)');
            m.fillStyle = spot;
            m.fillRect(cx - 13, cy - 13, 26, 26);
        }
        px = x;
        py = y;
        live = 150;
    }

    return {
        bind(card: HTMLElement) {
            card.addEventListener('pointermove', (e) => paint(card, e));
            card.addEventListener('pointerleave', () => {
                px = -1;
                py = -1;
            });
        },
        tick(now: number) {
            if (!host || live <= 0) return;
            live--;
            canvas.style.transform = `translateY(${host.scrollTop}px)`;     // stays over the card while its text scrolls
            m.globalCompositeOperation = 'source-over';
            m.fillStyle = `rgba(0, 0, 0, ${FADE})`;
            m.fillRect(0, 0, MASK_W, MASK_H);
            gl!.activeTexture(gl!.TEXTURE0);
            gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, mask);
            gl!.uniform1f(u.time, now / 1000);
            gl!.clearColor(0, 0, 0, 0);
            gl!.clear(gl!.COLOR_BUFFER_BIT);
            gl!.drawArrays(gl!.TRIANGLES, 0, 3);
            if (live <= 0) {
                canvas.remove();
                host = null;
            }
        },
    };
}
