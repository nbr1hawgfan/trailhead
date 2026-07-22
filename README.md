# Trailhead — Broken Arrow Apartment Tracker

A single, self-contained PWA (GitHub Pages, IndexedDB, no backend, no API key) for comparing apartments by hand — the kind of details that don't show up reliably in aggregated listing feeds anyway: verified rent, lease term, fees, amenities, and your own pros/cons.

## Host it on GitHub Pages
1. Create a new repo (or a folder in an existing Pages repo), e.g. `trailhead-app`.
2. Copy everything inside `pwa/` (index.html, style.css, app.js, manifest.json, sw.js, icons/) into that repo.
3. Push, then enable GitHub Pages for the repo (Settings → Pages → deploy from branch, root).
4. Visit the published URL. On a phone, use "Add to Home Screen" to install it like an app.

## How it works
- **My List** — tap "+ Add apartment" to open the editor: property name, website link, address, rent, lease term, beds/baths/sqft, status (interested / toured / applied / passed), full move-in cost breakdown (deposit, application fee, pet fee, utility setup estimate, other fees, and whether first/last month is due at signing), an 18-item features checklist (in-unit washer/dryer, dishwasher, central A/C, parking, pool, gym, pet-friendly, utilities included, and more), photos, and free-form pros/cons plus notes. Tap any card to reopen and edit it, or delete it.
- **Photos** — add photos right from the editor; on a phone this opens the camera directly (or the photo library). Images are automatically resized down before saving so storage stays reasonable. Tap a thumbnail to view it full-size, or the ✕ to remove it. The first photo added becomes the cover image on that apartment's card in the list.
- **Compare** — every saved apartment lined up by rent, sqft, $/sqft, move-in total, and a handful of the most decision-relevant amenities, with the lowest move-in cost highlighted in green.
- Everything — including photos — is stored in IndexedDB in the browser. Nothing is sent anywhere. No API keys, no rate limits, no stale listings.

## Design
Light theme in University of Tulsa's official brand colors — Royal Blue (`#003595`) and Old Gold (`#D0B787`/`#F3D54E` for accents), with Crimson (`#CE0E2D`) used sparingly for delete actions and "passed" status. Source Serif 4 for headings, IBM Plex Sans for body text, IBM Plex Mono for all cost figures so money always reads clearly as data.

## A note on storage
Photos live in the browser's IndexedDB storage, which typically has room for hundreds of megabytes to a few gigabytes depending on the device and browser — plenty for photos across a handful of apartments. It's tied to that specific browser on that specific device/phone, though, so it won't show up if he opens the app on a different phone or clears site data/storage. If that ever matters, worth a follow-up conversation about adding an export/backup option.

