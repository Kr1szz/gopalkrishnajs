import {
    CatmullRomCurve3, Color, ColorManagement, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
    PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer,
} from 'three';
import { clamp, INTRO, smooth } from '../scroll';
import { createPlaneGeometry, createSheet, SHEET_H, type Sheet } from './fold';
import { createPaper } from './material';

ColorManagement.enabled = false;        // card colours go through as written, or the handover would show

export interface Fold {
    colour: string;
    x: number;          // screen px from the centre, y up
    y: number;
    f: number;          // 0 card-flat … 1 gone
}

export interface Launch {
    x: number;          // where it starts, in client px
    y: number;
    colour: string;
    to?: { x: number; y: number };      // where it lands; without this it leaves over the top of the screen
    arrive: () => void;
}

export interface Planes {
    update(y: number, now: number, folds: Fold[], pointer: { x: number; y: number }): void;
    launch(flight: Launch): void;
    resize(): void;
    setPalette(hero: string, flock: string[]): void;
}

const FOV = 26;
const LAUNCH_MS = 1050;
const LANDING_MS = 1350;
const SHEET_W = 132;
const X = new Vector3();
const Y = new Vector3();
const Z = new Vector3();
const m = new Matrix4();

function basis(nose: Vector3, up: Vector3, out: Quaternion) {
    Y.copy(nose).normalize();
    X.crossVectors(Y, up).normalize();
    Z.crossVectors(X, Y);
    m.makeBasis(X, Y, Z);
    return out.setFromRotationMatrix(m);
}

function seeded(seed: number) {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
}

