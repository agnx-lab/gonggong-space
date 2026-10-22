# Capsule

Modular pill-shaped cards on warm bone with a full pastel-pop palette.

`example.html` is a finished example of this template — study its structure, density and finish, do not copy its copy.

A single self-contained HTML deck — typography, palette, decorative system and slide vocabulary are tuned together. Mixing layouts across templates breaks the system; stay inside this one.

## At a glance

- **Scheme:** light
- **Formality:** medium-low
- **Density:** medium
- **Slides in example:** 10

**Best for:** Anything that should feel modular, modern, and a little Y2K: lifestyle brands, creator portfolios, DTC launches, beauty / wellness, agency credentials. Also fun for a playful tech demo or a research deck that wants pop-art clarity instead of gravitas.

**Avoid for:** Contexts that require traditional institutional weight — the capsule shapes and pastel pops actively soften authority.

## Visual system

- **Palette** (`:root`): bone `--bg #F5F5F0`, ink `--fg #1A1A1A` and `--outline #1E1E1E`, pastels `--coral #E85D4E`, `--lime #C4D94E`, `--lavender #C5B5E0`, `--sky #8BB4F7`, `--violet #A06CE8`, `--yellow #F2D160`, `--peach #F5B895`, `--mint #A8E6CF`, applied through `pill-*` classes.
- **Type:** Bodoni Moda (high-contrast Didone) for the big names and titles, Space Grotesk for pills, labels and body.
- **Signature:** outlined capsule pills — scattered `deco-pill`s with one-word keywords on cover/closing, `orbit-pill`s circling a centre, pill-shaped chart bars, timeline nodes and stat bars; soft drop shadow, never hard edges.
- **Slide vocabulary:** cover (centre `title-pill` + name + scattered keyword pills) · intro (text + orbit visual) · three `pillar-card`s · horizontal pill `chart-container` · statement quote with `quote-highlight`s and floating pills · quarter `timeline` · four `stat-pill`s · `diagram-container` (node → connector → node) · `visual-frame` + text pills · closing pill cloud.

## Build

1. **Seed:** copy `./example.html` to `design/<slug>/index.html` (it links no local assets). This is the only starting point — never write the deck from scratch and never mix in another template's layouts, fonts or colours.
2. **Replace content slide by slide** in this template's own vocabulary: keep each slide's markup and classes, swap in the real headlines, body copy, numbers, names, dates and section labels. Match existing dimensions when swapping image placeholders.
3. **Preserve the design system.** Never substitute fonts, recolour the palette, restructure the layout grid, or strip decorative elements (rules, textures, shapes, illustrated SVGs) — they are the identity.
4. **Adjust length by duplicating layouts.** More content: duplicate the existing slide of the most appropriate layout. Less: drop slides. Update every page number, counter and label to the real count.
5. **Missing layout:** design it from this template's fonts, palette, decorative vocabulary, spacing rhythm and component grammar — never bail to a different template.
6. **Strip the example.** Remove its people, organisations, e-mail addresses, URLs, citations and project names; carry over no third-party marks or links (GitHub, Discord, X, tool credits, etc.).
7. **Chinese.** `<html lang="zh-CN">`, copy in the creation message's language. Every font stack (including the font variables in `:root`) ends with a Chinese fallback — sans: `"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif`; serif: `"Songti SC","Noto Serif SC",serif` (use the serif fallback where the Latin face is a serif). Google Fonts `<link>`s may stay. Latin display faces have no CJK glyphs, so check the cover and section headlines with real Chinese text; drop wide letter-spacing and `text-transform: uppercase` tracking on labels that become Chinese (≤ 0.05em).
8. **Runtime.** Navigation is the inline script at the end of the file (←/→, ↑/↓, Space, Home/End, swipe). Keep it unmodified; slides are matched by `data-slide="N"` (1-based) and the nav dots are hard-coded in the markup: when you add or remove slides, renumber `data-slide` on slides and keep exactly one `.nav-dot[data-slide]` per slide, and fix the static `/ 10` total in `.slide-counter`.
9. Add `data-section="<id>"` to every slide.
10. Decorative keyword pills are content too: rewrite them with words from the real subject, 1–2 Chinese words each.

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

Vendored from upstream MIT-licensed [`zarazhangrui/beautiful-html-templates`](https://github.com/zarazhangrui/beautiful-html-templates/tree/main/templates/capsule).

The full upstream MIT license text — including the original copyright notice — ships in this template at [`LICENSE`](./LICENSE) and must be redistributed alongside any copy of `example.html` or any vendored `assets/` runtime.
