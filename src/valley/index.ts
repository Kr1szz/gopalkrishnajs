import { COTTAGE, LAYERS, paintValley } from './paint';
import { onViewportChange, viewportHeight } from '../viewport';
import { FRAG, VERT } from './shader';

const CELL = 2;             // CSS px per dot
const TICK = 1000 / 12;     // clouds, water and smoke step at 12 fps
const FOCUS_X = 0.41;       // the part of the art a narrow screen keeps: the cottage and the river bend
const OVERSCAN = 1.12;      // spare art around the edges, for parallax

export interface Valley {
    state: { day: number; night: number; px: number; py: number; pan: number };
    render(): void;
    tick(now: number): void;
    resize(): void;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? 'shader failed');
    }
    return shader;
}

export function createValley(canvas: HTMLCanvasElement, animate: boolean): Valley | null {
    const gl = canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        preserveDrawingBuffer: true,
        powerPreference: 'low-power',
    });
    if (!gl) return null;

    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
    gl.useProgram(program);

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);

    // phones get a smaller painting: it ends up a few hundred dots wide on them anyway
    const artWidth = innerWidth < 700 ? 1000 : 1400;
    const layers = paintValley(artWidth);
    const names = ['uSky', 'uClouds', 'uFar', 'uMid', 'uFields', 'uFore'];
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    layers.forEach((layer, i) => {
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // the clouds drift, so they wrap
        const wrap = LAYERS[i] === 'clouds' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
        gl.uniform1i(u(names[i]), i);
    });
    gl.uniform3f(u('uCottage'), COTTAGE.x, COTTAGE.y, COTTAGE.size);

    const uni = {
        cells: u('uCells'), origin: u('uOrigin'), span: u('uSpan'), pan: u('uPan'), look: u('uLook'),
        time: u('uTime'), day: u('uDay'), night: u('uNight'), cloudX: u('uCloudX'),
    };

    const state = { day: 0, night: 0, px: 0, py: 0, pan: 0 };
    const view = { spanX: 1, spanY: 1, originX: 0, originY: 0, spare: 0 };
    let time = 0;
    let dirty = true;
    let last = 0;
    let seen = '';

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const step = Math.max(1, Math.round(CELL * dpr));     // whole device pixels, so the dots stay even
        const cols = Math.ceil((innerWidth * dpr) / step);
        const rows = Math.ceil((viewportHeight() * dpr) / step);
        canvas.width = cols;
        canvas.height = rows;
        canvas.style.width = `${(cols * step) / dpr}px`;
        canvas.style.height = `${(rows * step) / dpr}px`;
        gl!.viewport(0, 0, cols, rows);

        // cover the screen, anchored to the bottom: wide screens lose sky, narrow ones the sides
        const artAspect = 1.6;
        const aspect = cols / rows;
        const spanY = (aspect > artAspect ? artAspect / aspect : 1) / OVERSCAN;
        const spanX = (aspect > artAspect ? 1 : aspect / artAspect) / OVERSCAN;
        view.spanX = spanX;
        view.spanY = spanY;
        view.originX = Math.max(0, Math.min(1 - spanX, FOCUS_X - spanX / 2));
        view.originY = 1 - spanY;
        view.spare = Math.min(view.originX, 1 - spanX - view.originX);

        gl!.uniform2f(uni.cells, cols, rows);
        gl!.uniform2f(uni.origin, view.originX, view.originY);
        gl!.uniform2f(uni.span, spanX, spanY);
        dirty = true;
    }

    function render() {
        // the travel is limited by the art left over on the tightest side
        const travel = Math.min(view.spare * 0.7, 0.2);
        const pan = (state.pan - 0.5) * 2 * travel;
        gl!.uniform3f(uni.pan, pan * 0.5, pan * 0.75, pan);
        gl!.uniform2f(uni.look, state.px * 0.012, state.py * 0.012);
        gl!.uniform1f(uni.time, time);
        gl!.uniform1f(uni.day, state.day);
        gl!.uniform1f(uni.night, state.night);
        gl!.uniform1f(uni.cloudX, time * 0.0035);
        gl!.drawArrays(gl!.TRIANGLES, 0, 3);
        dirty = false;
    }

    function tick(now: number) {
        // skip the draw when nothing moved; the clock alone only redraws at 12 fps
        const key = `${state.day.toFixed(4)}|${state.night.toFixed(3)}|${state.px.toFixed(3)}|${state.py.toFixed(3)}|${state.pan.toFixed(4)}`;
        if (key !== seen) {
            seen = key;
            dirty = true;
        }
        if (animate && now - last >= TICK) {
            time = now / 1000;
            last = now;
            dirty = true;
        }
        if (dirty) render();
    }

    onViewportChange(resize);
    resize();
    render();
    return { state, render, tick, resize };
}
