# Build notes: Viraaj Automates website

Kept up to date during the build. Newest status first. The quality reference is **[docs/oyin-study.md](oyin-study.md)**; the design system is the "Final Build Prompt" brief (fonts, grid, colours, motion, components).

## Status (26 Oct 2026, launch round)

| Area | State |
| --- | --- |
| Part A, polish (copy, nothing looks empty, hero, services, How it works, process, FAQ, contrast, case study, mobile) | Done |
| Part B, conversion copy on every page, nav, menu, footer, meta, OG image, privacy, 404 | Done |
| Part C, C1 WhatsApp preview, C2 report teaser, C3 curiosity links | Done |
| Part C, C6 cursor words and the "fixed in writing" pen stroke | Done |
| Part C, C4 clock, C5 leak cable, C6 case-study "Replay ↺" | Not built (optional; see "Deferred") |
| Part D, owner answers | Applied (table below) |
| Pre-launch checks (`node scripts/check-launch.mjs`) | 60/60 pass |
| Lighthouse mobile | Home 92 / 96 / 100 / 100, case study 95 / 96 / 100 / 100 |
| GitHub repo, Pages, DNS | Waiting for the owner's choice on how to publish the history (see "Publishing") |

**Where to resume:** Part E, step 6 (push). Everything before it is done and committed.

## How to work on the site

```
npm install          # once
npm run serve        # preview at http://localhost:4173 (gzip + 10 min cache, like GitHub Pages)
```

| Command | What it does |
| --- | --- |
| `node scripts/check-launch.mjs` | Pre-launch checks, PASS/FAIL (60). Includes the scroll check below |
| `node scripts/check-scroll.mjs [/path]` | "Nothing looks empty": 400 px steps at 1440 and 375, with motion, reduced motion and JavaScript off; fails if a labelled section shows its label while content on screen is under 40% opacity. Screenshots in `.scroll-check/` (git-ignored) |
| `node scripts/record-c.mjs [folder]` | Asserts C1/C2 (hover, typing, two taps on a phone, one tap once seen) and writes the GIFs |
| `node scripts/review.mjs [folder]` | Self-review screenshots of every section at 1440 and 375 → `docs/screenshots/<folder>/` |
| `node scripts/section-shot.mjs <folder> "<selector>" …` | Element screenshots of single sections (`--reduced`, `--widths`, `--open`) |
| `sh scripts/lh.sh <name> <path> [runs]` | Lighthouse mobile, N runs, prints the median (`MSYS_NO_PATHCONV=1` in Git Bash) |
| `node scripts/trace.mjs`, `node scripts/profile.mjs`, `node scripts/lh-tasks.mjs <trace>` | Find long main-thread tasks (throttled trace, CPU profile, inside a saved Lighthouse trace) |
| `node scripts/prepare-demo-shots.mjs` then `npm run shots` | Rebuilds the demo screenshots from `photos/raw/` (crops, masked numbers, "Sample" names) and their web sizes |
| `npm run og` | Re-renders the social image ("Get found. Get trusted. Never miss an enquiry.") |

## Owner answers (Part D)

| # | Item | Answer | Where it shows |
| --- | --- | --- | --- |
| 1 | "No sales call unless you ask for one" | Keep | Free check, under "Unlock my report on WhatsApp" |
| 2 | FAQ "about two weeks" | Keep | FAQ "How long does it take?" |
| 3 | Footer status when open | "Lines open · replies today" | Footer live line, Mon–Sat 10:00–19:00 IST (`js/clock.js`) |
| 4 | Night status "I'll reply in the morning" | Keep | Footer after hours ("on Monday morning" from Saturday evening) |
| 5 | Names in the demo screenshots | Replace with clearly fictional names | Every name is now "<first name> Sample"; the booking followed on the site is **Asha Sample** |
| 6 | Remaining OWNER lines | Part B copy used everywhere | None open |
| 7 | Privacy "Draft" | Removed | "Last updated 26 October 2026" |
| 8 | Tracking | None | No analytics, no cookies |
| – | The phone chat joins two real demo chats | OK for launch | Caption "Redrawn from the demo clinic's chats" |
| – | Demo site photos (implant, suitcase) | Real / licensed | Case study |

## Launch round: what changed

### Part A, polish

