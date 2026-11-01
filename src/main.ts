import './styles/main.css';
import { createBrush } from './cards/brush';
import { createDeck } from './cards/deck';
import { startMail } from './cards/mail';
import { watchOverflow } from './cards/overflow';
import { startPeeks } from './cards/peek';
import { createPile } from './cards/pills';
import { createTyper } from './cards/type';
import { startClock } from './clock';
import { drawCovers } from './covers';
import type { Planes } from './planes';
import { createScroller, clamp, INTRO, PROJECT_STEP, Y_END, Y_WORK } from './scroll';
import { createSound } from './sound';
import { createThemeToggle, currentTheme, type Theme } from './theme';
import { createValley, type Valley } from './valley';
import { onViewportChange } from './viewport';
import { createWork } from './work';

// ===== CONSOLE EASTER EGG =====
console.log(
    "%clooks like you love to poke around,\nwould love to talk — let's connect!",
    'font-family: ui-monospace, SF Mono, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #e0764c; padding: 8px 0;',
);

const root = document.documentElement;
const motion = root.classList.contains('fx');

// ===== LOADER =====
const loader = document.getElementById('loader')!;
const ring = loader.querySelector<HTMLElement>('.loader__ring')!;
const num = loader.querySelector<HTMLElement>('.loader__num')!;

function progress(p: number) {
    num.textContent = `${Math.round(p * 100)}%`;
    ring.style.setProperty('--a', `${p * 360}deg`);
}

function finishLoading() {
    progress(1);
    loader.classList.add('is-done');
    setTimeout(() => loader.remove(), 800);
}

setTimeout(finishLoading, 12000);       // whatever happens, the page is never held behind the loader

// ===== VALLEY =====
function startValley() {
    const canvas = document.getElementById('valley') as HTMLCanvasElement;
    try {
        const valley = createValley(canvas, motion);
        if (valley) root.classList.add('has-valley');
        return valley;
    } catch (error) {
        console.warn('valley disabled:', error);
        return null;
    }
}

function setNight(valley: Valley | null, theme: Theme) {
    if (!valley) return;
    valley.state.night = theme === 'dark' ? 1 : 0;
    valley.render();
}

// ===== THE STILL PAGE (reduced motion): one painted valley behind stacked cards =====
function startStill() {
    const valley = startValley();
    drawCovers();
    startClock();
    startPeeks();
    createThemeToggle((theme) => setNight(valley, theme));
    setNight(valley, currentTheme());
    finishLoading();
}

