# Pink Script — After Hours

Black canvas, hot pink accent, pearl-cream paper, Instrument Serif headlines: late-night editorial luxury.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** dark
- **Formality:** medium-high
- **Density:** low
- **Slides in example:** 9

**Best for:** Anything that should feel nocturnal, intentional, and a little luxe: lifestyle and creator personal brands, fashion and nightlife launches, anniversary or event retrospectives, editorial features. Also a striking pick for a keynote or pitch that wants magnetic confidence.

**Avoid for:** Daytime corporate-professional and traditional B2B contexts where the dark canvas with hot-pink accent reads as too styled or too expressive.

## Visual system

- **Palette** (`:root` in `example.html`): black canvas `--ink #060507` (raised `#0F0D11`), pearl-cream paper `--paper #F5EDF1`, hot pink `--pink #ED3D8C` (bright `#FF66A8`, deep `#B81D67`); hairlines and muted text are translucent pink/cream (`--line`, `--mute`, `--hair`).
- **Type:** Instrument Serif headlines (large, often italic), Inter body, JetBrains Mono for indices and captions.
- **Signature:** generous black space, hot-pink as a single spotlight, hairline rules, low density — one idea per slide.
- **Slide vocabulary** (example order): `s-cover`, `s-toc` (the index), `s-stats`, `s-section` (the turn), `s-chart` (the curve), `s-process`, `s-matrix` (then & now), `s-quote`, `s-cta` (encore).
- Density is low by design: if a slide needs more than ~40 Chinese characters of body, split it.

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` and `./assets/deck-stage.js` to `design/<slug>/assets/` (the deck links them relatively). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links.
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the `--f-*` / font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the `<deck-stage>` web component in `./assets/deck-stage.js`: ←/→, Space, PgUp/PgDn, Home/End, number keys, `R` to restart; it scales a fixed 1920×1080 canvas to the viewport and prints one slide per page. Keep it unmodified; slides are its direct `<section>` children.
9. Add `data-section="<id>"` to every slide.

## Speaker notes

Speaker notes go in the `<script type="application/json" id="speaker-notes">` tag as a JSON array of strings, one per slide in order (deck-stage reads it). Replace or empty the example's array; without `演讲者备注：是` use `[]`.

## Checklist

- [ ] Every slide is built from this template's vocabulary; no foreign layouts, fonts or colours.
- [ ] No example copy, names, contacts or links remain (search the file for the example's distinctive names).
- [ ] Every font stack has the Chinese fallback; Chinese headlines render well and nothing overflows the 16:9 stage.
- [ ] Page numbers, counters and the table of contents match the real slides.
- [ ] Charts and diagrams are inline SVG / HTML in this palette, with real or clearly marked placeholder figures.
- [ ] `../../craft/anti-ai-slop.md` and `../../craft/typography.md` pass.

## Source & license

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/pink-script).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