- "businesses", never "small businesses" (pages, meta, JSON-LD, OG).
- **Nothing looks empty.** Reveals trigger at 90% of the viewport, opacity only, 0.6 s, no delay. Service and process rows never fade under 40% and are full by mid-screen. Case-study images start at 40%. Tighter joins (About → Services, after How it works, How I work → FAQ → Free check). The scroll check above fails on the old timing and passes now.
- **Hero.** Label and strip 12 px at 72% cream; the strip on one line, hidden below 768. "Get my free check" is cream on plum, full width and 52 px tall on phones, above the fold.
- **Performance.** Home mobile 64 → 92 (TBT 1.27 s → about 50 ms). What did it: reveals, rows and the hero exit moved from ScrollTrigger to IntersectionObservers and one scroll loop; ScrollTrigger loads only for the desktop pin, when the section is near; no test WebGL context at start-up; the intro no longer measures its path (that forced full-page layouts while the page was still loading); the cord's setup is split into short tasks with its shaders warmed one mesh per task; on a first visit the still cord shows until the live one is ready.
- **Services.** One compact row each, with "What's included +" closed (then reworked in Part B).
- **How it works.** A real short conversation in the phone (Riya's greeting and quick replies, the Hinglish question, Riya's Hinglish reply, the name, the confirmation), 15 px bubbles. Step 03 labels carry the tool's mark and name (Google Sheets, Gmail, Google Calendar). Step 04 card framed like the tiles. The buttons pin with the steps; the pin lets go right after step 04.
- **Screenshots.** Phone numbers read "99999 XXX99" everywhere, never blurred; "Pain in lower teeth"; no "Email: N/A". Words are re-set in the screenshot's own font, fitted against the screenshot itself (`scripts/lib/retype.mjs`), or cut out with its own pixels.
- Process title "Launch and look after" on one line; FAQ plus/minus drawn on whole pixels (a rotated 1 px bar could vanish, so a closed item read as "−"); mono labels at least 12 px, 62% ink on paper and 72% cream on plum; menu footer 13 px.
- Case study: the treatments page is cut above Riya's widget (the recording's own frame cut it in half); the pair shows the real Hinglish chat instead.

### Part B, conversion copy

All copy from the Part B brief, word for word: meta and OG line, nav "Free check" link, menu with descriptions and a footer button, hero (label, subline, "Get my free check", "Chat with Riya now ↗", micro line, strip), About, Services (leak, cost, fix, a proof to check now, "What's included +"; titles are links; hover cards and hint removed), the new **No risk** block, How it works, How I work, the nine FAQ objections, Free check, footer, case-study headings and end band, privacy intro, 404.

WhatsApp prefilled texts:

| Where | Text |
| --- | --- |
| Every "Get my free check", nav "Free check" | Hi Viraaj, I'd like the free check. Business name: |
| Free check "Unlock my report on WhatsApp" | Hi Viraaj, please send my free check. Business name: <name typed in the field> |
| Local SEO "Find out where you stand on Google →" | Hi Viraaj, I'd like to know where I stand on Google. Business name: |
| Websites "Is my website losing customers? Ask me →" | Hi Viraaj, can you check my website? Link: |
| Footer and menu WhatsApp, "Message me" | Hi Viraaj, I found your website and have a question. |

The demo clinic is linked again (Part B): `https://demo.viraajautomates.tech/` ("See a website I built ↗") and `…/?riya=open` ("Chat with Riya now"), always in a new tab. The check script allows only those two addresses.

### Part C, selling interactions

| # | What | Details |
| --- | --- | --- |
| C1 | WhatsApp preview on every free-check button | A WhatsApp-style bubble rises above the button (0.45 s, house curve) with the exact message and "Opens WhatsApp. You press send." Hover or keyboard focus on desktop; first tap on phones, second tap opens WhatsApp; once seen in the session, one tap. The free check's name field fills every bubble and every free-check link live. Screen readers get the message through `aria-describedby`. Reduced motion: no rise. No JS: plain links |
| C2 | "Your free report" card | Cream mat, hairline, warm shadow; "Free check · [Your business]" fills in live (`aria-live="polite"`); four locked rows with blurred stand-in shapes (never data); the locks lean as you type (0.4 s) and stay shut. "Unlock my report on WhatsApp", micro line. No JS: static card and button, no field. On desktop the bubble sits beside the button so the card stays readable |
| C3 | Curiosity links | Checked by the script: their own prefilled texts, no tool links |
| C6 | Cursor words and pen stroke | CHECK (free-check links), CHAT (Riya), READ (case study), SEE (website); one pen stroke under "fixed in writing", drawn once in 0.9 s; drawn at once under reduced motion or without JS |

