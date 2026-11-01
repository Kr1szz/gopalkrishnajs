import Matter from 'matter-js';

const { Bodies, Body, Composite, Constraint, Engine } = Matter;

// Stack card: the skills drop in one by one and pile up on the bottom edge. They can be picked up and thrown, and they
// keep righting themselves so they stay readable.
const INSET = 14;       // room between the pile and the card's edges
const FILL = 0.72;      // how much of the space under the blurb the tags aim to cover
export function createPile(pile: HTMLElement) {
    const items = [...pile.querySelectorAll<HTMLElement>('li')];
    const engine = Engine.create({ gravity: { x: 0, y: 1.1 } });
    const fine = matchMedia('(pointer: fine)').matches;

    let W = 0;
    let H = 0;
    let bodies: { el: HTMLElement; body: Matter.Body; w: number; h: number; drop: number }[] = [];
    let walls: Matter.Body[] = [];
    let started = 0;
    let running = false;
    let last = 0;
    let grab: Matter.Constraint | null = null;

    // the blurb can wrap on narrow cards, so the pile starts wherever it ends
    function place() {
        const intro = pile.parentElement!.querySelector<HTMLElement>('.card__intro')!;
        pile.classList.remove('is-flat');
        pile.style.top = `${intro.offsetTop + intro.offsetHeight + 8}px`;
        items.forEach((el) => (el.style.transform = ''));
        // tags are sized to fill the space, so the pile never sits under a gap; when they can't fit, it's a plain list
        const area = () => items.reduce((sum, el) => sum + el.offsetWidth * el.offsetHeight, 0);
        pile.style.setProperty('--tk', '1');
        const room = (pile.clientWidth - INSET * 2) * (pile.clientHeight - INSET);
        const scale = Math.min(1.22, Math.max(0.88, Math.sqrt((room * FILL) / area())));
        pile.style.setProperty('--tk', scale.toFixed(3));
        if (area() * 1.5 <= room) return true;
        pile.style.setProperty('--tk', '0.92');
        pile.classList.add('is-flat');
        return false;
    }

    function reset() {
        Composite.clear(engine.world, false);
        W = pile.clientWidth;
        H = pile.clientHeight;
        const t = 60;
        walls = [
            Bodies.rectangle(W / 2, H + t / 2 - INSET, W + t * 2, t, { isStatic: true }),
            Bodies.rectangle(-t / 2 + INSET, H / 2 - 400, t, H + 1000, { isStatic: true }),
            Bodies.rectangle(W + t / 2 - INSET, H / 2 - 400, t, H + 1000, { isStatic: true }),
        ];
        Composite.add(engine.world, walls);
        bodies = items.map((el, i) => {
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            const span = Math.max(1, W - INSET * 2 - w);
            const x = INSET + w / 2 + ((i * 137) % span);
            const body = Bodies.rectangle(x, -60, w, h, {
                chamfer: { radius: h / 2 - 1 },
                restitution: 0.22,
                friction: 0.6,
                angle: ((i % 5) - 2) * 0.1,
            });
            el.style.transform = 'translate(-999px, -999px)';
            return { el, body, w, h, drop: i * 55 };
        });
        started = performance.now();
    }

    function point(e: PointerEvent) {
        const rect = pile.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function release() {
        if (!grab) return;
        Composite.remove(engine.world, grab);
        grab = null;
        items.forEach((el) => el.classList.remove('is-held'));
    }

    if (fine) {
        pile.addEventListener('pointerdown', (e) => {
            const item = bodies.find((b) => b.el === e.target);
            if (!item) return;
            e.preventDefault();
            item.el.setPointerCapture(e.pointerId);
            item.el.classList.add('is-held');
            grab = Constraint.create({ pointA: point(e), bodyB: item.body, stiffness: 0.12, damping: 0.1, length: 0 });
            Composite.add(engine.world, grab);
        });
        pile.addEventListener('pointermove', (e) => {
            if (grab) grab.pointA = point(e);
        });
        pile.addEventListener('pointerup', release);
        pile.addEventListener('pointercancel', release);
    } else {
        // on touch the card has to keep scrolling, so a tap gives a tag a little kick instead
        pile.addEventListener('click', (e) => {
            const item = bodies.find((b) => b.el === e.target);
            if (item) Body.setVelocity(item.body, { x: (Math.random() - 0.5) * 6, y: -9 });
        });
    }

    return {
        start() {
            if (!place()) return;
            reset();
            running = true;
            last = performance.now();
        },
        stop() {
            running = false;
            release();
        },
        tick(now: number) {
            if (!running) return;
            const dt = Math.min(1000 / 60, now - last);
            last = now;
            for (const item of bodies) {
                if (now - started >= item.drop && !item.body.plugin.added) {
                    item.body.plugin.added = true;
                    Composite.add(engine.world, item.body);
                }
            }
            for (const { body } of bodies) {
                if (!body.plugin.added || grab?.bodyB === body) continue;
                const tilt = Math.atan2(Math.sin(body.angle), Math.cos(body.angle));
                Body.setAngularVelocity(body, body.angularVelocity * 0.9 - tilt * 0.02);
            }
            Engine.update(engine, dt);
            for (const { el, body, w, h } of bodies) {
                if (!body.plugin.added) continue;
                el.style.transform = `translate(${body.position.x - w / 2}px, ${body.position.y - h / 2}px) rotate(${body.angle}rad)`;
            }
        },
    };
}
