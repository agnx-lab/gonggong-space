# Broadside

Dark editorial canvas with a single fire orange accent and bilingual Latin/Chinese type stack.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** dark
- **Formality:** medium-high
- **Density:** medium
- **Slides in example:** 16

**Best for:** Anything that should land like a broadside newspaper headline: brand manifestos, magazine and cultural pitches, design talks, bilingual EN/CN decks, founder vision statements. Also a striking pick for tech, research, or business decks that want a dramatic single-accent editorial feel.

**Avoid for:** Decks that need to feel quiet, warm, or institutionally traditional — the dark canvas with fire-orange accent commits to drama.

## Visual system

- **Palette** (`:root`): near-black `--c-bg #111111` (alt `#1a1a18`), cream `--c-fg #f0ece5` with greys `#888880` / `#505048`, fire orange `--c-accent #e85d26` (also the full-bleed ground of `orange` slides). Slides alternate `orange` and `dark`.
- **Type:** Barlow (800–900 for lower-case display headlines) with Noto Sans SC already in every `--f-*` stack; IBM Plex Mono for chrome labels, counters and sources.
- **Signature:** giant lower-case display words, huge outlined `broadside-num` page numerals, mono `slide-chrome` header and `slide-foot`, thin rules, staggered entrance animations via `data-anim` / `data-delay`.
- **Slide vocabulary** (`slide--*`): `cover` · `chapter` · `statement` · `split` (text + image placeholder) · `stats` · `fadelist` (stacked words fading out) · `list` · `quote` · `compare` (before/after panels) · `chart` (CSS bar columns) · `diagram` (flow steps with arrows) · `pie` (CSS donut + legend) · `pyramid` · `vtimeline` · `cycle` (2×2 loop) · `end`.

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it links no local assets). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, ↑/↓, swipe). Keep it unmodified; slides sit side by side and the track moves by `translateX`; nav dots and the counter are built from the slide count, and `is-active` re-plays the `data-anim` entrances.
9. Add `data-section="<id>"` to every slide.
10. The example's `img-placeholder` stands in for a photo: keep it as a labelled placeholder or use a real image the user supplied — never a stock or third-party image.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/broadside).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
