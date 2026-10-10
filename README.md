# Attendance Tracker BD

A free, fully offline class-attendance tracker for students in Bangladesh — bilingual (English/বাংলা), with a safe-bunk calculator that tells you exactly how many classes you can miss while staying above your required attendance percentage.

## The problem

Many universities and colleges in Bangladesh enforce a minimum attendance rule (commonly 75%) for exam eligibility. Students track attendance in notebooks or memory and guess whether they can afford to miss a class. This app replaces guessing with exact math.

## Features

- **Subjects** with a per-subject required % (default 75, configurable 1–100)
- **Mark each class**: Present / Absent / Cancelled (cancelled classes never count)
- **Live percentage** per subject with safe / edge / danger states
- **Safe-bunk calculator**: "miss N more and stay above X%" — exact formula
- **Recovery planner**: below the threshold? Shows how many consecutive presents you need
- **Overall attendance** across all subjects
- Per-subject class log with dates (deletable entries)
- **Bilingual UI**: full English ⇄ বাংলা toggle, Bengali digits in BN mode
- **localStorage persistence**, JSON export/import, sample data
- Responsive mobile + desktop; zero network requests

## Tech stack

Vanilla HTML / CSS / JavaScript. No build step, no frameworks, no backend, no dependencies at runtime.

## Prerequisites

Any modern browser (Chrome, Edge, Firefox, Safari). Nothing to install.

## Install

1. Download or clone this repository.
2. Open `index.html` in a browser — or serve the folder with any static server:
   `python3 -m http.server 8000` → http://localhost:8000

## Dev commands

No build, no package manager. To run the automated test suite:

```bash
cd /tmp/at-test && npm install playwright-core   # one-time
python3 -m http.server 8123 --directory ~/workspace/muse-project-factory/builds/attendance-tracker-bd &
node test.js
```

## Environment variables

None. The app is fully offline and uses no keys, tokens, or services.

## Testing

Headless-Chromium (Playwright) suite, run for real — **23 checks, 23 passed, 0 console/page errors**:

- Empty state on first load; add subject appears
- 8 present / 2 absent → exactly **80.0%**; safe bunks at 75% required → **0** (hand-verified: 8/11 = 72.7% < 75%)
- 9/10 at 75% → **2** safe bunks (9/12 = 75.0% ✓, 9/13 = 69.2% ✗)
- 5/10 at 75% → **10** consecutive presents to recover ((7.5−5)/0.25 = 10)
- Required 100% while below → "cannot recover" message
- Cancelled class excluded from totals and percentage
- Invalid inputs rejected (empty name, duplicate name, required % 0 / 101)
- Required-% edit updates the verdict live
- Delete subject (with confirm); delete single log entry
- Export → clear → import round-trip restores everything; malformed import shows an error
- State persists across page reload
- BN/EN toggle rewrites all labels; Bengali digits in BN mode
- Mobile 390px viewport: zero horizontal overflow, no page errors

## Deployment

GitHub Pages compatible: push the folder contents to a repo's `main` branch root and enable Pages (Deploy from a branch → `main` / `/ (root)`).

## Limitations

- Attendance is self-reported; the math is only as honest as the input.
- "Safe bunks" assumes all future classes happen (no more cancellations) and the required % doesn't change.
- Data lives in the browser's localStorage — clearing site data deletes it; use Export JSON as backup. No sync between devices.
- Dates use the device's local timezone.

## Status

Complete and verified. Version 1.0 — 2026-10-11.
