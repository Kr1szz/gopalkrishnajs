import { clamp, PROJECT_STEP, smooth, Y_WORK } from './scroll';
import { isTouch, onViewportChange } from './viewport';

// After the menu has docked, the projects hang in the air in a line and the page flies through them.
// Phones take a shorter flight with fewer cards in the air: big layers near the camera are what drop frames there.

export function createWork() {
    const projects = [...document.querySelectorAll<HTMLElement>('.project')];
    const touch = isTouch();
    const depth = touch ? 260 : 620;
    const pass = touch ? 220 : 760;
    const fadeFrom = touch ? 0.5 : 1.2;
    const fadeTo = touch ? 1.1 : 2.6;
    const keys = projects.map(() => '');

    let vw = innerWidth;
    onViewportChange(() => (vw = innerWidth));

    function update(y: number) {
        const w = (y - Y_WORK) / PROJECT_STEP;
        projects.forEach((el, i) => {
            const e = i - w;
            // ahead of us they swing out to the sides; passing, they come straight at the camera
            const side = Math.sin(i * 2.4 + 0.6);
            const lift = Math.cos(i * 1.7);
            const far = Math.max(0, e);
            const x = touch ? 0 : side * far * Math.min(240, vw * 0.2);
            const py = touch ? far * 18 : lift * far * 70 + far * 24;
            const z = e > 0 ? -e * depth : -e * pass;

            const opacity = e > 0
                ? 1 - smooth(fadeFrom, fadeTo, e)
                : 1 - smooth(0.02, 0.55, -e);
            const opened = smooth(Y_WORK - 0.38, Y_WORK - 0.04, y);     // nothing until the Work card is out of the way
            const shown = clamp(opacity * opened);

            const key = `${shown.toFixed(3)}|${x.toFixed(1)}|${py.toFixed(1)}|${z.toFixed(1)}`;
            if (key === keys[i]) return;
            keys[i] = key;
            el.style.opacity = String(shown);
            el.style.zIndex = String(Math.round(100 - e * 10));
            el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${py}px, ${z}px) rotateY(${touch ? 0 : e * -5 * side}deg)`;
            el.classList.toggle('is-live', Math.abs(e) < 0.4);
            el.classList.toggle('is-off', shown <= 0.001);
        });
    }

    return { update };
}
