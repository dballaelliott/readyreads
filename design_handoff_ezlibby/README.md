# Handoff: ezlibby — "Friendly & Plain" design language (Direction D)

## Overview
**ezlibby** is a browser-only companion that takes a reader's want-to-read list
(Goodreads CSV export or an RSS shelf link) and sorts it by what they can borrow
*right now* from their public library via Libby/OverDrive. Titles are grouped into
tiers — **Ready to read** (ebook available), **Listen instead** (audiobook in, ebook
isn't), **Worth the wait** (on hold), and a collapsed **Failed to match** archive.
Everything runs client-side; nothing is sent to a server.

This bundle documents **Direction D ("Friendly & Plain")** — the chosen visual
language — in both its desktop and mobile forms, including the three loading states.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** —
prototypes that show the intended look and behavior. They are **not** production code
to copy verbatim (they use in-browser Babel, inline styles, and a stub data file).

Your task is to **recreate these designs in the target codebase**, using its existing
framework, component library, styling system, and conventions. If the project has no
frontend yet, pick the most appropriate stack and implement there. Treat the inline
styles below as a **spec** (exact tokens are listed in "Design Tokens"), not as code
to paste.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final. Recreate
the UI pixel-accurately using the codebase's own primitives. The numbers in this doc
are the source of truth.

---

## Files in this bundle
| File | What it is |
|---|---|
| `ezlibby mobile (D).html` | **The primary reference.** Standalone interactive mobile prototype. Open in a browser; tap the primary button to cycle empty → loading → populated. |
| `mobileD.jsx` | React source for the mobile prototype (all three states + state machine). |
| `dirD.desktop.jsx` | React source for the desktop/wide layout of the same language (populated state). |
| `data.jsx` | Sample book data + counts used by both (`window.EZ_BOOKS`, `window.EZ_COUNTS`). Stub only — replace with real library-availability data. |

> Note: the desktop file uses a slightly minty background (`#EEF5F3`) and ~0.8× type
> sizes. The **mobile file is the canonical, most up-to-date treatment** (near-white
> background, larger type). Prefer the mobile tokens below and scale down for wide
> viewports.

---

## Design Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7FBFA` | Page background (near-white, faint cool tint) |
| `fill` | `#ECF3F1` | Input / button / pill / skeleton fills |
| `ink` | `#163A38` | Primary text, wordmark, titles (deep teal — not pure black) |
| `soft` | `#5E7C7B` | Secondary text (bylines, taglines) |
| `faint` | `#A6BAB8` | Tertiary text (eyebrow, review counts, "audio (2w)", footnotes) |
| `green` | `#0F9460` | Availability = available now; "synced"; positive summary |
| `blue` | `#2D6FD6` | Primary actions (Refresh, Check availability), progress bar |

Only two accent hues — **green = available, blue = action**. No reds, no other colors.

### Typography — family
**Figtree** (Google Fonts), weights 400/500/600/700/800. Single family everywhere —
**no serif, no monospace anywhere in this direction.**
Fallback stack: `"Figtree", system-ui, sans-serif`.

### Typography — scale (mobile / canonical)
| Role | Size | Weight | Letter-spacing | Line-height | Color |
|---|---|---|---|---|---|
| Eyebrow ("PUBLIC LIBRARY COMPANION") | 12 | 700 | .16em, UPPERCASE | — | faint |
| Wordmark ("ezlibby") | 58 | 800 | -.04em | .95 | ink |
| Tagline | 18 | 500 | — | 1.4 | soft |
| Group heading ("Ready to read") | 30 | 800 | -.02em | 1.2, **no wrap** | ink |
| Group count pill | 15 | 700 | — | — | soft on `fill`, radius 999, pad 3×11 |
| Summary line | 19 | 700 | — | — | green + faint |
| Book title (link) | 23 | 700 | -.01em | 1.22 | ink |
| Byline ("by Author") | 16 | 500 | — | — | soft |
| Availability label | 15 | 700 (avail) / 500 (wait) | — | — | green / faint |
| Rating number | 34 | 800 | -.02em | 1 | ink |
| Review count | 16 | 600 | — | — | faint |
| Primary button | 16–18 | 700 | — | — | white on blue |
| Hint / footnote | 13.5 | 500–600 | — | 1.5 | faint |

For **desktop/wide**, multiply sizes by ~0.8 (wordmark 46, group heading 23, title 19,
rating number 29, review count 14, summary 17) — see `dirD.desktop.jsx`.

### Radius
- Inputs / buttons: **13–14px**
- Masthead/controls card (desktop): **22px**
- Pills (count chips, "synced"): **999px** (full round)
- Phone frame (prototype chrome only): 46px

### Spacing
- Page padding: 24px horizontal (mobile)
- Book row vertical padding: **17px** top & bottom (15px desktop)
- Gap between group heading and first row: 4px
- `margin-top` between groups: **36px** (34px desktop)
- Gap between the two availability labels: 18px
- Status/summary block top margin: ~22px
- **No dividers/rules anywhere.** Row separation is whitespace only — do not add
  borders, hairlines, or background cards between book rows.

### Shadows
- None on content. The only shadow in the bundle is the phone-frame chrome in the
  prototype HTML, which is **not** part of the product UI — omit it.

---

## Screens / Views

### Masthead (all states)
- Left-aligned. Eyebrow (uppercase, faint) → wordmark "ezlibby" (huge, 800) →
  tagline (soft).
- Desktop places masthead + controls together inside one white rounded card
  (radius 22) sitting on the page background; a small green **"● synced"** pill
  (green dot + label) floats top-right of that card.
- Mobile drops the card — masthead sits directly on the near-white background; no
  synced pill (kept minimal).

### Controls
- **Library identifier** text input (default value shown: `lapl`), `fill` background,
  no border, radius 13–14.
- **Import** affordance: full-width button "↑ Import a Goodreads CSV or paste a link"
  (`fill` bg, `soft` text, left-aligned). On desktop this and the library field share
  a row with the Refresh button.
- **Refresh** button: blue, white text, 700 weight, "↻ Refresh all" (wide) / "↻ Refresh"
  (mobile compact). The ↻ glyph spins (CSS rotate, .7s linear infinite) while loading.
- A small "▸ Settings" disclosure (faint) holds an optional RSS-proxy URL (not built
  out in the mock — a single optional text field).

### Book row (the core component)
Two-column flex, vertically centered, 17px vertical padding, **no divider**:
- **Left (flex:1):**
  - Title — link, 23/700/ink. Links to the book's Libby title page. Wraps to 2 lines
    gracefully.
  - Byline — "by {author}", 16/500/soft.
  - Availability row (18px gap): two labels, **ebook** then **audio**.
    - If available now → label is just the format word (`ebook`), green, 700.
    - If not → format word + wait in parens (`audio (2w)`), faint, 500. (The `~`
      prefix from the data is stripped; `waitlist` shown as `(waitlist)`.)
- **Right (fixed):** rating block, center-aligned column:
  - Rating number `4.2`, 34/800/ink.
  - Review count `712k` directly beneath, 16/600/faint.
  - These two are width-matched on purpose — the 4-glyph count reads about the same
    width as the 2-digit rating. **No star/pip glyphs** — number only.

### Group
- Heading (30/800, **nowrap**) + count pill (rounded, `fill` bg) inline.
- No rule under the heading. Rows follow with 4px gap.
- Order: **Ready to read**, **Listen instead**, **Worth the wait**.

### Failed to match
- A collapsed `<details>` at the bottom: summary "Failed to match (N)" (700/soft),
  expands to a plain list of unmatched titles. No ratings/availability.

### Footer
- Centered, faint, 13.5: "Everything runs in your browser. Nothing leaves this page."

---

## Interactions & Behavior

### The three states
1. **Empty** — masthead + controls + centered prompt ("Let's find your next read." +
   subcopy) + big blue primary CTA "↻ Check availability" + hint line.
2. **Loading** — compact controls (with spinning ↻); a status line
   "⟳ Checking {n} / {total}…" (small spinner + count) with "{found} found" in green
   on the right; a blue progress bar (`width = n/total`); then the first matched
   titles already rendered as real rows under "Ready to read", followed by 2 skeleton
   rows labeled "checking…". In the prototype `n` animates ~34→61 to feel live.
3. **Populated** — compact controls + summary line ("{available} available now ·
   {total} titles", available in green) + the three groups + Failed-to-match + footer.

### Real-app behavior (what the prototype stands in for)
- Tapping **Refresh / Check availability** kicks off availability checks against the
  library. Results **stream in live** — each title flips from skeleton → real row as
  its check resolves, and rows **re-sort into their tier** as data arrives.
- **Cached** results render instantly (with an "updated Nh ago" age — present in the
  data model as `updated`; the desktop editorial mock shows it, D currently omits it,
  surface it if useful).
- Per-title **re-check**: the spec calls for a small ↻ on each row to re-check one
  title. Direction D omitted it for minimalism — add a subtle per-row refresh if
  product wants it.
- **Prototype shortcut:** in `ezlibby mobile (D).html` the primary button simply
  **cycles** empty → loading → populated → empty so all states are reviewable. This
  is a demo affordance, *not* the real flow — implement the streaming behavior above.
- A URL hash (`#empty` / `#loading` / `#populated`) force-selects a state; state also
  persists to `localStorage` under `ezd-state`. Both are prototype conveniences.

### Animation
- Spinner: 16px ring, 2.5px border, top border `blue`, `rotate 360deg .7s linear
  infinite`.
- Progress bar fill: `transition: width .2s`.
- Keep motion minimal otherwise.

### Responsive
- Single column throughout. Mobile is full-bleed on `bg`; wide viewports cap the
  reading column (~600px) and may reintroduce the masthead/controls card.
- The rating block stays right-aligned; on very narrow widths it remains a fixed
  right column (title wraps in the remaining space).

## State Management
- `state`: one of `empty | loading | populated`.
- During loading: `checkedCount` (n of total), `foundCount`, and a per-title status
  map (`pending | matched | available | hold | failed`) that drives which tier each
  title lands in and whether it shows as skeleton or real row.
- Data fetching: parse Goodreads CSV / fetch RSS shelf (optionally via the
  Settings RSS-proxy URL), then query library availability per title. All client-side.

## Data model (see `data.jsx`)
Each book: `{ title, author, rating (number), reviews (e.g. "712k"), ebook, audio,
updated }` where `ebook`/`audio` are `"now" | "waitlist" | "~Nw"`. Tiers in the stub:
`ready | listen | wait | failed`. `EZ_COUNTS = { available, total, checked }`.
**This is placeholder data — wire to real Libby/OverDrive availability.**

## Assets
- **Font:** Figtree (Google Fonts) — load the family or self-host.
- No images, no icon set. The only glyphs used are the Unicode arrows/marks
  `↻ ↑ ▸ ●` and they can be replaced with the codebase's icon system.
- No logo file — "ezlibby" is set type (Figtree 800), not an image.
```
