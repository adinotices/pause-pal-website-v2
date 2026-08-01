# PausePal Website

A meditation accountability buddy platform built with HTML, CSS, and JavaScript. PausePal helps people find meditation partners for consistent mindfulness practice through structured 4-week programs.

This repo holds two independently deployed things:

- **The marketing site** (`index.html`, `styles.css`, `turtle.svg`, `favicons/`, `robots.txt`, `sitemap.xml`) — deployed to `pausepal.co` via GitHub Pages (see `.github/workflows/deploy.yml`).
- **[`app/`](./app)** — the PausePal application (cohort signup, matching, Zoom/Calendar scheduling, participant accounts, and admin tooling), a separate Next.js app deployed to `app.pausepal.co` on Vercel. See `app/README.md` for setup and how each piece works.

## Features

- Responsive design that works on all devices
- Modern gradient animations and smooth scrolling (skipped for
  `prefers-reduced-motion`)
- Interactive FAQ section and user testimonials -- the testimonial grid
  also fetches admin-published testimonials from the app's public
  `/api/testimonials` endpoint client-side and appends them to the
  hardcoded list, failing silently if that's unreachable (e.g. before
  `app.pausepal.co` is deployed)
- Waitlist signup functionality
- Basic SEO (Open Graph/Twitter meta tags, canonical URL, JSON-LD
  Organization data, `robots.txt`/`sitemap.xml`) and accessibility (skip
  link, `<main>` landmark, ARIA state on the mobile menu/FAQ toggles,
  screen-reader text for star ratings) groundwork

## Contact

For questions: hello@pausepal.co