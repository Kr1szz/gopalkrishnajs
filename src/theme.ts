export type Theme = 'light' | 'dark';

const html = document.documentElement;

export const currentTheme = () => (html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light') as Theme;

// applied inside the view transition, so the new snapshot already has the new sky
export function createThemeToggle(onChange: (theme: Theme) => void) {
    const toggle = document.querySelector<HTMLButtonElement>('[data-corner="theme"]')!;

    function applyTheme(theme: Theme) {
        html.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('theme', theme);
        } catch {
            // private windows can refuse storage; the theme still applies for this visit
        }
        onChange(theme);
    }

    toggle.addEventListener('click', () => {
        const next = currentTheme() === 'light' ? 'dark' : 'light';
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (document.startViewTransition && !reduced) {
            const rect = toggle.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const maxR = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));

            html.style.setProperty('--tx', `${cx}px`);
            html.style.setProperty('--ty', `${cy}px`);
            html.style.setProperty('--tr', `${maxR}px`);

            document.startViewTransition(() => applyTheme(next));
        } else {
            applyTheme(next);
        }
    });
}
