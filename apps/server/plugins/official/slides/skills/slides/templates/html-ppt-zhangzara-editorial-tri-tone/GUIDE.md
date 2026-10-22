# Editorial Tri-Tone

Three-color editorial system: dusty pink, mustard cream, and deep burgundy, set in Bricolage + Instrument Serif.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** mixed
- **Formality:** medium-high
- **Density:** medium
- **Slides in example:** 8

**Best for:** Anything that should feel like a fashion-magazine spread: editorial pitches, fashion brand decks, lifestyle media, art direction reviews. Equally good for any deck — including tech, research, or business — that wants tri-tone discipline and serif/sans contrast instead of the usual neutrals.

**Avoid for:** Decks that need to read as soft or comforting — the burgundy/pink/cream tri-tone is intentionally high-contrast and styled.

## Visual system

- **Palette** (`:root`): exactly three inks — dusty pink `#F2B6C6`, mustard cream `#F2D86A`, burgundy `#7A1F35`. The other variable names (`--navy`, `--forest`, `--lime`, `--sky`…) are aliases of these three; never introduce a fourth colour. Slides use them as full-bleed grounds.
- **Type:** Bricolage Grotesque (heavy) for display, Instrument Serif italic for the contrasting word in a title and pull quotes, JetBrains Mono for running heads, section marks (`§ 03 —`) and captions.
- **Signature:** masthead running head across the top, rounded pill tag clouds, giant sans + italic serif title lockups, oversized single figure, § section labels.
- **Slide vocabulary:** `s-cover` (masthead + tag cloud + title lockup) · `s-manifesto` (chapter + numeral + statement + body) · `s-grid` (eight numbered rules) · `s-stat` (one huge figure + explainer) · `s-timeline` (five stages) · `s-chart` (SVG chart + reading notes) · `s-quote` (quote + three short reads) · `s-closer` (checklist + bind lockup).

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` **and** `./assets/deck-stage.js` to `design/<slug>/assets/deck-stage.js`. This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** This template ships `./assets/deck-stage.js` (the `<deck-stage>` web component: ←/→, Space, PgUp/PgDn, Home/End, number keys, R to reset; fixed 1920×1080 canvas auto-scaled and letterboxed). Copy `./assets/deck-stage.js` to `design/<slug>/assets/deck-stage.js` next to `index.html` — the HTML loads it as `assets/deck-stage.js` and navigation silently breaks without it. Each slide is a direct `<section>` child of `<deck-stage>` with a `data-screen-label`; update the labels to the real slides. Do not add your own key handler or scaling.
9. Add `data-section="<id>"` to every slide.

## Speaker notes

`deck-stage.js` reads notes from `<script type="application/json" id="speaker-notes">["…", "…"]</script>` — a JSON array with one string per slide, in slide order. When notes are requested, add that tag; it is never visible on stage.

## Checklist

- [ ] Every slide is built from this template's vocabulary; no foreign layouts, fonts or colours.
- [ ] No example copy, names, contacts or links remain (search the file for the example's distinctive names).
- [ ] Every font stack has the Chinese fallback; Chinese headlines render well and nothing overflows the stage.
- [ ] Page numbers, counters, nav dots and any contents list match the real slides.
- [ ] `assets/deck-stage.js` sits next to `index.html` and arrow-key navigation works.
- [ ] Charts and diagrams carry real or clearly marked placeholder figures, in this palette.
- [ ] `../../craft/anti-ai-slop.md` and `../../craft/typography.md` pass.

## Source & license

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/editorial-tri-tone).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
