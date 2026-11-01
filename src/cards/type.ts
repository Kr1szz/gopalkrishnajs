// Text types itself in when its card arrives. Each character is wrapped while it plays, so links keep working and
// nothing reflows, and everything is unwrapped afterwards so screen readers get plain text again.
const STEP = 7;     // ms per character

export function createTyper(root: HTMLElement) {
    let run = 0;

    function wrap() {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        while (walker.nextNode()) nodes.push(walker.currentNode as Text);

        const letters: HTMLElement[] = [];
        for (const node of nodes) {
            const part = document.createDocumentFragment();
            for (const piece of (node.textContent ?? '').split(/(\s+)/)) {
                if (!piece.trim()) {
                    part.append(piece);
                    continue;
                }
                for (const ch of piece) {
                    const span = document.createElement('span');
                    span.className = 'ch';
                    span.textContent = ch;
                    letters.push(span);
                    part.append(span);
                }
            }
            node.replaceWith(part);
        }
        return letters;
    }

    function finish() {
        run++;
        root.classList.remove('is-typing');
        root.querySelectorAll('.ch').forEach((span) => span.replaceWith(span.textContent ?? ''));
        root.normalize();
    }

    return {
        play() {
            finish();
            const id = run;
            const letters = wrap();
            root.classList.add('is-typing');
            const start = performance.now();
            let shown = 0;
            const step = (now: number) => {
                if (id !== run) return;
                const upto = Math.min(letters.length, Math.floor((now - start) / STEP));
                for (; shown < upto; shown++) letters[shown].classList.add('is-on');
                if (shown < letters.length) requestAnimationFrame(step);
                else finish();
            };
            requestAnimationFrame(step);
        },
        finish,
    };
}