export function createPlanes(canvas: HTMLCanvasElement, card: { width(): number; height(): number; radius: number }): Planes | null {
    let renderer: WebGLRenderer;
    try {
        renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
        return null;
    }
    renderer.setClearColor(0x000000, 0);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 10, 8000);

    const cell = Math.round(2 * dpr);

    // ---- the sheets: the hero plane, and two more for cards leaving the carousel ----
    function sheetMesh() {
        const sheet = createSheet();
        const mesh = new Mesh(sheet.geometry, createPaper(cell));
        mesh.frustumCulled = false;
        mesh.visible = false;
        scene.add(mesh);
        return { sheet, mesh };
    }
    type Twin = { sheet: Sheet; mesh: Mesh<any, ReturnType<typeof createPaper>> };
    const hero: Twin = sheetMesh();
    const twins: Twin[] = [sheetMesh(), sheetMesh()];
    const courier: Twin = sheetMesh();

    // ---- the flock ----
    const narrow = innerWidth < 700;
    const COUNT = narrow ? 13 : 30;
    const geometry = createPlaneGeometry();
    const random = seeded(90210);
    const phase = new Float32Array(COUNT).map(() => random() * Math.PI * 2);
    const tint = new Float32Array(COUNT * 3);
    geometry.setAttribute('aPhase', new InstancedBufferAttribute(phase, 1));
    geometry.setAttribute('aColor', new InstancedBufferAttribute(tint, 3));
    const flockMaterial = createPaper(cell);
    const flock = new InstancedMesh(geometry, flockMaterial, COUNT);
    flock.instanceMatrix.setUsage(DynamicDrawUsage);
    flock.frustumCulled = false;
    scene.add(flock);

    const birds = Array.from({ length: COUNT }, () => ({
        x: 0, y: 0, z: 0, size: 1,
        tilt: (random() - 0.5) * 0.5,
        roll: 0.5 + random() * 0.5,
        drift: 6 + random() * 12,
        speed: 0.5 + random() * 0.9,
        push: 0,
        scatter: 0.75 + random() * 0.6,
    }));

    let W = 1;
    let H = 1;
    let path: CatmullRomCurve3;

    // Rows across the sky, leaving the name clear
    function placeFlock() {
        const rows = 4;
        const cols = narrow ? 3 : 7;
        const slots: { x: number; y: number }[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = ((c + (r % 2 ? 0.75 : 0.25)) / cols - 0.5) * W * 1.06;
                const y = (0.46 - (r / (rows - 1)) * 0.4) * H;
                slots.push({ x, y });
            }
        }
        const nameHalf = Math.min(W * 0.46, 430);
        const nameTop = H * 0.5 - Math.min(H * 0.1, 80);
        const nameBottom = H * 0.5 - Math.min(H * 0.42, 340);
        const free = slots.filter((p) => !(Math.abs(p.x) < nameHalf && p.y < nameTop && p.y > nameBottom));
        const scatter = seeded(4242);
        birds.forEach((b, i) => {
            const slot = free[i % free.length];
            b.x = slot.x + (scatter() - 0.5) * 60;
            b.y = slot.y + (scatter() - 0.5) * 50;
            b.z = -scatter() * 160;
            b.size = (narrow ? 48 : 62) * (0.8 + scatter() * 0.5);
            if (i >= free.length) b.size = 0;
        });
    }

    function resize() {
        W = innerWidth;
        H = innerHeight;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.position.z = H / 2 / Math.tan((FOV * Math.PI) / 360);
        camera.updateProjectionMatrix();
        placeFlock();

        // one swing out over the valley, round, and back to the middle of the screen
        path = new CatmullRomCurve3([
            new Vector3(-0.2 * W, 0.08 * H, 40),
            new Vector3(0.05 * W, 0.2 * H, 30),
            new Vector3(0.34 * W, 0.12 * H, -90),
            new Vector3(0.3 * W, -0.26 * H, -200),
            new Vector3(-0.1 * W, -0.3 * H, -120),
            new Vector3(-0.36 * W, -0.04 * H, 20),
            new Vector3(-0.14 * W, 0.16 * H, 90),
            new Vector3(0, 0, 60),
        ], false, 'catmullrom', 0.5);
    }

    const nose = new Vector3();
    const up = new Vector3();
    const pathQuat = new Quaternion();
    const FLAT = new Quaternion();
    const flyQuat = basis(new Vector3(-0.8, 0.54, 0.26), new Vector3(0.12, 0.36, 0.92), new Quaternion());

    const size = (mesh: Twin['mesh'], w: number, h: number, scale: number) => {
        mesh.scale.set(w * scale, (h / SHEET_H) * scale, w * scale);
    };

    function flyHero(s: number, now: number) {
        const { mesh, sheet } = hero;
        mesh.visible = s < 0.985;
        if (!mesh.visible) return;
        const w = card.width();
        const h = card.height();
        const u = mesh.material.uniforms;

        const t = 1 - Math.pow(1 - clamp(s / 0.7), 1.7);
        path.getPointAt(t, mesh.position);
        path.getTangentAt(t, nose);

        // idle at the very top: sways in place, and the sway dies off as the flight starts
        const idle = 1 - smooth(0, 0.08, s);
        mesh.position.y += Math.sin(now * 0.0013) * 12 * idle;
        mesh.position.x += Math.sin(now * 0.0009) * 8 * idle;

        // bank into the turns
        const bank = clamp(nose.x * 1.6, -1, 1) * 0.5;
        up.set(bank, 0.28, 0.9);
        basis(nose, up, pathQuat);

        const settle = smooth(0.62, 0.93, s);
        mesh.position.multiplyScalar(1 - settle);
        mesh.quaternion.slerpQuaternions(pathQuat, FLAT, settle);

        size(mesh, w, h, 0.3 + (1 - 0.3) * smooth(0.56, 0.93, s));
        sheet.fold(1 - smooth(0.5, 0.86, s));

        u.uFlat.value = smooth(0.82, 0.95, s);
        u.uRadius.value = card.radius * smooth(0.86, 0.96, s);
        u.uSize.value = [w, h];
    }

    function flyTwin(twin: Twin, fold: Fold) {
        const { mesh, sheet } = twin;
        const w = card.width();
        const h = card.height();
        const u = mesh.material.uniforms;
        const f = fold.f;

        const speed = f * f * f;
        mesh.visible = true;
        mesh.position.set(fold.x - speed * W * 1.25, fold.y + speed * H * 0.95, speed * 180);
        mesh.quaternion.slerpQuaternions(FLAT, flyQuat, smooth(0.2, 0.68, f));
        size(mesh, w, h, 1 - 0.68 * smooth(0, 0.62, f));
        sheet.fold(smooth(0, 0.62, f));

        u.uColor.value.set(fold.colour);
        u.uFlat.value = 1 - smooth(0, 0.16, f);
        u.uRadius.value = card.radius * (1 - smooth(0, 0.12, f));
        u.uSize.value = [w, h];
    }

    // a sheet appears where the click was, folds itself up and goes, nose first along a curve
    const courierQuat = new Quaternion();
    let flight: (Launch & { start: number }) | null = null;

    function flyCourier(now: number) {
        const { mesh, sheet } = courier;
        if (!flight) {
            mesh.visible = false;
            return;
        }
        if (!flight.start) flight.start = now;
        const landing = flight.to;
        const t = clamp((now - flight.start) / (landing ? LANDING_MS : LAUNCH_MS));
        const u = mesh.material.uniforms;

        const fromX = flight.x - W / 2;
        const fromY = H / 2 - flight.y;
        const toX = landing ? landing.x - W / 2 : W * 0.5 + 220;
        const toY = landing ? H / 2 - landing.y : H * 0.5 + 220;

        // landing, it bows out to the side and comes in from below; leaving, it just lifts and accelerates
        const bendX = landing ? toX - 24 : (fromX + toX) / 2;
        const bendY = landing ? fromY + (toY - fromY) * 0.6 : (fromY + toY) / 2 + 160;

        const p = clamp((t - 0.3) / (landing ? 0.6 : 0.7));     // a landing plane gets there early and rests a moment
        const g = landing ? p * p * (3 - 2 * p) : Math.pow(p, 2.4);
        const a = (1 - g) * (1 - g);
        const b = 2 * (1 - g) * g;
        const c = g * g;

        mesh.visible = true;
        mesh.position.set(a * fromX + b * bendX + c * toX, a * fromY + b * bendY + c * toY, 0);     // z 0 is 1:1 with the page

        nose.set((1 - g) * (bendX - fromX) + g * (toX - bendX), (1 - g) * (bendY - fromY) + g * (toY - bendY), 0);
        nose.normalize();
        nose.z = 0.22;
        up.set(0, 0.3, 0.95);
        basis(nose, up, courierQuat);
        mesh.quaternion.slerpQuaternions(FLAT, courierQuat, smooth(0.2, 0.5, t));

        size(mesh, SHEET_W, SHEET_W * SHEET_H, 1 - (landing ? 0.8 : 0.42) * smooth(0.1, 1, t));
        sheet.fold(smooth(0, 0.42, t));

        u.uColor.value.set(flight.colour);
        u.uFlat.value = 1 - smooth(0.04, 0.2, t);
        u.uRadius.value = 0;
        u.uSize.value = [SHEET_W, SHEET_W * SHEET_H];

        if (t >= 1) {
            const done = flight.arrive;
            flight = null;
            mesh.visible = false;
            done();
        }
    }

    const pos = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3();

    function moveFlock(s: number, now: number, pointer: { x: number; y: number }) {
        const gone = smooth(0, 0.34, s);
        flock.visible = gone < 1;
        if (!flock.visible) return;
        const t = now * 0.001;
        flockMaterial.uniforms.uTime.value = t;

        const cx = (pointer.x - 0.5) * W;
        const cy = (0.5 - pointer.y) * H;

        birds.forEach((b, i) => {
            const bob = Math.sin(t * b.speed + phase[i]);
            const away = gone * gone * b.scatter;
            pos.set(
                b.x + Math.cos(t * b.speed * 0.6 + phase[i]) * b.drift + away * W * 1.5,
                b.y + bob * b.drift + away * H * 0.7,
                b.z,
            );

            // shy of the cursor
            const dx = pos.x - cx;
            const dy = pos.y - cy;
            const near = Math.max(0, 1 - Math.hypot(dx, dy) / 200);
            b.push += (near - b.push) * 0.08;
            const len = Math.hypot(dx, dy) || 1;
            pos.x += (dx / len) * b.push * 60;
            pos.y += (dy / len) * b.push * 60;

            nose.set(1, 0.14 + bob * 0.07 + b.tilt * 0.6 + away * 0.4 + b.push * 0.5, 0.08);
            up.set(0, -Math.sin(b.roll), Math.cos(b.roll));
            basis(nose, up, quat);
            scale.setScalar(b.size);
            m.compose(pos, quat, scale);
            flock.setMatrixAt(i, m);
        });
        flock.instanceMatrix.needsUpdate = true;
    }

    addEventListener('resize', resize);
    resize();

    let idle = false;

    return {
        resize,
        launch(next) {
            flight = { ...next, start: 0 };
        },
        setPalette(heroColour, colours) {
            hero.mesh.material.uniforms.uColor.value.set(heroColour);
            const pick = seeded(777);
            const c = new Color();
            for (let i = 0; i < COUNT; i++) {
                c.set(colours[Math.floor(pick() * colours.length)]);
                tint.set([c.r, c.g, c.b], i * 3);
            }
            geometry.getAttribute('aColor').needsUpdate = true;
        },
        update(y, now, folds, pointer) {
            const s = clamp(y / INTRO);
            flyHero(s, now);
            moveFlock(s, now, pointer);
            twins.forEach((twin, i) => {
                if (folds[i]) flyTwin(twin, folds[i]);
                else twin.mesh.visible = false;
            });

            flyCourier(now);

            const active = hero.mesh.visible || flock.visible || folds.length > 0 || courier.mesh.visible;
            if (active || !idle) renderer.render(scene, camera);
            idle = !active;
        },
    };
}
