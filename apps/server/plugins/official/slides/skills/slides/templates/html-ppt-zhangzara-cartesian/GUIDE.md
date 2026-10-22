# Cartesian

Quiet warm-neutral palette with classical Playfair serifs; tasteful and unhurried.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** high
- **Density:** low
- **Slides in example:** 10

**Best for:** Anything that should feel quiet, considered, and grown-up: investment theses, white papers, advisory work, longform research, gallery / cultural decks. Also a strong choice for editorial features, founder reflections, or any deck where restraint is the message — including across tech and finance.

**Avoid for:** Decks that need visual heat, multiple accents, or a sense of urgency — the warm-neutral palette is intentionally low-energy.

## Visual system

- **Palette** (`:root`): bone `--bg-primary #ede8e0`, stone `--bg-secondary #e2dbd1`, ink `--text-primary #1a1a1a`, grey `#5a5a5a`, taupe accent `--accent #8a8178`, rule `--line #b8b0a4`. No saturated colour — tonal contrast and type only.
- **Type:** Playfair Display for headlines and large numerals (italic for emphasis), Inter (light/regular) for body and tracked uppercase labels.
- **Signature:** small tracked `label` above each headline, generous whitespace, faint concentric `geo-decoration` / `geo-ring` circles, thin rules, nav dots on the right.
- **Slide vocabulary:** `slide-title` · `slide-agenda` (intro + numbered list) · `slide-statement` (one serif quote) · `slide-barchart` (text + Chart.js bar) · `slide-twocol` (image placeholder + text + stats) · `slide-cards` (roman-numeral cards) · `slide-linechart` (full-width Chart.js line) · `slide-timeline` (steps) · `slide-team` (four initials tiles) · `slide-closing`.

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it links no local assets). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, Space, prev/next arrows). Keep it unmodified; the first slide carries `active`; the counter total comes from the slide count, but the nav dots are hard-coded — keep exactly one `.nav-dot` per slide.
9. Add `data-section="<id>"` to every slide.
10. Bar and line charts use Chart.js from the jsDelivr CDN (`chart.js@4.4.7`) with data and colours in the script at the end (`barChart`, `lineChart`). Replace the labels and datasets with the real numbers, keep the neutral styling; delete a chart's script block if you drop its slide.

## Speaker notes

This template has no notes runtime. When notes are requested, put them in `<aside class="notes" hidden>…</aside>` as the last child of each slide — never visible on stage.

## Checklist

- [ ] Every slide is built from this template's vocabulary; no foreign layouts, fonts or colours.
- [ ] No example copy, names, contacts or links remain (search the file for the example's distinctive names).
- [ ] Every font stack has the Chinese fallback; Chinese headlines render well and nothing overflows the stage.
- [ ] Page numbers, counters, nav dots and any contents list match the real slides.
- [ ] Charts and diagrams carry real or clearly marked placeholder figures, in this palette.
- [ ] `../../craft/anti-ai-slop.md` and `../../craft/typography.md` pass.

## Source & license

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/cartesian).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
