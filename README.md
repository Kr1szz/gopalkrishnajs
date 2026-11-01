# gopalkrishnajs

Personal portfolio: a paper plane flies over a dithered valley, lands as a card, and the rest of the site follows from there. Scroll drives everything.

Live at [gopalkrishnajs.vercel.app](https://gopalkrishnajs.vercel.app).

## Stack

Vite and vanilla TypeScript, with three.js for the planes, Matter.js for the falling tags, Lenis for smooth scrolling and raw WebGL2 for the valley and hover effects. All content is plain HTML in `index.html`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Structure

- `index.html` - all the content; edit text and links here
- `src/scroll.ts` - the scroll timeline every other module reads
- `src/valley/` - `paint.ts` paints the landscape on Canvas 2D at boot, `shader.ts` turns it into dots and handles time of day
- `src/planes/` - `fold.ts` folds a sheet into a dart along real creases; `index.ts` runs the flock, the flight and the card twins
- `src/cards/` - carousel and dock (`deck.ts`), overflow handling, physics tags, peek cards, type-in, email planes and hover brush
- `src/sound.ts` - synthesised sound effects
- `src/work.ts`, `src/covers.ts` - the project fly-through and its generated covers
- `public/` - résumé, favicon, social image

## Debugging

`?debug=1` with `s` (intro, 0 to 1), `c` (cards passed), `w` (projects passed) or `y` (screens) pins the page at that point, for example `/?debug=1&c=2.3`.

## Fallbacks

The page stays complete without any of the effects: no JavaScript or `prefers-reduced-motion` gives a normal stacked page, and without WebGL a CSS gradient stands in for the valley.
