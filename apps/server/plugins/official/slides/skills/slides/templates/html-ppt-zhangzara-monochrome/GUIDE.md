# Monochrome

Ivory ledger paper with all-black type; Lora serif headlines, Jost body, no color at all.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** high
- **Density:** high
- **Slides in example:** 16

**Best for:** Anything that should feel like a hand-typeset ledger: user research synthesis, white papers, longform reports, academic and policy briefs, advisory deliverables, bilingual reports. Equally good for tech, design, or brand decks that want their words to be the only thing on the page.

**Avoid for:** Decks that need visual personality or color-led storytelling — the all-ink palette is intentionally austere.

## Visual system

- **Palette** (`:root` in `example.html`): ivory ledger paper `--c-bg #fafadf` (alt `#f2f2d2`, cream `#f5f0e4`), ink `--c-fg #1a1a16` with greys `#5e5e54` / `#8a8a80`. The accent *is* the ink — there is no colour. `dark` slides invert to ink ground.
- **Type:** Lora serif for display moments, Jost (weights 200–300 for headlines, 400 body) for everything else, JetBrains Mono for labels and numbers. Sizes are vw-based tokens (`--sz-*` in `:root`).
- **Signature:** left `.slide-sidebar` with context labels, thin hairline rules as pauses, oversized weight-200 headlines, mono chrome header/footer on every slide.
- **Slide vocabulary** (example order): `slide--cover`, `slide--chapter` (dark), `slide--statement`, `slide--split`, `slide--stats`, `slide--list`, `slide--compare`, `slide--quote` (dark), `slide--dense`, `slide--chart`, `slide--diagram`, `slide--pie`, `slide--vtimeline`, `slide--cycle`, `slide--pyramid`, `slide--end` — each combined with `light` or `dark`.
- Charts, pie, cycle and pyramid are drawn in pure ink: differentiate series by fill weight, hatching and labels, never by hue.

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it is fully self-contained). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links.
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the `--f-*` / font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, Space and the other keys it already handles). Keep it unmodified; the first slide carries `active`, the script moves it.
9. Add `data-section="<id>"` to every slide.

## Speaker notes

This template has no notes runtime. When notes are requested, put them in `<aside class="notes" hidden>…</aside>` as the last child of each slide — never visible on stage.

## Checklist

- [ ] Every slide is built from this template's vocabulary; no foreign layouts, fonts or colours.
- [ ] No example copy, names, contacts or links remain (search the file for the example's distinctive names).
- [ ] Every font stack has the Chinese fallback; Chinese headlines render well and nothing overflows the 16:9 stage.
- [ ] Page numbers, counters and the table of contents match the real slides.
- [ ] Charts and diagrams are inline SVG / HTML in this palette, with real or clearly marked placeholder figures.
- [ ] `../../craft/anti-ai-slop.md` and `../../craft/typography.md` pass.

## Source & license

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/monochrome).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
