// Live clock (IST), in the Contact card and the closing card
export function startClock() {
    const els = document.querySelectorAll<HTMLElement>('[data-clock]');
    const update = () => {
        const now = new Date().toLocaleString('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        els.forEach((el) => (el.textContent = `${now} IST`));
    };
    update();
    setInterval(update, 1000);
}
