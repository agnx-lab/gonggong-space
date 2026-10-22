# Weekly Update

A single-file horizontal-swipe deck for a team's weekly update: one headline number, shipped / in flight / blocked lists with owners, a metrics slide, and next week's asks.

`example.html` is a finished example of this template (8 slides) — study its structure, density and finish, do not copy its copy.

## Resource map

```
weekly-update/
├── GUIDE.md              ← you're reading this
├── example.html          ← finished example; also the seed (CSS + nav script)
└── design-system/
    ├── DESIGN.md         ← default design system (Neutral Modern)
    └── tokens.css        ← its exact values
```

## Design system

Use `./design-system/` (Neutral Modern: `#FAFAFA` canvas, `#111111` ink, cobalt `#2F6FEB` accent, Inter) unless the creation message gives brand colours, fonts or a logo — then adapt the token values to the brand (accent = the brand's primary, neutrals stay quiet, brand fonts replace the display/body faces) and put a supplied logo on the cover and closing slides. `tokens.css` wins over prose in `DESIGN.md` for exact values.

The example ships with its own dark palette. When you seed from it, rebind its `:root` to the design system:

| Example variable | Design-system token |
|---|---|
| `--bg` | `--bg` |
| `--paper` | `--surface` |
| `--paper-2` | a slightly darker surface (`color-mix(in oklab, var(--surface), var(--fg) 4%)`) |
| `--ink` | `--fg` |
| `--muted` | `--muted` |
| `--line` | `--border` |
| `--accent` | `--accent` |
| `--accent-2` | `--success` or a tint of the accent — one secondary hue only |
| `--display` | `--font-body` (+ Chinese fallback) |
| `--mono` | `--font-mono` |

A few colours are hard-coded outside `:root`: the blocked-status pink `#ff6f91` (and its `rgba(255,111,145,…)` tints) becomes `--danger` / `color-mix(in oklab, var(--danger) 18%, transparent)`; the other `rgba(…)` tints become `color-mix` of the matching token. After rebinding, check every place that put `var(--bg)` text on an accent fill (avatars, badges): on a light theme it must use `--accent-on` so labels stay readable.

## Workflow

1. Read `design-system/DESIGN.md` and `tokens.css`.
2. Identify team / squad name, week range, and audience (team-internal vs cross-functional) from the message and attachments.
3. Copy `example.html` to `design/<slug>/index.html`, rebind tokens as above, set `<html lang="zh-CN">` for a Chinese deck and end every font stack with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif`.
4. Slides (replace the example's content slide by slide, keep its classes):
   1. Cover (team + week + author + date)
   2. Headline (one sentence + one number that matters this week)
   3. What shipped (3–5 items, link-style affordance)
   4. In flight (3–5 items, owner avatars)
   5. Blocked (1–3 items + a clear ask)
   6. Metrics that matter (1–2 inline charts, each with the decision or takeaway written above it)
   7. Asks for next week (named owners)
   8. Closing + thanks
5. Keep the example's navigation script (← → / PgUp PgDn, dot nav; each slide is 100vw wide). Add `data-section="<id>"` to every slide.

## Content rules

- Items, owners, dates and numbers come only from the message or attachments. Unknown values are clearly marked placeholders (`【待补：本周 DAU】`), never invented.
- Owner avatars use initials of real people named in the brief; no stock faces.
- Charts are inline SVG / HTML in the design-system palette; every chart has a one-line takeaway above it.
- One anomaly per deck gets the headline treatment; don't spread emphasis across every metric.

## Speaker notes

No notes runtime. When notes are requested, put them in `<aside class="notes" hidden>…</aside>` as the last child of each slide — never visible on stage.

## Checklist

- [ ] All example copy, names and figures replaced; no example people or company left.
- [ ] Tokens rebound to the design system (or brand); no leftover example hex values.
- [ ] Text on accent fills is readable (contrast ≥ 4.5:1).
- [ ] Every metric has a source or is marked as a placeholder.
- [ ] Nothing overflows at 16:9; dot nav count matches the slides.
