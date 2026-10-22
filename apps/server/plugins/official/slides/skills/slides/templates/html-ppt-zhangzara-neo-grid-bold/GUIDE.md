# Neo-Grid Bold

Editorial neo-brutalism with a single neon yellow accent on off-white paper.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** medium
- **Density:** high
- **Slides in example:** 12

**Best for:** Anything that should feel confident and editorial-graphic: design-led pitches, portfolios, brand work, founder talks, conference keynotes. Excellent for stat-heavy slides, comparisons, and process flows. Just as strong for tech, research, or finance when the speaker wants to read as design-led rather than corporate.

**Avoid for:** Contexts that need to feel quiet, traditional, or warm — the neon-yellow accent and uppercase display commit to a confident editorial voice.

## Visual system

- **Palette** (`:root` in `example.html`): off-white `--bg #ECECE8`, paper `--paper #F5F4EF`, ink `--ink #0A0A0A` (also every line), muted `#8A8A85`, one neon accent `--accent #E6FF3D`.
- **Type:** Space Grotesk (uppercase, heavy, tight) for display and body; JetBrains Mono for indices, labels and data.
- **Signature:** thick black grid rules dividing the canvas into cells, neon-yellow blocks as the only colour, numbered section indices.
- **Slide vocabulary** (example order): `s-cover`, `s-toc`, `s-stats`, `s-features`, `s-chart`, `s-section`, `s-quote`, `s-cta`, `s-consult` (text-dense action title), `s-chart2`, `s-process2`, `s-matrix2`.
- Use the neon accent on one block or highlight per slide; it is a signal, not a fill colour.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/neo-grid-bold).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
