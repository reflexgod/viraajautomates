# oyin.design: what makes it feel hand-made

A study of oyin.design as the quality reference for viraajautomates.tech. It records *how* the reference is built (measurements, timings, behaviour) so that our site can reach the same level of care **in its own way**. Nothing here is copied into our site: not its content, curtain, type-specimen intro, theatre wording, images, logo, code or page structure. Its JS and CSS were not downloaded; everything below was observed in a browser.

## How it was measured (25 Oct 2026)

- Chrome 155 driven by Playwright (`scripts/.study/`, not deployed). Captures are kept outside the repo (they are someone else's work).
- Pages: `/`, `/work`, `/work/vitalcare-plus`, `/work/asyn`, the menu and a 404 (`/this-page-does-not-exist`), each at 1440×900, 768×1024 and 375×812 (screenshots every 0.9 viewport down each page).
- Computed styles of every text element and layout container at all three widths.
- Motion: a per-frame sampler injected before any page script logged `transform`, `opacity`, `clip-path`, `font-weight` and text of the intro, hero, menu, hover card, ring, process rows and footer. Durations and easings were fitted against the samples (free duration, 13 candidate curves; the fit error is quoted where two curves are close).
- Intro and hero: 5 cold loads at 1440, sampled at ~55 fps; one also recorded with Chrome's screencast, read every 0.2 s for the first 8 s.
- Scroll-linked effects were read at fixed scroll positions (25 / 50 / 75 % and more), using real wheel events where `scrollTo` did not drive the page's smooth scroller.

What could **not** be confirmed is marked *unverified*; nothing was filled in from memory.

---

## Checking the brief's "already verified" list

| Brief says | Measured | Verdict |
| --- | --- | --- |
| Paper #F2EEE6, ink #1D1715, oxblood #5E1A17, cream #F6EEE3, graphite #141110 | rgb(242 238 230), rgb(29 23 21), rgb(94 26 23), rgb(246 238 227), rgb(20 17 16) | ✓. Also: nav bar #101010, hero button #0B0B0B, menu panel #000 (pure black) |
| Greys only as ink opacity (6, 7, 9, 15, 30, 50, 65–75 %) | Ink at 7 % (highlighter), 8 % (inset hairline on thumbs), 9 % (dashed guides), 15 % (hairlines), 30 % (underline), 40 % (hint), 50 % (labels), 65 % (body, intros). Cream at 36, 50, 62, 72, 85 % on dark | ✓, with 8 % and 40 % added |
| Faculty Glyphic / Inter variable / Simplon Mono | Faculty Glyphic 400; Inter 100–900; Simplon Mono 300–700 | ✓ (Simplon Mono is a paid font; we use DM Mono) |
| 12 columns from 1024 px, 32 px gaps, labels 1–3, content 4–12 ≤ 52rem | 12 × 80 px + 11 × 32 px = 1312 px at 1440; labels at x = 64, content at x = 400, 832 px wide | ✓ |
| Edge 24 px mobile, max(64 px, (100vw − 1760px)/2) from 768 | 24 px at 375; 64 px at 768 and 1440 | ✓ |
| Section padding 96 px mobile, 144 px from 768 | Top 96 / 144 ✓. Bottoms are smaller (80 px, 24 px) so related sections read as one run | ✓ with the bottom-padding nuance |
| CSS cubic-bezier(.22,1,.36,1) everywhere | 19 rules use exactly this curve; the only other timing function is `steps(4)` for the grain | ✓ |
| Lenis lerp 0.09, wheelMultiplier 0.95 | One 100 px wheel notch travels 95 px; each frame closes ~9 % of the remaining distance | ✓ |
| Anchor jumps 1.4 s ease-out-quart | Menu "Process" link: 0 → 4916 px in ~1.37 s, 29 % done at 7 %, 70 % done at 25 % of the time | ✓ |
| Intro starts 0.15 s after fonts load | Fonts ready at 92–243 ms; first guide starts at 0.6 s in fast loads, up to ~1.4 s in slow ones | ✗ The intro waits for more than fonts; offset is ~0.5 s+, not 0.15 s |
| Guides draw 1 s expo.out, stagger 0.1 | 1.0 s expo.out (rms 0.002), 0.1 s stagger | ✓ |
| Weight changes every 0.28 s from 0.55 s | Every 0.283 s, 8 steps (Light 300 → Black Italic 900 → Medium 500), first change 0.8 s after the guides start | Interval ✓; start ✗ (0.8 s, measured from the first guide) |
| Role line types 22 characters in 1.3 s from 1.5 s | 22 characters in 1.25 s, starting 1.5 s after the guides start | ✓ |
| Split at 3.55 s, halves move 1.4 s expo.inOut | Split 3.6 s after the guides start; halves move **1.24–1.26 s**; expo.inOut and power4.inOut fit equally (rms 0.009–0.012) | Start ✓; duration ✗ (≈1.25 s) |
| Click or key skips; skipped with reduced motion | Space skips; with reduced motion there is no intro | ✓. It also plays again on every reload (no session memory) |
| Curtain opens over 3.2 s power2.inOut | WebGL, so not sampleable; frames show the fabric in the split gap at +0.3 s and the ground fully revealed ~2.5–3 s later | Consistent, not exact |
| Title lines from 1.4 s (1.2 s expo.out, stagger 0.1) | Title lines start 1.23 s after the split starts; 1.19 s expo.out (rms 0.003); stagger 0.10 s; the lines start at yPercent 110 | ✓ (start ≈1.25 s after the split) |
| Supporting text from 1.8 s (0.9 s, stagger 0.08) | Starts 1.63 s after the split; 0.9 s power3.out, 12 px rise + opacity; stagger 0.083 s | ✓ |
| Hero closes and text fades on scroll-out | Not confirmed: copy opacity stayed 1 when the page was moved with `scrollTo` | *unverified* |
| Highlighter to 0.5 em in 0.45 s | `background-size` 0 → 15 px on a 30 px line, `transition: background-size .45s cubic-bezier(.22,1,.36,1)`; underline 1 px at 30 % ink | ✓ |
| Card 4:3, clamp(200px, 20vw, 300px), +24 px, quickTo 0.55 s power3.out | 288 × 216 at 1440 (= 20vw, 4:3), 200 × 150 at 375; follows at exactly +24/+24 with a lagging out-curve | ✓ (portrait 4:5 for the person card) |
| Tilt up to ±8° | No rotation seen on the card container during a fast horizontal move | *unverified* |
| Image swap via clip-path 0.55 s | `inset(100% 0 0)` → `inset(0)` in ~0.55 s on a power4.out-like curve; the outgoing image wipes away at the same time, the new one ~80 ms later | ✓ |
| Card appears (implied scale) | The card container never fades or scales: it is always at opacity 1, and the **image** wipes in on enter and wipes away (top inset 0 → 100 %) on leave | Different: entrance is a wipe, not a scale |
| Words flash in turn at 70 % | Not observed with scripted or real wheel scrolling | *unverified* |
| Ring: peel 72 % → top; pin 260 % (180 % under 720 px) | Peel runs from the section at 72 % to the top; pin spacer 3240 px = 900 + 2340 (260 %) at 1440 | ✓ (180 % not checked) |
| Centre copy fades 78–95 %, clickable after 92 % | Opacity 0 at 75 %, 0.41 at 85 %, 0.88 at 93 %, 1 at 100 % (linear from 78 % to 95 %) | ✓ |
| Hover scales a card to 1.12, dims others 45 % | Hovered card straightens and grows to ≈1.14 (from ≈1.0), z-index 1000; the others go to opacity 0.55 | ✓ (≈1.12–1.14) |
| Process: hairline scaleX scrubbed 85 % → 55 %; text 0.18 → 1 scrubbed 75 % → 50 % | Hairline 0 → 1 as the row top moves ≈96 % → 65 %; text 0.18 → 1 ≈86 % → 60 % (row top as the reference; ±3 % because of smoothing) | Shape ✓; positions about 10 % lower than the brief |
| Menu: wipe 0.8 s expo.inOut; links 0.9 s stagger 0.07 power4.out; reverse 1.6×; Escape | Wipe `inset(0 0 100%)` → `inset(0)` in 0.8 s; links rise from 110 % (152 px) starting 0.4 s, stagger 0.066 s, power4.out-like; footer items fade from 0.6 s, stagger 0.05; closing takes 0.9 s (1.6× faster); Escape closes | ✓. Focus is **not** returned to the menu button after closing |
| Footer valance scales down, scrubbed; title lines at 85 % (1.1 s power4.out) | Valance `scaleY` 0 → 1 from its top edge as the footer top moves 100 % → ≈45 %; title lines rise once the title reaches ≈85 % | ✓ (duration not fitted) |
| Cursor: 6 px dot, 34 px ring, difference; 56 px on links; 84 px disc with a word | Dot 6 px white; ring 34 px, 1 px white at 60 %; the cursor root uses `mix-blend-mode: difference`; ring grows to 56 px on links, to an 84 px black disc with an 11 px mono word ("view", "soon") on labelled items; size changes take 0.4 s on the house curve | ✓ |

---

## Page by page

### Home, 1440 × 900

**Nav (fixed, centred).** One 497 × 61 px bar at top 32 px, near-black (#101010), no radius, no shadow. Three items: email icon (left), monogram (centre, 40 px), two-line menu icon (right). Same bar at every width (343 px wide at 375). Hover on icons is subtle; focus is a 2 px outline at 4 px offset.

**Intro (first paint to ≈5.5 s).** Paper panel with typographic guides, a large word gaining weight step by step, mono corner meta and a typed line with a blinking block caret (0.5 s). The panel then tears horizontally at 49 % and the halves part. Pure HTML/CSS + one timeline. (Ours must be different; see §D in the brief and the details list below.)

**Hero (900 px).** A full-bleed WebGL fabric on the right, oxblood ground. Copy block at x = 111, top ≈ 307 px (34 % of the height): a mono 11 px label in cream at 62 %, the name in Faculty Glyphic 66 px / 1.05 / −0.015em, a two-line light (300) sub at 26 px / 1.45, and a mono button (black, 12 px, 0.18em tracking, 4 px radius, 50 px tall, arrow in a 24 px outlined square). A bottom strip of mono 11 px items with dimmer prefixes, a live local clock in tabular numbers, and a small dark "scroll" plate bottom-right.

**Statement 1 (label + one paragraph).** Label in mono 14 px uppercase at 50 % ink in columns 1–3, the paragraph in columns 4–12: Inter 300, 30 px / 1.625, −0.025em, ink. One preview word with a tiny tilted thumbnail (52 × 28 px, 1.8 px radius) that jiggles once every 9 s.

**Statement 2.** Same grammar, four preview words, then a mono 12 px hint at 40 % ink ("Hover / Tap …" swaps by input type). No top padding: it continues the previous section.

**Work ring (pinned 260 %).** Dashed 1 px guides at 25 / 50 / 75 % width (ink 9 %). Eight snapshot cards (≈198 × 225 px, 2 px radius, an 8 px cream mat drawn as an inset shadow with a 24 px bottom band, warm long shadow) peel off the inline thumbnails, pile up, and fan into a tilted ring that turns as you scroll. Centre: label, a two-line light paragraph, a mono button. Hover a card: it straightens and grows, the rest dim, the cursor shows a word.

**Process (5 rows).** Intro line 20 px at 65 % ink. Rows: grid 64 px | 192 px | 1fr, 32 px gap, 40 px vertical padding; a mono number at 50 %, a Faculty Glyphic 30 px title, an 18 px / 1.625 body at 65 %. Each row has a 1 px hairline on top (ink 15 %) that draws from the left, and its text rises from 18 % opacity, both scrubbed.

**Footer (oxblood).** A pleated valance hangs from the top edge and unrolls as the footer enters. Label, a two-line Faculty Glyphic title at 96 px / 1.0 / −0.02em, the email at 36 px with a 1 px underline that retracts on hover (0.5 s), a mono "send an email ↗" tag at 50 %. Bottom: links at 14 px (cream 72 %), a mono clock, and fine print at 12 px (cream 40 %), "Back to top ↑".

### Home, 768 × 1024
Single column below 1024 px: label above paragraph. Hero name 44 px, sub 17.6 px. Statement stays at 30 px. Footer title 68 px. The ring and process keep their behaviour; process rows switch to 3rem | 1fr.

### Home, 375 × 812
Edge 24 px. Hero name 36 px on two lines, sub 16 px; the fabric becomes a narrow strip on the right. Statements 20 px / 1.625. Process titles 24 px, body 16 px. Footer title 35 px; email 19.5 px. The ring pins for less and uses smaller cards. Touch: the first tap on a preview word shows a 200 × 150 card just below the word; the second tap opens the project page.

### /work
A full-viewport draggable canvas of project tiles ("Point, drag or scroll to explore · Pinch to zoom") with a centred three-line title in the middle and a small minimap bottom-left. Tiles show a caption on hover. At 375 the same canvas works by drag.

### /work/vitalcare-plus (case study)
Breadcrumb ("← All work"), a mono label, a 3-line Faculty Glyphic title on the left and a meta grid on the right (Industry, Scope, Year, Services) in small type. A sticky mono section index (Intro · Overview · Challenge · Solution · Conclusion) under the nav bar, with the active item inverted. Long image runs (full-width, then pairs, 2 px radius, small gaps), with label + heading + body text blocks in the content column between them. Ends with a "Next project" band leading into the footer.

### /work/asyn
A short "details are coming soon" page: title, one image, a gallery strip, a centred note, then links to three other projects and the footer. A good model for an honest "not yet" page.

### 404
Almost unstyled: white page, a small heading, one line of text and two links. The only place where the reference is not crafted.

### Menu (all widths)
Full-screen pure black panel wipes down from the top; four links in Inter 500, 128 px, −0.045em, each with a tiny mono number; hovering one dims the others to 30 %. A footer row with email, phone and a role line above a 1 px hairline (cream 15 %). At 375 the links are smaller and each row shows a → arrow.

---

## Motion table

Times are from the start of the trigger. "Fitted" means measured from samples; ± one frame (17 ms).

| Element | Trigger | Start → end | Properties | Duration | Delay / stagger | Easing |
| --- | --- | --- | --- | --- | --- | --- |
| Intro guides (4) | intro start | scaleX 0 → 1 | transform | 1.0 s | 0.1 s stagger | expo.out |
| Intro meta (corners) | +0.25 s | 0 → 1 | opacity | 0.5–0.76 s | together | power1/4.out |
| Intro word | +0.35 s | 0 → 1 | opacity | 0.45 s | — | power1.out |
| Intro word weight | +0.8 s | 300 → 900 → 500 | font-weight (step) | 8 steps | every 0.283 s | steps |
| Intro role line | +1.5 s | "" → 22 chars | text | 1.25 s | per character ≈57 ms | linear |
| Intro caret | always | on/off | opacity | 0.5 s loop | — | step |
| Intro split | +3.6 s | 0 → ∓441 / 459 px | translateY of two halves | 1.25 s | together | expo.inOut ≈ power4.inOut |
| Hero curtain (WebGL) | with the split | closed → open | — | ≈2.5–3 s | — | soft in-out (from frames) |
| Hero title lines | split + 1.23 s | yPercent 110 → 0 | transform | 1.2 s | 0.1 s | expo.out |
| Hero label, button, strip | split + 1.63 s | y 12 → 0, 0 → 1 | transform, opacity | 0.9 s | 0.083 s | power3.out |
| Preview highlighter | hover / focus | 0 → 0.5 em | background-size | 0.45 s | — | cubic-bezier(.22,1,.36,1) |
| Preview card position | pointer move | → pointer + 24 px | transform | ≈0.55 s lag | — | power3.out (quickTo) |
| Preview image in | enter / switch | inset(100% 0 0) → inset(0) | clip-path | 0.55 s | +80 ms after the old one starts leaving | power4.out-like |
| Preview image out | leave / switch | inset(0) → inset(100% 0 0) | clip-path | 0.55 s | — | power4.out-like |
| Thumbnail jiggle | idle | ±9° wobble | rotate | 9 s cycle, motion in the first ~0.8 s | staggered 1.5 s | linear keyframes |
| Ring peel | section 72 % → top | thumbnail → pile | transform, opacity | scrubbed | per-card offset | smooth |
| Ring fan + turn | pinned, 0 → 100 % of 260 % | pile → tilted ring | 3D transform | scrubbed | — | in-out |
| Ring centre copy | pin 78 % → 95 % | 0 → 1, y +20 → 0 | opacity, transform | scrubbed | — | linear |
| Ring card hover | hover (after ≈92 %) | scale ≈1.0 → 1.14, rot → 0; others 1 → 0.55 | transform, opacity | ≈0.5 s | — | out |
| Process hairline | row top ≈96 % → 65 % | scaleX 0 → 1 | transform | scrubbed (lagged) | — | linear |
| Process text | row top ≈86 % → 60 % | 0.18 → 1 | opacity | scrubbed (lagged) | — | linear |
| Footer valance | footer top 100 % → ≈45 % | scaleY 0 → 1 | transform | scrubbed | — | linear |
| Footer title lines | title at ≈85 % | yPercent 110 → 0 | transform | ≈1.1 s | 0.1 s | power4.out |
| Menu panel open | click | inset(0 0 100%) → inset(0) | clip-path | 0.8 s | — | expo.inOut |
| Menu links | +0.4 s | yPercent 110 → 0 | transform | ≈0.9–1.0 s | 0.066 s | power4.out |
| Menu footer | +0.6 s | 0 → 1 | opacity | ≈0.6 s | 0.05 s | out |
| Menu close | Escape / click | reverse | all of the above | 0.9 s | — | reverse at 1.6× |
| Smooth scroll | wheel | 9 % of the remaining distance per frame | scroll | ≈1 s settle | — | Lenis lerp 0.09 |
| Anchor glide | in-page link | 0 → target | scroll | 1.4 s | — | ease-out-quart |
| Cursor dot / ring | pointer | follow | transform | 0.08 s / 0.45 s | — | power3.out |
| Cursor size | link / labelled item | 34 → 56 / 84 px | width, height | 0.4 s | — | cubic-bezier(.22,1,.36,1) |
| Grain | always | 4 offsets | transform | 0.8 s loop | — | steps(4) |

---

## Type, measured

| Role | 1440 | 768 | 375 |
| --- | --- | --- | --- |
| Hero name (Faculty Glyphic 400) | 66.2 px / 1.05 / −0.015em | 44 px | 36 px |
| Hero sub (Inter 300) | 25.9 px / 1.45 / −0.015em | 17.6 px | 16 px |
| Section label (mono, uppercase) | 14 px / 20 px, 0.025em, ink 50 % | 14 px | 14 px |
| Hero / strip labels (mono, uppercase) | 11 px, 0.08em, cream 62 % (prefixes 36 %) | same | same |
| Statement (Inter 300) | 30 px / 1.625 / −0.025em, ink | 30 px | 20 px |
| Process intro (Inter 400) | 20 px / 1.625, ink 65 % | 20 px | 18 px |
| Process title (Faculty Glyphic) | 30 px / 1.2 / −0.025em | 30 px | 24 px |
| Process body (Inter 400) | 18 px / 1.625, ink 65 % | 18 px | 16 px |
| Button (mono, uppercase) | 12 px, 0.18em | same | same |
| Hint (mono, uppercase) | 12 px, 0.025em, ink 40 % | same | same |
| Card caption (Inter 500) | 12.5 px, white 95 % on the image | same | same |
| Footer title (Faculty Glyphic) | 96 px / 1.0 / −0.02em | 68 px | 35 px |
| Footer email (Inter 400) | 36 px | 36 px | 19.5 px |
| Footer links / fine print | 14 px cream 72 % / 12 px cream 40 % | same | same |
| Menu links (Inter 500) | 128 px, −0.045em | smaller | smaller, with → |

Line breaks are deliberate: the hero sub is set as two masked lines; statements wrap naturally inside 52rem.

## Micro-details, measured

- **Hairlines:** always 1 px; ink 15 % on paper, cream 15 % on dark; guides dashed at ink 9 %.
- **Radii:** 1.8 px (thumbnails), 2 px (cards, images), 3 px (preview card, button box), 4 px (buttons). Nothing rounder except the cursor.
- **Shadows:** one warm long shadow, `0 24px 46px -24px rgba(40,18,12,.55)` (preview card), a tighter `0 16px 34px -24px` for ring cards; an 8 % ink inset hairline on thumbnails. No grey shadows.
- **Grain:** fixed full-screen noise at 5 % opacity, jumping between 4 offsets every 0.8 s (`steps(4)`), switched off under reduced motion.
- **Captions:** mono uppercase 11 px for labels and card numbers ("No. 01"); Inter 12.5 px on images.
- **Parentheses:** every section label is `( Word )` with spaces inside.
- **Numbers:** tabular figures for the clock; two-digit indexes (01–05); small mono numbers in the menu.
- **Focus:** 2 px solid outline at 4 px offset on preview words and nav icons; elsewhere the browser default (inconsistent).
- **Selection colour:** not customised.

---

## The 15 details that make it feel premium, and how we reach the same quality our own way

| # | What the reference does | Why it works | How viraajautomates.tech does it (our own version) |
| --- | --- | --- | --- |
| 1 | One easing curve, `cubic-bezier(.22,1,.36,1)`, on every CSS transition | Everything moves with the same "voice" | `--ease` in `tokens.css` and a GSAP ease `house` built from the same four numbers; GSAP only adds expo/power4 for reveals and expo.inOut for wipes |
| 2 | Motion slow to arrive, instant to respond (1.2 s reveals, 0.45 s hovers) | Feels calm but never laggy | Reveals 0.9–1.2 s once; hover/focus states 0.25–0.45 s; nothing waits on a click |
| 3 | A strict label rail: mono labels in columns 1–3 at one x position | The eye always knows where a section starts | Same rail grid (`.rail-grid`); our labels are switchboard "lines" (`( Line 01 · … )`), and they are real `<h2>`s for the outline |
| 4 | One idea per section, one big light paragraph | Reads like a person talking, not a template | Each section has one statement in Inter 300; the services section is the only list, built as rows with a reason for each |
| 5 | Greys are only ink at an opacity | Colour stays warm and coherent | Paper, ink and our plum only; greys are `--ink-15/30/62/65/75`; labels at 62 % (not 50 %) so they pass WCAG AA |
| 6 | Each font has one job (display for names and titles, light sans to read, mono for labels) | Hierarchy without bold | Faculty Glyphic for the name, row titles and the footer line; Inter 300/400 to read; DM Mono for labels, buttons and captions |
| 7 | A signature hero object you can touch (WebGL fabric) | Memorable, and ties to the brand idea | Our braided cream cord: a switchboard cable you can push, grab and pull (physics in a worker), with a still poster on first paint |
| 8 | An intro that is part of the brand story, skippable, never blocking | A moment of theatre that respects time | "Connecting": a cable draws in, its plug seats into a jack, the panel splits and hands over to the hero cord; ≤ 2.5 s, once per session, any input skips |
| 9 | Preview words: underline, highlighter, one card following the pointer, images wiping through | Shows the work exactly where it is mentioned | Same behaviour on the service titles, with our real demo media: Riya's chat, the sheet, the clinic-site video, and a code-drawn "what I fix" card |
| 10 | A ring of printed snapshots that peel off the page and fan out while pinned | Turns a portfolio into one physical gesture | Our cards peel off the service rows and show only real demo screenshots and the demo video, each captioned "Demo"; no empty slots |
| 11 | Scrubbed rows: a hairline draws, the text comes up | The page responds to the reader's pace | Service and process rows use the same grammar (hairline 85 → 55 %, text 0.35 → 1 at 75 → 50 %) |
| 12 | Warm, long, pulled-in shadows only on floating things | Depth without a "UI kit" look | `--shadow-card` and `--shadow-tile` in warm brown, only on the preview card, ring cards, chat and lightbox |
| 13 | Tiny radii (1.8–4 px) and 1 px hairlines | Feels printed and precise | `--r-img 2px`, `--r-card 3px`, `--r-btn 4px`; every rule is 1 px |
| 14 | A custom cursor with words (VIEW, SOON, EMAIL) | Explains interactions without extra UI | Dot + ring with difference blending; the disc says VIEW, PLAY, CHAT, EMAIL, GRAB or PULL depending on what is under it |
| 15 | Live details: a local clock, a jiggling thumbnail, film grain | The page feels alive and made by a person in a place | A live Mumbai clock and an open/closed dot from real working hours, a 5 % grain, and the cord's slow breeze; all off under reduced motion |

### Where we deliberately do better than the reference

- **Accessibility:** focus returns to the menu button after closing (the reference drops focus); one consistent 2 px focus outline everywhere; labels at 62 % ink for contrast; the cursor is off under reduced motion (the reference keeps it).
- **The intro runs once per browser session**, not on every reload, and waits at most 400 ms for fonts.
- **A real 404** in our own style, not an unstyled page.
