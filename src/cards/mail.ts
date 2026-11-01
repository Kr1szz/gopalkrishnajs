// Email links send a paper plane first, and the mail app opens as it leaves the screen. Not every browser has a mail
// app behind mailto:, so a small note keeps the address in view.
const NOTE_MS = 6000;

export function startMail(send: (link: HTMLAnchorElement, arrive: () => void) => void, onArrive?: () => void) {
    const note = document.createElement('div');
    note.className = 'mail-note';
    note.setAttribute('role', 'status');
    document.body.append(note);
    let timer = 0;

    document.addEventListener('click', (e) => {
        const link = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="mailto:"]');
        if (!link || e.defaultPrevented) return;
        e.preventDefault();

        send(link, () => {
            onArrive?.();
            location.href = link.href;

            const address = link.href.replace('mailto:', '');
            note.textContent = 'plane away. no mail app? write to ';
            const direct = document.createElement('a');
            direct.href = link.href;
            direct.textContent = address;
            note.append(direct);
            note.classList.add('is-on');
            clearTimeout(timer);
            timer = window.setTimeout(() => note.classList.remove('is-on'), NOTE_MS);
        });
    });
}
