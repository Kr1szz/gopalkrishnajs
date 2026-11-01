// Marks the cards whose content doesn't fit, so they can scroll inside themselves, and shows a fade while there's more.
export function watchOverflow(boxes: HTMLElement[]) {
    const edge = (box: HTMLElement) => {
        box.classList.toggle('has-more', box.scrollHeight - box.clientHeight - box.scrollTop > 6);
    };

    const measure = (box: HTMLElement) => {
        const scrolls = getComputedStyle(box).overflowY === 'auto' && box.scrollHeight > box.clientHeight + 1;
        box.classList.toggle('can-scroll', scrolls);
        if (scrolls) box.tabIndex = 0;      // so the arrow keys reach it too
        else box.removeAttribute('tabindex');
        edge(box);
    };

    const observer = new ResizeObserver((entries) => entries.forEach((entry) => measure(entry.target as HTMLElement)));
    boxes.forEach((box) => {
        observer.observe(box);
        box.addEventListener('scroll', () => edge(box), { passive: true });
    });
    const refresh = () => boxes.forEach(measure);
    document.fonts?.ready.then(refresh);
    return refresh;     // for changes that don't resize the box, like the tags falling back to a list
}
