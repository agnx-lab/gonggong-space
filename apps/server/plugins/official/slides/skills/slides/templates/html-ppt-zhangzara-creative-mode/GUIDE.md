# Creative Mode

Cream paper canvas with confident multi-color (green, pink, orange, yellow) accents and Archivo Black display.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** medium
- **Density:** medium-high
- **Slides in example:** 8

**Best for:** Anything that should feel design-led and confident: creative agency pitches, design studio decks, ad shop credentials, brand creative reviews, art-direction reviews. Also a great unexpected pick for a tech talk, research findings, or finance review when the speaker wants to lead with taste rather than convention.

**Avoid for:** Contexts that demand institutional restraint and a quiet authority — the saturated multi-accent palette will read as expressive, not formal.

## Visual system

- **Palette** (`:root`): cream `--cream #EFE9D9` (alt `#E4DCC4`), forest green `--green #1F8A4C`, hot pink `--pink #F06CA8`, orange `--orange #E85A1F`, mustard `--yellow #F5C518`, ink `--ink #0F0F0F` for structure and rules.
- **Type:** Archivo Black for uppercase display headlines and big numerals, Space Grotesk for body, JetBrains Mono for kickers, topbar and figure notes.
- **Signature:** mono `topbar` (project · section · `NN • NN`), flat colour blocks with hard offset shapes, black hairline frames, pill tags, a rotated `stamp` on the closer.
- **Slide vocabulary** (`s1`–`s8`): title (wordmark + colour-block illustration) · intro (section marker + headline + body) · four-cell numbers `grid` · stacked isometric `blk` diagram with legend · grouped bar `chart` with y-axis · four-step `flow` · deliverables `table` with colour badges · closing stamp + strap.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/creative-mode).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
