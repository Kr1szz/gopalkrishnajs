import Lenis from 'lenis';

// Everything is measured in screen heights scrolled (y). The plane flies during the first INTRO screens, then each card
// takes one screen, the Work card docks as the menu, and the projects fly past.
export const INTRO = 2;
export const CARDS = 8;
export const Y_WORK_CTA = INTRO + CARDS - 1;
export const Y_WORK = Y_WORK_CTA + 1;
export const PROJECTS = 8;      // seven projects and the closing card
export const PROJECT_STEP = 1.1;
export const Y_END = Y_WORK + (PROJECTS - 1) * PROJECT_STEP;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (a: number, b: number, v: number) => {
    const t = clamp((v - a) / (b - a));
    return t * t * (3 - 2 * t);
};

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

const params = new URLSearchParams(location.search);
const debug = params.has('debug');

function pinned() {
    if (!debug) return null;
    if (params.has('y')) return Number(params.get('y'));
    if (params.has('s')) return Number(params.get('s')) * INTRO;
    if (params.has('c')) return INTRO + Number(params.get('c'));
    if (params.has('w')) return Y_WORK + Number(params.get('w')) * PROJECT_STEP;
    return null;
}

export interface Scroller {
    y(): number;
    raf(now: number): void;
    glide(to: number): void;
    jump(to: number): void;
    place(to: number): void;
    resize(): void;
}

const STOPS = [0, ...Array.from({ length: CARDS }, (_, i) => INTRO + i), ...Array.from({ length: PROJECTS }, (_, i) => Y_WORK + i * PROJECT_STEP)];

export function createScroller(track: HTMLElement, veil: HTMLElement): Scroller {
    // A resting card with more to show takes the wheel first (false leaves the event to the browser). At its end Lenis
    // takes over again in the same gesture, which handing the element to the browser outright wouldn't do.
    const lenis = new Lenis({
        lerp: 0.1,
        smoothWheel: true,
        virtualScroll: ({ deltaY, event }) => {
            if (pin !== null) return true;
            const box = (event.target as Element | null)?.closest?.<HTMLElement>('.can-scroll');
            if (!box) return true;
            const here = y();
            if (STOPS.every((stop) => Math.abs(stop - here) > 0.03)) return true;
            const room = deltaY > 0 ? box.scrollHeight - box.clientHeight - box.scrollTop : box.scrollTop;
            return room <= 1;
        },
    });
    const pin = pinned();

    let height = innerHeight;
    let lastWidth = innerWidth;
    let lastMove = performance.now();
    let held = false;
    let gliding = false;
    let settled = true;

    function resize() {
        // phones change height as the address bar slides; only a real resize may re-measure the flight
        if (innerWidth === lastWidth && Math.abs(innerHeight - height) < 120) return;
        lastWidth = innerWidth;
        height = innerHeight;
        track.style.height = `${(Y_END + 1) * height}px`;
        lenis.resize();
    }

    height = innerHeight;
    track.style.height = `${(Y_END + 1) * height}px`;
    lenis.resize();

    addEventListener('pointerdown', () => (held = true), { passive: true });
    addEventListener('pointerup', () => (held = false), { passive: true });
    addEventListener('pointercancel', () => (held = false), { passive: true });
    lenis.on('scroll', () => {
        lastMove = performance.now();
        settled = false;
    });

    function glide(to: number) {
        gliding = true;
        lenis.scrollTo(to * height, {
            duration: Math.min(1.6, 0.7 + Math.abs(to - y()) * 0.3),
            easing: ease,
            lock: false,
            onComplete: () => {
                gliding = false;
                lastMove = performance.now();
            },
        });
    }

    // far destinations: fade out and reappear, rather than rewinding the whole flight
    function jump(to: number) {
        if (Math.abs(to - y()) <= 1.5) return glide(to);
        veil.style.transition = 'opacity 0.25s';
        veil.style.opacity = '1';
        setTimeout(() => {
            lenis.scrollTo(to * height, { immediate: true, force: true });
            veil.style.opacity = '0';
        }, 260);
    }

    function y() {
        return pin ?? lenis.scroll / height;
    }

    // the page can't rest between two states: shortly after it stops, it finishes the change
    function magnet(now: number) {
        if (pin !== null || settled || gliding || held || now - lastMove < 170) return;
        settled = true;
        const here = y();
        if (here <= 0 || here >= Y_END) return;
        if (here < INTRO) return glide(here < 0.3 ? 0 : INTRO);
        const stop = STOPS.reduce((a, b) => (Math.abs(b - here) < Math.abs(a - here) ? b : a));
        if (Math.abs(stop - here) > 0.004) glide(stop);
    }

    return {
        y,
        raf(now) {
            lenis.raf(now);
            magnet(now);
        },
        glide,
        jump,
        place(to) {
            lenis.scrollTo(to * height, { immediate: true, force: true });
        },
        resize,
    };
}
