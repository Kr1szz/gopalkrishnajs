import { clamp, PROJECT_STEP, smooth, Y_WORK } from './scroll';

// After the menu has docked, the projects hang in the air in a line and the page flies through them.

const DEPTH = 620;

export function createWork() {
    const projects = [...document.querySelectorAll<HTMLElement>('.project')];

    function update(y: number) {
        const w = (y - Y_WORK) / PROJECT_STEP;
        projects.forEach((el, i) => {
            const e = i - w;
            // ahead of us they swing out to the sides; passing, they come straight at the camera
            const side = Math.sin(i * 2.4 + 0.6);
            const lift = Math.cos(i * 1.7);
            const far = Math.max(0, e);
            const x = side * far * Math.min(240, innerWidth * 0.2);
            const py = lift * far * 70 + far * 24;
            const z = e > 0 ? -e * DEPTH : -e * 760;

            const opacity = e > 0
                ? 1 - smooth(1.2, 2.6, e)
                : 1 - smooth(0.02, 0.55, -e);
            const opened = smooth(Y_WORK - 0.38, Y_WORK - 0.04, y);     // nothing until the Work card is out of the way
            const shown = opacity * opened > 0.001;

            el.style.opacity = String(shown ? clamp(opacity * opened) : 0);
            el.style.zIndex = String(Math.round(100 - e * 10));
            el.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${py}px, ${z}px) rotateY(${e * -5 * side}deg)`;
            el.classList.toggle('is-live', Math.abs(e) < 0.4);
        });
    }

    return { update };
}
