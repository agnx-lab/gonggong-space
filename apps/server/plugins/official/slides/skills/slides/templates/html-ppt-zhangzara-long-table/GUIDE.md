# Long Table

Warm cream and rust-red supper-club aesthetic with bold uppercase grotesk headlines, italic Fraunces, and pill-shaped outlined buttons.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** medium
- **Density:** medium
- **Slides in example:** 8

**Best for:** Anything that should feel like a warm, intimate, modern hospitality / community brand: supper clubs, dinner series, small restaurants, creative-studio events, membership pitches, lifestyle and wine brands. Equally good for any deck wanting a single warm accent colour, italic-meets-bold typography, and a social-media-aware modern-editorial voice.

**Avoid for:** Decks that need corporate polish, technical density, or a cold / minimalist register — the rust-red palette and bold-italic mix are intentionally warm and people-facing.

## Visual system

- **Palette** (`:root`): buttery cream `--paper #FAF1E2` (deeper `#F2E5CF`, `#E8D7B6`), rust-red `--ink #B53D2A` (deep `#8E2D1F`) for all type, rules, pill borders and outlined cards. Strictly bichromatic.
- **Type:** Bricolage Grotesque (800, uppercase) for hero and chapter titles, Fraunces italic for body, captions, pill labels and taglines, Fraunces roman for figures.
- **Signature:** circled monogram badge + italic category label top-left, outlined pill tags with `/` dividers, an oversized italic Fraunces number on the cover, thin rust frames and rules, italic `NN / NN` page numbers.
- **Slide vocabulary:** `s-cover` (title + pills + giant figure) · `s-manifesto` (headline answer + emphasised body + signature) · `s-index` (three numbered driver cards) · `s-featured` (lede + stats line + info rows) · `s-menu` (roman-numeral `courses` list with values, like a menu) · `s-quote` · `s-cal` (ledger table with status pills) · `s-closing` (recommendation + action pills).

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it links no local assets). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, Space, PgUp/PgDn, Home/End, swipe). Keep it unmodified; the first slide carries `active`, the script moves it. Page numbers (`.pagenum`) are static text — renumber them by hand.
9. Add `data-section="<id>"` to every slide.
10. Replace the cover monogram (the example's `OD` badge) with the user's own initials or remove it.
11. Layout is sized in viewport units for 16:9; with Chinese text keep cover figures short so the giant number is not clipped at the right edge.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/long-table).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
