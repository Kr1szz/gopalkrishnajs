// A small card that pops up from a link in the sentence. There is one, on <body>, so a card can never clip it.
const GAP = 12;
const EDGE = 8;
const SWITCH = 240;     // ms a new link must hold the cursor to take over an open peek

export function startPeeks() {
    const triggers = [...document.querySelectorAll<HTMLAnchorElement>('a[data-peek]')];
    if (!triggers.length) return;

    const peek = document.createElement('div');
    peek.className = 'peek';
    peek.setAttribute('role', 'tooltip');
    const tab = document.createElement('span');
    tab.className = 'peek__tab';
    const note = document.createElement('p');
    const link = document.createElement('a');
    link.className = 'peek__link';
    peek.append(tab, note, link);
    document.body.append(peek);

    let open: HTMLAnchorElement | null = null;
    let closing = 0;
    let switching = 0;
    let touch = false;

    function show(trigger: HTMLAnchorElement) {
        clearTimeout(closing);
        open = trigger;
        tab.textContent = trigger.dataset.peek ?? '';
        note.textContent = trigger.dataset.note ?? '';
        link.textContent = trigger.dataset.label ?? '';
        link.href = trigger.href;
        link.target = trigger.target;
        link.rel = trigger.rel;

        const anchor = trigger.getBoundingClientRect();
        const box = peek.getBoundingClientRect();
        const x = Math.min(innerWidth - box.width - EDGE, Math.max(EDGE, anchor.left + anchor.width / 2 - box.width / 2));
        const above = anchor.top - box.height - GAP;
        const y = above >= EDGE ? above : anchor.bottom + GAP;
        peek.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        peek.classList.add('is-open');
    }

    function hide() {
        open = null;
        peek.classList.remove('is-open');
    }

    const hideSoon = () => {
        clearTimeout(closing);
        closing = window.setTimeout(hide, 180);
    };

    addEventListener('pointerdown', (e) => {
        touch = e.pointerType !== 'mouse';
        if (touch && !peek.contains(e.target as Node) && !triggers.includes(e.target as HTMLAnchorElement)) hide();
    }, { passive: true });

    triggers.forEach((trigger) => {
        // on a narrow card the way up to an open peek crosses other links, and those mustn't snatch it
        trigger.addEventListener('pointerenter', (e) => {
            if (e.pointerType !== 'mouse') return;
            if (open && open !== trigger) switching = window.setTimeout(() => show(trigger), SWITCH);
            else show(trigger);
        });
        trigger.addEventListener('pointerleave', () => {
            clearTimeout(switching);
            hideSoon();
        });
        trigger.addEventListener('focus', () => show(trigger));
        trigger.addEventListener('blur', hideSoon);
        // on touch there is no hover: the first tap opens the peek, and the link in it goes on from there
        trigger.addEventListener('click', (e) => {
            if (touch && open !== trigger) {
                e.preventDefault();
                show(trigger);
            } else if (touch) {
                e.preventDefault();
                link.click();
            }
        });
    });

    peek.addEventListener('pointerenter', () => {
        clearTimeout(closing);
        clearTimeout(switching);
    });
    peek.addEventListener('pointerleave', hideSoon);
    peek.addEventListener('focusin', () => clearTimeout(closing));
    peek.addEventListener('focusout', hideSoon);
    addEventListener('scroll', hide, { passive: true, capture: true });
}
