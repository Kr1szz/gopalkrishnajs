// ===== MOUSE SPOTLIGHT EFFECT =====
const spotlight = document.querySelector('.spotlight');

document.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;

    spotlight.style.setProperty('--mouse-x', `${x}px`);
    spotlight.style.setProperty('--mouse-y', `${y}px`);
});

// ===== THEME TOGGLE =====
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

// Check for saved theme preference or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    html.setAttribute('data-theme', 'light');
}

themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';

    html.setAttribute('data-theme', newTheme === 'light' ? 'light' : '');
    if (newTheme === 'dark') {
        html.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', newTheme);
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ===== DOCK TOOLTIP =====
const dockItems = document.querySelectorAll('.dock-item');

dockItems.forEach(item => {
    item.addEventListener('mouseenter', function () {
        this.style.transition = 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    });
});

// ===== FADE IN ON LOAD =====
document.addEventListener('DOMContentLoaded', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';

    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// ===== CONSOLE =====
console.log('%c👋 Hey there!', 'font-size: 16px; font-weight: bold;');
console.log('%cThanks for checking out my portfolio.', 'font-size: 12px; color: #888;');
console.log('%c→ github.com/kr1szz', 'font-size: 12px; color: #fff;');
