// ===== CONSOLE EASTER EGG =====
console.log(
    '%clooks like you love to poke around,\nwould love to talk — let\'s connect!',
    'font-family: ui-monospace, SF Mono, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #93c5fd; padding: 8px 0;'
);

// ===== THEME TOGGLE =====
const html = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');

const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);

function applyTheme(t) {
    html.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
}

themeToggle.addEventListener('click', (e) => {
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';

    if (document.startViewTransition) {
        const rect = themeToggle.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const maxR = Math.hypot(
            Math.max(cx, window.innerWidth - cx),
            Math.max(cy, window.innerHeight - cy)
        );

        html.style.setProperty('--tx', cx + 'px');
        html.style.setProperty('--ty', cy + 'px');
        html.style.setProperty('--tr', maxR + 'px');

        document.startViewTransition(() => applyTheme(next));
    } else {
        applyTheme(next);
    }
});

// ===== LIVE CLOCK (IST) =====
function updateClock() {
    const now = new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const el = document.getElementById('localTime');
    if (el) {
        el.textContent = now + ' IST';
    }
}

updateClock();
setInterval(updateClock, 1000);

// ===== GSAP ENTRANCE ANIMATIONS =====
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReduced) {
    // Build a staggered entrance timeline
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

    // Avatar — scale + fade up
    tl.fromTo('.avatar',
        { autoAlpha: 0, y: 30, scale: 0.85 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.9 },
        0.1
    );

    // Name — fade up
    tl.fromTo('.hero-name',
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.8 },
        0.25
    );

    // Subtitle — fade up
    tl.fromTo('.hero-title',
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.7 },
        0.38
    );

    // Bio paragraphs — staggered fade up
    tl.fromTo('.hero-bio',
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.09 },
        0.46
    );

    // Social links — fade up
    tl.fromTo('.hero-links',
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.7 },
        0.68
    );

    // Theme toggle — soft fade in
    tl.fromTo('.theme-toggle',
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.8 },
        0.5
    );

    // Footer — fade in last
    tl.fromTo('.home-footer',
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.9 },
        0.85
    );
} else {
    // If reduced motion, just make everything visible instantly
    gsap.set(['.avatar', '.hero-name', '.hero-title', '.hero-bio',
        '.hero-links', '.theme-toggle', '.home-footer'], { autoAlpha: 1 });
}
