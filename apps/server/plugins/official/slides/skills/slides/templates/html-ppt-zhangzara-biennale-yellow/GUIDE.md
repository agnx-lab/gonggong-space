# Biennale Yellow

Solar yellow on warm parchment with deep indigo serif and atmospheric sun-glow gradients.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** high
- **Density:** medium
- **Slides in example:** 8

**Best for:** Anything that should feel like an art-biennale poster or a museum's annual programme: exhibition decks, arts-institution announcements, design conference brochures, curatorial pitches, literary publications, studio retrospectives. Equally good for any deck wanting Dutch-editorial atmosphere with an unmistakable single-color signature.

**Avoid for:** Decks that need visual punch or saturated multi-color energy — the warm-paper canvas and one-yellow palette are intentionally quiet and atmospheric.

## Visual system

- **Palette** (`:root`): parchment `--paper #E9E5DB` (deep `#DCD6C4`), solar yellow `--sun #F1EE2E` (soft `#F8F39B`), indigo ink `--ink #1B2566`, ember `--ember #E26B4A`, haze `--haze #F0DA7C`. Yellow is the single signature; ember only bleeds from corner gradients.
- **Type:** Instrument Serif for display (roman + italic second line), Archivo for body and tracked uppercase captions, JetBrains Mono for page numbers, tables and figures.
- **Signature:** overlapping flat yellow `blocks` and a blurred `sunglow` / `glow` / `haze` gradient behind huge indigo serif titles; hairline `date-rail` / `footer-row` columns of small captions; `NN / NN` page numbers bottom-right.
- **Slide vocabulary:** `s-cover` (title + block collage + four-column caption rail) · `s-manifesto` (one large serif statement + attribution) · `s-programme` (numbered `strands`, rule · title · detail) · `s-chapter` (big chapter numeral + lede) · `s-data` (stats column + bar `chart` with one `lit` bar) · `s-quote` (`qbody` with a yellow `yblock`) · `s-cal` (ledger table: Nº · item · detail · tag) · `s-colophon` (closing blocks + contacts).

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it links no local assets). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, Space, PgUp/PgDn, Home/End, swipe). Keep it unmodified; the first slide carries `active`, the script moves it. Page numbers (`.pagenum`, `NN / NN`) are static text — renumber them by hand.
9. Add `data-section="<id>"` to every slide.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/biennale-yellow).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
