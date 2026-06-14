# gopalkrishnajs

Premium developer portfolio rebuilt with Next.js App Router, TypeScript, Tailwind CSS, GSAP 3, ScrollTrigger, `@gsap/react`, and Lenis smooth scrolling.

## Structure

- `src/app` - App Router entry, metadata, sitemap, robots, global styles
- `src/components` - Portfolio sections, magnetic buttons, navigation, global motion effects
- `src/hooks` - GSAP timelines, ScrollTrigger setup, Lenis integration, reduced-motion detection
- `src/data` - Typed recruiter-facing content for projects, skills, experience, and links
- `src/types` - Portfolio TypeScript models
- `public` - Profile image, favicon, and résumé

## Commands

```bash
npm run dev
npm run build
npm run typecheck
```

## Features

- Cinematic GSAP hero sequence with split-character reveal
- ScrollTrigger section reveals, skill meters, timeline drawing, parallax image, and pinned horizontal projects
- Lenis smooth scrolling with reduced-motion fallback
- Glass navigation with scroll direction visibility, active sections, and mobile menu
- Mouse spotlight, custom cursor, loading overlay, page transition overlay, and scroll progress
- Recruiter-focused project cards, skills filtering, experience timeline, résumé, and contact flow
- SEO metadata, Open Graph, JSON-LD, sitemap, and robots route