GIFs and stills: `docs/screenshots/launch-c/` (`c1-c2-desktop.gif`, `c1-phone.gif`).

## Differences from the brief, and why

| Brief | Built | Why |
| --- | --- | --- |
| A3: start the cord after the intro and idle (rIC, 1.5 s fallback) | After the intro **and** the visitor's first move, touch, scroll or key (or 5 s), then rIC (1.5 s fallback) | The cord's first shader compile is one ~0.6 s task on a software GPU. With rIC alone it landed inside Lighthouse's window in 3 of 5 runs (score 63). Now 5 of 5 runs score 92–93. The still image is rendered from the same scene, so nothing visible changes before it goes live |
| A2: content fully visible by 75% | Reveal starts at 90%, 0.6 s; the scroll check requires 40% for anything above 88% of the screen | 88% sits just above the 90% trigger, so the check can't fail on an element that is correctly about to reveal; it still fails on the old 85% + delay timing |
| A5: phone shows four messages | Steps 01 and 02 both use the phone: greeting + question, then the four messages | Fills the phone at step 01 too; the confirmation is trimmed so it doesn't name a different day from the Hinglish question (two real chats joined, approved) |
| A9: crop the widget fully in or out | Out | The recording's frame cuts it in half, so "fully in" isn't possible |
| B5: proof link per row; title is a link | Title links go where the row's proof link goes | One destination per row |
| B10 + C2 micro lines | Merged: "I check it myself and send it within one working day. No charge. No sales call unless you ask for one." | Avoids two "No charge" lines in one block |
| C2: one button in the free check | "Unlock my report on WhatsApp" replaces "Get my free check" in that block | One primary action per block |
| C4, C5, C6 Replay | Not built | Optional; the required parts, checks and scores came first |

## Lighthouse, mobile (simulated slow 4G, 4× CPU), local server with gzip

| Page | When | Performance | Accessibility | Best practices | SEO | TBT | LCP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Before (median of 3) | 64 | 95 | 100 | 100 | 1,274 ms | 3.1 s |
| Home | After (median of 5; all 5 runs 92–93) | 92 | 96 | 100 | 100 | 56 ms | 2.9 s |
| Case study | Before | 97 | 100 | 100 | 100 | 30 ms | 2.6 s |
| Case study | After (median of 3) | 95 | 96 | 100 | 100 | 54 ms | 2.7 s |

## Publishing

The GitHub repo does not exist yet and nothing has been pushed. Earlier commits in this local history contain the old demo screenshots (with the original names) and older wording; pushing the full history would publish them. Options: push the whole history, or push one clean snapshot commit (the full history stays on this computer in a local branch).

## Deploy and DNS (after the push)

1. GitHub → the repo → Settings → Pages → Source: **GitHub Actions**. The workflow `.github/workflows/pages.yml` publishes `public/` on every push to `main` (Pages can only serve `/` or `/docs` from a branch, so the workflow does it).
2. Settings → Pages → Custom domain: `viraajautomates.tech` → Save. Do this before the DNS records.
3. name.com → My Domains → viraajautomates.tech → Manage → DNS Records. Add four **A** records, host empty (apex): `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
4. Optional, four **AAAA** records, host empty: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
5. One **CNAME** record: host `www`, answer `reflexgod.github.io`.
6. Wait for DNS (minutes to a few hours). When Settings → Pages shows the domain as verified, tick **Enforce HTTPS**.
7. Canonical, OG and sitemap URLs already use `https://viraajautomates.tech`, so no second push is needed for them.

## Notes for later

- Review the privacy notice against India's Digital Personal Data Protection Act, 2023, with a qualified adviser.
- Test every WhatsApp link on a real phone: run `npm run serve`, then open `http://<this PC's local IP>:4173` on the phone (same Wi-Fi).
- Measure the cord's frame rate on a real mid-range phone with `?fps`.
- If you send one continuous demo chat (first message to confirmation), the phone in "How it works" can show a single conversation.
