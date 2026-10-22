# Mat

Dark sage canvas with bone paper and burnt-orange accent; mid-century modern with wood undertones.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** mixed
- **Formality:** medium
- **Density:** medium
- **Slides in example:** 9

**Best for:** Anything that should feel mid-century, tactile, and intentional: design studio credentials, architecture / interior brands, ceramics / craft / furniture, advisory decks. Also a warm, distinctive choice for tech, research, or business decks that want a considered analog feel instead of digital-cool.

**Avoid for:** Contexts that need fast tech energy or institutional restraint — the muted sage and burnt-orange palette is intentionally warm and slow.

## Visual system

- **Palette** (`:root`): dark sage `--c-bg #232e26` (alt `#2e3d30`), bone type `--c-fg #f0e8d2`, bone paper `--c-bg-light #ede6d0` for `light` slides and `info-card`s, burnt orange `--c-accent #c07030`, wood `--c-wood #7a4e24` for tactile detail.
- **Type:** Bricolage Grotesque for display headlines, DM Sans light for body, DM Mono for chrome labels and sources; Noto Sans SC is already in the stacks.
- **Signature:** mono `slide-chrome` header with section + page number, bone `info-card` panels on the dark canvas, warm radial glow, thin rules, burnt-orange kicker labels and the single lit bar.
- **Slide vocabulary** (`slide--*`): `cover` (headline + copy + info card) · `statement` (governing thought + bullets) · `split` (driver-tree placeholder between text columns) · `stats` (three `mat-stat`s) · `quote` · `list` (ranked options) · `compare` (two horizons with divider) · `chart` (CSS bar columns + source) · `end` (ask + info card).

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it links no local assets). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, ↑/↓, swipe). Keep it unmodified; slides sit side by side and the track moves by `translateX`; keep `data-slide` sequential and renumber the static chrome page numbers by hand.
9. Add `data-section="<id>"` to every slide.
10. The split slide's `img-placeholder` stands in for a diagram: rebuild it as a real HTML/SVG diagram in this palette or keep it as a labelled placeholder.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/mat).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
