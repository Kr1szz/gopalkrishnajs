// Phones change the viewport height whenever the address bar slides. That is not a resize worth reacting to: redoing the
// canvases mid-scroll is what would stutter. So heights are taken from the large viewport, and only real changes count.
let probe: HTMLElement | null = null;

export const isTouch = () => document.documentElement.classList.contains('touch');

/** Height of the viewport with the browser's bars tucked away; the same as innerHeight on a desktop. */
export function viewportHeight() {
    if (!isTouch()) return innerHeight;
    if (!probe) {
        probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;top:0;width:0;height:100lvh;visibility:hidden;pointer-events:none';
        document.body.append(probe);
    }
    return Math.max(probe.offsetHeight, innerHeight);
}

export function onViewportChange(fn: () => void) {
    let width = innerWidth;
    let height = viewportHeight();
    addEventListener('resize', () => {
        const next = viewportHeight();
        if (innerWidth === width && next === height) return;
        width = innerWidth;
        height = next;
        fn();
    });
}
