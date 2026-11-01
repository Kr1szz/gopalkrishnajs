// Small sounds, all synthesised, so there are no audio files to load. They only ever answer something the visitor did,
// and nothing starts until their first click or key press, which is when browsers allow audio anyway.
const root = document.documentElement;
const VOLUME = 0.5;

export function createSound() {
    let ctx: AudioContext | null = null;
    let noise: AudioBuffer | null = null;

    const muted = () => root.getAttribute('data-sound') === 'off';

    function wake() {
        if (!ctx) {
            ctx = new AudioContext();
            noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
            const data = noise.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        if (ctx.state === 'suspended') ctx.resume();
    }
    addEventListener('pointerdown', wake, { passive: true });
    addEventListener('keydown', wake, { passive: true });

    const ready = () => (ctx && ctx.state === 'running' && !muted() ? ctx : null);

    function tone(from: number, to: number, length: number, gain: number, type: OscillatorType = 'sine', after = 0) {
        const audio = ready();
        if (!audio) return;
        const at = audio.currentTime + after;
        const osc = audio.createOscillator();
        const env = audio.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(from, at);
        osc.frequency.exponentialRampToValueAtTime(to, at + length);
        env.gain.setValueAtTime(gain * VOLUME, at);
        env.gain.exponentialRampToValueAtTime(0.0001, at + length);
        osc.connect(env).connect(audio.destination);
        osc.start(at);
        osc.stop(at + length);
    }

    // a sheet being flicked: filtered noise that sweeps up
    function flick() {
        const audio = ready();
        if (!audio || !noise) return;
        const at = audio.currentTime;
        const source = audio.createBufferSource();
        const filter = audio.createBiquadFilter();
        const env = audio.createGain();
        source.buffer = noise;
        filter.type = 'bandpass';
        filter.Q.value = 1.2;
        filter.frequency.setValueAtTime(900, at);
        filter.frequency.exponentialRampToValueAtTime(3400, at + 0.16);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(0.1 * VOLUME, at + 0.03);
        env.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        source.connect(filter).connect(env).connect(audio.destination);
        source.start(at);
        source.stop(at + 0.2);
    }

    const click = () => tone(900, 380, 0.05, 0.05, 'triangle');
    const tick = () => tone(1700, 1500, 0.025, 0.014, 'triangle');
    const chirp = () => {
        tone(880, 880, 0.08, 0.05);
        tone(1320, 1320, 0.11, 0.05, 'sine', 0.07);
    };

    // links answer quietly as the cursor reaches them
    let last: Element | null = null;
    addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;
        const hit = (e.target as Element).closest?.('a, button') ?? null;
        if (hit && hit !== last) tick();
        last = hit;
    }, { passive: true });

    const toggle = document.querySelector<HTMLButtonElement>('[data-corner="sound"]');
    toggle?.addEventListener('click', () => {
        const off = !muted();
        if (off) root.setAttribute('data-sound', 'off');
        else root.removeAttribute('data-sound');
        try {
            localStorage.setItem('sound', off ? 'off' : 'on');
        } catch {
            // private windows can refuse storage; the choice still holds for this visit
        }
        if (!off) click();
    });

    return { flick, click, chirp };
}
