import { clamp, INTRO, smooth, Y_WORK_CTA } from '../scroll';
import type { Fold } from '../planes';
import { onViewportChange, viewportHeight } from '../viewport';

// The carousel: cards come in from the right, step into a slot on the left, then fold into planes and fly away.
// The last card, Work, stays: it grows, shrinks and docks at the top as the menu.

const FOLD_RANGE = 0.62;    // in cards of scrolling
const TEXT_OUT = 0.12;      // a resting card keeps its text; it fades in this stretch past the slot, before the fold
const LAND_AT = 0.982;      // the hero card appears as the 3D sheet lands on it
const BAR_H = 56;

export interface Deck {
    update(y: number): Fold[];
    resize(): void;
    refreshColours(): void;
    cardWidth(): number;
    cardHeight(): number;
    onArrive(card: HTMLElement, fn: () => void, leave?: () => void): void;
}

export function createDeck(hasPlanes: () => boolean): Deck {
    const cards = [...document.querySelectorAll<HTMLElement>('.card')];
    const work = cards[cards.length - 1];
    const menu = document.getElementById('menu')!;
    const burger = menu.querySelector<HTMLButtonElement>('.menu__burger')!;

    const state = cards.map(() => ({ in: false, rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0, key: '' }));
    const hooks = new Map<HTMLElement, { arrive: () => void; leave?: () => void }>();

    let colours = cards.map(() => '#ffffff');
    let cw = 372;
    let ch = 544;
    let step = 400;
    let wide = true;
    let current = 0;
    let vw = innerWidth;
    let vh = viewportHeight();
    let notes = 0;

    function resize() {
        vw = innerWidth;
        vh = viewportHeight();
        notes = corners.offsetWidth;
        cw = cards[0].offsetWidth;
        ch = cards[0].offsetHeight;
        wide = vw >= 1000;
        step = cw + 28;
        const bar = barWidth();
        menu.classList.toggle('is-compact', bar < 720);
    }

    function refreshColours() {
        colours = cards.map((card) => getComputedStyle(card).getPropertyValue('--c').trim());
    }

    // the corner notes keep the top right on wider screens; on phones they are at the bottom
    const corners = document.getElementById('corners')!;
    const reserved = () => (vw >= 700 ? notes + 32 : 16);
    const barWidth = () => Math.min(780, vw - reserved() - 16);

    // ---- hover: the card leans towards the cursor on springs ----
    cards.forEach((card, i) => {
        card.addEventListener('pointermove', (e) => {
            if (i !== current || e.pointerType === 'touch') return;
            const rect = card.getBoundingClientRect();
            state[i].tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            state[i].ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        });
        card.addEventListener('pointerleave', () => {
            state[i].tx = 0;
            state[i].ty = 0;
        });
        // phones: a tap tips the card towards the finger for a moment
        card.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || i !== current) return;
            const rect = card.getBoundingClientRect();
            state[i].vx -= ((e.clientY - rect.top) / rect.height - 0.5) * 0.8;
            state[i].vy += ((e.clientX - rect.left) / rect.width - 0.5) * 0.8;
        }, { passive: true });
    });

    function spring(i: number) {
        const t = state[i];
        const K = 0.09;
        const D = 0.78;
        t.vx = (t.vx + (-t.ty * 7 - t.rx) * K) * D;
        t.vy = (t.vy + (t.tx * 7 - t.ry) * K) * D;
        t.rx += t.vx;
        t.ry += t.vy;
    }

    function arrive(i: number, on: boolean) {
        if (state[i].in === on) return;
        state[i].in = on;
        cards[i].classList.toggle('is-in', on);
        const hook = hooks.get(cards[i]);
        if (on) hook?.arrive();
        else {
            hook?.leave?.();
            cards[i].scrollTop = 0;
        }
    }

    function setCompactOpen(open: boolean) {
        menu.classList.toggle('is-open', open);
        work.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
    }

    burger.addEventListener('click', () => setCompactOpen(!menu.classList.contains('is-open')));
    menu.querySelectorAll<HTMLElement>('a:not(.menu__home)').forEach((a, i) => {
        a.style.setProperty('--i', String(i));
        a.addEventListener('click', () => setCompactOpen(false));
    });

    function dock(y: number, wasDocked: boolean) {
        const p = clamp(y - Y_WORK_CTA);
        const grow = smooth(0, 0.34, p);
        const shrink = smooth(0.26, 1, p);
        const bar = barWidth();

        const big = 1 + grow * 0.12;
        const w = (cw * big) * (1 - shrink) + bar * shrink;
        const h = (ch * big) * (1 - shrink) + BAR_H * shrink;

        // stays centred, unless the corner notes need the room
        const dockX = (vw + bar) / 2 > vw - reserved() ? 16 + bar / 2 - vw / 2 : 0;
        const dockY = -vh / 2 + 16 + BAR_H / 2;

        work.style.width = `${w}px`;
        work.style.height = `${h}px`;
        work.style.borderRadius = `${26 - 8 * shrink}px`;
        work.style.background = `color-mix(in srgb, var(--c) ${(1 - smooth(0.5, 1, p)) * 100}%, var(--glass))`;

        const face = work.querySelector<HTMLElement>('.workcta__face')!;
        face.style.opacity = String(1 - smooth(0.02, 0.3, p));
        face.style.pointerEvents = p > 0.3 ? 'none' : '';
        face.style.display = p >= 0.32 ? 'none' : '';

        const docked = p >= 0.98;
        work.style.setProperty('--menu', String(smooth(0.72, 1, p)));
        menu.style.pointerEvents = docked ? 'auto' : 'none';
        if (docked !== wasDocked) {
            work.classList.toggle('is-docked', docked);
            if (!docked) setCompactOpen(false);
        }
        return { x: dockX * shrink, y: dockY * shrink, docked };
    }

    let wasDocked = false;

    function update(y: number): Fold[] {
        const s = clamp(y / INTRO);
        const c = y - INTRO;
        const slot = wide ? -1 : -0.1;
        const landed = s >= LAND_AT;
        const folds: Fold[] = [];
        const pull = 1 - smooth(0.86, 1, s);

        current = Math.round(Math.max(0, c));

        cards.forEach((card, i) => {
            const d = i - c;
            const isWork = card === work;
            const t = state[i];
            spring(i);

            let x = d * step + (i > 0 ? pull * vw * 0.7 : 0);
            let cy = 0;
            let opacity = 1;

            if (i === 0 && !landed) {
                // without the 3D layer the hero card just fades in over the same stretch
                opacity = hasPlanes() ? 0 : smooth(0.7, 0.96, s);
            }
            if (s < 0.8 && i > 0) opacity = 0;

            if (isWork) {
                const placed = dock(y, wasDocked);
                wasDocked = placed.docked;
                if (y >= Y_WORK_CTA) {
                    x = placed.x;
                    cy = placed.y;
                }
            } else if (d < slot - TEXT_OUT) {
                const f = (slot - TEXT_OUT - d) / FOLD_RANGE;
                x = (slot - TEXT_OUT) * step;
                opacity = 0;
                if (f < 1) {
                    if (hasPlanes()) folds.push({ colour: colours[i], x, y: 0, f });
                }
            }

            // the text leaves first, so that what folds is plain paper
            const o = isWork ? 1 : smooth(slot - TEXT_OUT, slot - 0.02, d);

            // flown off first: a card past the slot keeps its last x, so it would still look on-screen
            const onScreen = Math.abs(x) - cw / 2 < vw / 2 - 40;
            if (!isWork && d < slot - TEXT_OUT - FOLD_RANGE) arrive(i, false);
            else if (i === 0 ? landed || opacity > 0.4 : onScreen && d < 1.5 && s > 0.9) arrive(i, true);
            else if (d > 1.6 || (i === 0 && !landed && opacity <= 0.4)) arrive(i, false);

            // only touch the DOM for what changed: at rest, or off screen, a card costs nothing
            const key = `${x.toFixed(1)}|${cy.toFixed(1)}|${opacity.toFixed(3)}|${o.toFixed(3)}|${t.rx.toFixed(2)}|${t.ry.toFixed(2)}`;
            if (key === t.key) return;
            t.key = key;
            card.style.setProperty('--o', String(o));
            card.style.opacity = String(opacity);
            // not visibility: hidden, or keyboard users could never tab to the cards that aren't on screen yet
            card.style.pointerEvents = opacity > 0 ? 'auto' : 'none';
            card.classList.toggle('is-off', opacity === 0);
            card.style.transform = `translate3d(${x}px, ${cy}px, 0) translate(-50%, -50%) perspective(900px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`;
        });

        return folds;
    }

    resize();
    refreshColours();
    onViewportChange(resize);

    return {
        update,
        resize,
        refreshColours,
        cardWidth: () => cw,
        cardHeight: () => ch,
        onArrive(card, fn, leave) {
            hooks.set(card, { arrive: fn, leave });
        },
    };
}