// ===== THE FLIGHT =====
async function startFlight() {
    progress(0.1);
    await new Promise(requestAnimationFrame);

    const valley = startValley();
    progress(0.4);

    drawCovers();
    startClock();

    const track = document.getElementById('track')!;
    const veil = document.getElementById('veil')!;
    const scroller = createScroller(track, veil);

    let planes: Planes | null = null;
    const deck = createDeck(() => planes !== null);
    const work = createWork();

    // ---- what happens as cards arrive ----
    const typer = createTyper(document.querySelector<HTMLElement>('[data-type]')!);
    deck.onArrive(document.getElementById('about')!, typer.play, typer.finish);

    const pile = createPile(document.querySelector<HTMLElement>('.card__pile')!);
    let measureBoxes = () => {};
    deck.onArrive(document.getElementById('stack')!, () => {
        pile.start();
        measureBoxes();
    }, pile.stop);

    const sound = createSound();
    startPeeks();

    // sends a plane from an element, to another one if given; the page only carries on once it has arrived
    let launching = false;
    const fly = (from: Element, to: Element | null, arrive: () => void) => {
        if (launching) return;
        if (!planes) return arrive();
        launching = true;
        const start = from.getBoundingClientRect();
        const end = to?.getBoundingClientRect();
        sound.flick();
        planes.launch({
            x: start.left + start.width / 2,
            y: start.top + start.height / 2,
            to: end && { x: end.left + end.width / 2, y: end.top + end.height / 2 },
            colour: getComputedStyle(root).getPropertyValue('--butter').trim(),
            arrive: () => {
                launching = false;
                arrive();
            },
        });
    };
    startMail((link, arrive) => fly(link, null, arrive), sound.chirp);

    const brush = createBrush();
    if (brush) document.querySelectorAll<HTMLElement>('.card[data-effect]').forEach(brush.bind);

    // ---- theme ----
    const palette = () => {
        const css = getComputedStyle(root);
        return ['--coral', '--butter', '--sage', '--river', '--paper'].map((name) => css.getPropertyValue(name).trim());
    };
    const repaint = () => {
        deck.refreshColours();
        planes?.setPalette(getComputedStyle(document.querySelector('.card--hero')!).getPropertyValue('--c').trim(), palette());
    };
    createThemeToggle((theme) => {
        setNight(valley, theme);
        repaint();
        sound.click();
    });
    setNight(valley, currentTheme());

    // ---- navigation ----
    const target = (go: string) => {
        if (go === 'home') return 0;
        if (go === 'work') return Y_WORK;
        if (go.startsWith('p')) return Y_WORK + Number(go.slice(1)) * PROJECT_STEP;
        return INTRO + Number(go);
    };
    const name = document.querySelector('.menu__home');
    document.querySelectorAll<HTMLElement>('[data-go]').forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const go = link.dataset.go!;
            if (go === '1' && link.classList.contains('intro__hint')) scroller.glide(INTRO);
            else if (go === 'home' && !link.classList.contains('menu__home')) fly(link, name, () => scroller.jump(0));
            else scroller.jump(target(go));
        });
    });

    // keyboard users: tabbing to something off-screen flies there
    const cards = [...document.querySelectorAll<HTMLElement>('.card')];
    const projects = [...document.querySelectorAll<HTMLElement>('.project')];
    measureBoxes = watchOverflow([...cards, ...projects, document.querySelector<HTMLElement>('.workcta__face')!]);
    document.addEventListener('focusin', (e) => {
        const el = e.target as HTMLElement;
        const card = cards.indexOf(el.closest('.card') as HTMLElement);
        const project = projects.indexOf(el.closest('.project') as HTMLElement);
        const y = scroller.y();
        if (el.closest('.menu')) {
            if (y < Y_WORK) scroller.jump(Y_WORK);
        } else if (card >= 0) {
            if (Math.abs(y - (INTRO + card)) > 0.2) scroller.jump(INTRO + card);
        } else if (project >= 0) {
            const at = Y_WORK + project * PROJECT_STEP;
            if (Math.abs(y - at) > 0.2) scroller.jump(at);
        }
    });

    // phones: a clear sideways swipe flips one card
    let swipeX = 0;
    let swipeY = 0;
    addEventListener('touchstart', (e) => {
        swipeX = e.touches[0].clientX;
        swipeY = e.touches[0].clientY;
    }, { passive: true });
    addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - swipeX;
        const dy = e.changedTouches[0].clientY - swipeY;
        const y = scroller.y();
        if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || y < INTRO || y > Y_WORK) return;
        scroller.glide(clamp(Math.round(y) + (dx < 0 ? 1 : -1), INTRO, Y_WORK));
    }, { passive: true });

    // ---- pointer ----
    const pointer = { x: 0.5, y: 0.5 };
    addEventListener('pointermove', (e) => {
        pointer.x = e.clientX / innerWidth;
        pointer.y = e.clientY / innerHeight;
    }, { passive: true });

    onViewportChange(() => scroller.resize());

    // ---- reload keeps the place, and links can point straight at a card ----
    // the browser's own restore runs before the page has its full length, so it is done by hand
    history.scrollRestoration = 'manual';
    const hash = location.hash.slice(1);
    const linked = cards.findIndex((card) => card.id === hash);
    let saved = 0;
    try {
        saved = Number(sessionStorage.getItem('y')) || 0;
    } catch {
        // storage refused: start from the top
    }
    if (hash === 'work') scroller.place(Y_WORK);
    else if (linked > 0) scroller.place(INTRO + linked);
    else if (saved > 0) scroller.place(Math.min(saved, Y_END));
    addEventListener('pagehide', () => {
        try {
            sessionStorage.setItem('y', String(scroller.y()));
        } catch {
            // nothing to do: the next visit starts from the top
        }
    });

    // ---- the one loop ----
    const intro = document.getElementById('intro')!;
    const hint = intro.querySelector<HTMLElement>('.intro__hint')!;

    let folding = 0;

    function frame(now: number) {
        scroller.raf(now);
        const y = scroller.y();

        const fade = 1 - clamp(y / 0.5);
        intro.style.opacity = String(fade);
        intro.style.visibility = fade > 0 ? 'visible' : 'hidden';
        intro.style.transform = `translateY(${(1 - fade) * -40}px)`;
        hint.style.pointerEvents = fade > 0.5 ? 'auto' : 'none';

        const folds = deck.update(y);
        if (folds.length > folding) sound.flick();
        folding = folds.length;
        work.update(y);
        planes?.update(y, now, folds, pointer);
        pile.tick(now);
        brush?.tick(now);

        if (valley) {
            const t = clamp(y / Y_END);
            valley.state.day = t;
            valley.state.pan = t;
            valley.state.px += (pointer.x - 0.5 - valley.state.px) * 0.05;
            valley.state.py += (pointer.y - 0.5 - valley.state.py) * 0.05;
            valley.tick(now);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // text and valley are up: bring the 3D layer in behind them
    progress(0.65);
    try {
        const { createPlanes } = await import('./planes');
        const radius = parseFloat(getComputedStyle(cards[0]).borderTopLeftRadius);
        planes = createPlanes(document.getElementById('scene') as HTMLCanvasElement, {
            width: deck.cardWidth,
            height: deck.cardHeight,
            radius,
        });
        repaint();
    } catch (error) {
        console.warn('planes disabled:', error);
    }
    if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    deck.resize();
    finishLoading();
}

if (motion) startFlight();
else startStill();
