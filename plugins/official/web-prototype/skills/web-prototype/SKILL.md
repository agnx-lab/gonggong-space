---
name: web-prototype
description: >-
  Build a single self-contained desktop web page prototype (SaaS landing page, event registration page,
  brand homepage, product docs home) from a bundled seed HTML, section layouts and a design system, write
  it to design/<slug>/index.html in the workspace and publish it with preview_static. Use when a creation
  request names this plugin, or when someone asks for a landing page, marketing page, homepage, docs index,
  event sign-up page, web mockup or web prototype.
---

# Web Prototype Skill

Produce a single, self-contained HTML prototype using the bundled seed and layout library — **not** by writing CSS from scratch. The seed already encodes good defaults (typography, spacing, accent budget). Your job is to compose it.

## Resource map

All paths below are relative to this skill's directory.

```
web-prototype/
├── SKILL.md                    ← you're reading this
├── assets/
│   └── template.html           ← seed: tokens + class system + chrome (READ FIRST)
├── references/
│   ├── layouts.md              ← 11 paste-ready section skeletons
│   ├── checklist.md            ← P0/P1/P2 self-review
│   └── craft/                  ← anti-ai-slop.md, color.md, typography.md
└── design-systems/
    ├── neutral-modern/         ← DESIGN.md + tokens.css (the default)
    └── warm-editorial/         ← DESIGN.md + tokens.css
```

## What the creation message gives you

A creation request is a chat message that @-mentions you. It names:

- the **template** (`saas`, `event`, `brand` or `docs`, possibly by its Chinese title);
- the **design system directory**, e.g. `design-systems/warm-editorial`;
- whether to explore visual directions first — `先出视觉方向：是` / `否`;
- parameters as `label：value` lines: `主标题` (title, required), `核心卖点` (key selling points), `目标受众` (audience), `语气` (tone: `专业` / `亲切` / `活泼`);
- optionally attachments (logos, photos, copy) — use them, they beat anything you would fetch.

A plain request without this structure is fine too: infer the closest template, use `neutral-modern`, and do not explore directions.

## Interaction rules

- **Ask at most one round, only when required information is missing.** The only hard requirement is something to put in the headline (the title, or a product/event/brand name you can derive one from). If it is missing and cannot be inferred from the message or attachments, call `ask_group_members` once with every open question in that single call (≤ 4). After that round — answered or timed out — proceed with your best judgement and list the assumptions in your final reply. Never ask a second round.
- **Otherwise go straight to the draft.** Do not ask for confirmation of the section plan, colours or copy.
- **Visual directions first, only when the message says `先出视觉方向：是`.** See Step 2.

## Templates and their rhythm

Each template has its own section rhythm. Numbers refer to layouts in `references/layouts.md`. Drop a section rather than pad it.

| Template | Page | Rhythm | Pacing notes |
|---|---|---|---|
| `saas` | SaaS 落地页 | 1 hero-center → 3 features → 4 stats *or* 5 quote → 9 split detail → 8 comparison table (only with real pricing/plans) → 6 cta-strip | Product-led and dense in the middle. The hero states the change for the user; features name user value, not technology. |
| `event` | 活动报名页 | 2 hero-split (date and venue in the eyebrow) → 7 log list as the agenda (times in `.meta`) → 3 features as "who should come / what you leave with" → 5 quote (only a real past attendee) → 10 registration form | Time-boxed and practical. No CTA strip — the page ends on the form; the topnav CTA anchors to it. |
| `brand` | 品牌官网首页 | 2 hero-split (real brand imagery) → 5 pull quote as the brand statement → 9 split detail (story, `grid-2-1`) → 11 entry grid (product lines / offerings) → 7 log list (news) → 6 cta-strip | Editorial and slow: one breathing section between dense ones, at most one stat row, imagery over icons. |
| `docs` | 产品文档首页 | 1 hero-center with one search `.input` → 11 entry grid (3 or 6 destinations) → 9 split detail as quick start (steps, code in `<pre class="meta">`) → 7 log list (changelog) → 6 cta-strip (community / support) | Utilitarian and scannable. No stats, no testimonials, no marketing adjectives. |

Tone (`语气`) shapes copy, never the rules: `专业` — restrained, precise, third person; `亲切` — second person, warm microcopy; `活泼` — shorter, punchier lines and the one allowed flourish made a little bolder. Write page copy in the language of the creation message (usually Chinese) and set `<html lang="zh-CN">` for Chinese pages — the seed then switches headings to CJK leading.

## Workflow

### Step 0 — Pre-flight (once, before writing anything)

1. **Pick the output folder.** `slug` = short kebab-case ASCII derived from the title (e.g. `acme-launch`); if `design/<slug>/` already exists and is not this same page, append `-2`, `-3`… Everything for this page lives in `design/<slug>/` in the workspace.
2. **Read the design system.** Read `DESIGN.md` and `tokens.css` in the design system directory named in the creation message (relative to this skill's directory). If none is named, use `design-systems/neutral-modern`. When the two files disagree, `tokens.css` wins.
3. **Read `assets/template.html` end-to-end** — at minimum through the `<style>` block. The class inventory at the top of `references/layouts.md` lists every class that must be defined there; if one is missing, add it to `<style>` rather than re-defining it inline on every section.
4. **Read `references/layouts.md`** so you know which section skeletons exist. Don't write a section type that isn't covered — pick the closest layout and adapt.
5. **Skim `references/craft/`** (anti-ai-slop, color, typography). They apply on top of any design system.

### Step 1 — Prepare `index.html` from the seed

Copy `assets/template.html` to `design/<slug>/index.html`.

In its `:root`, replace the six colour variables (`--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`) and the three font variables (`--font-display`, `--font-body`, `--font-mono`) with the values from `tokens.css`. Keep the seed's derived, scale and spacing tokens; don't introduce new colour tokens. Replace the page `<title>` and the topnav brand.

### Step 2 — Visual directions (only when `先出视觉方向：是`)

1. Write 2–3 direction sketches to `design/<slug>/directions/<n>-<name>.html` (e.g. `1-quiet.html`). Each is a short self-contained page — topnav, hero and one signature section — built from the same seed and design system tokens. Directions must differ in composition, not just copy: hero layout (centered vs split), type scale and weight, imagery treatment, density and rhythm.
2. Screenshot each sketch to a PNG next to it (`<n>-<name>.png`, 1280×800), e.g. with a headless Chrome/Chromium: `--headless=new --screenshot=<abs png path> --window-size=1280,800 file://<abs html path>`. If no browser is available or the screenshot fails, skip the PNG.
3. Call `ask_group_members` with one `single` question (title like `选哪个视觉方向？`), one short Chinese option name per direction, `recommended` set to your pick, and `option_meta` aligned with the options by index: `description` — one sentence on what makes the direction distinct (≤ 120 chars); `image` — the workspace-relative PNG path (`design/<slug>/directions/1-quiet.png`), or the HTML path when there is no PNG.
4. Wait for the answer, then build the full page in the chosen direction. If someone answers with their own text, fold it in. If the question times out, use your recommended direction and say so in the final reply. This counts as your one question round.

### Step 3 — Plan the section list

Pick layouts before writing copy, following the rhythm of the template (table above). Adjust to the content you actually have — a missing input means a dropped section, not invented filler.

### Step 4 — Paste and fill

For each chosen layout, copy the `<section>` block from `layouts.md` into `<main id="content">`. Replace placeholder strings with real, specific copy from the brief. **No filler** — if a slot is empty, the section is the wrong choice; pick a different layout. Treat every `.ph-img` block as layout scaffolding and replace it when the section requires imagery, following the real-imagery rule below.

### Step 5 — Self-check

Run through `references/checklist.md` top to bottom. Every P0 item must pass before you publish. P1 items should pass; P2 are bonus.

### Step 6 — Publish and reply

1. Make sure `design/<slug>/index.html` and every asset it uses are in `design/<slug>/`.
2. Call the gonggong `preview_static` tool with `dir` = `design/<slug>` and `title` = the page title.
3. Reply with one short message: the file path, template and design system used, the section list in one line, and any assumptions or remaining placeholders. Do not paste the HTML into chat.

## Hard rules (the seed protects most of these — don't fight it)

- **Single accent, used at most twice per screen.** Eyebrow + primary CTA is the default budget.
- **Display font comes from the design system** (`--font-display`). Sans for body. Mono for numerics, captions, eyebrows.
- **Real imagery, never remote hotlinks.** `.ph-img` is temporary layout scaffolding, not the default final treatment. Prefer attachments from the creation message. For a named real-world referent, search/fetch the correct real image, copy it into `design/<slug>/`, and reference it by a relative path; never generate, draw, or invent a substitute. For illustrative or atmospheric subjects, prefer suitable fetched real photography and use image generation only as a fallback. If no compliant asset can be acquired, keep an intentional labeled `.ph-img` and say so in the final reply.
- **Preserve real-image geometry.** Inspect each acquired image's intrinsic width and height, replace the entire `.ph-img` scaffold with an `<img class="content-img">`, and set matching `width` and `height` attributes. Never copy `.ph-img`, `.wide`, `.portrait`, or `.square` onto a real image. Content images must show the full frame; `object-fit: cover` is only for intentionally croppable decorative fills.
- **Mobile reflow already works** via the seed's media query at 920px. Don't break it by adding fixed widths.
- **`data-section="<id>"` on every top-level `<section>`** (short, unique, kebab-case) so people can point at a section when they give feedback.
- **One file, no build step.** Inline CSS, no frameworks, no external scripts; forms are mocks without `action`.

## Output contract

```
design/<slug>/
├── index.html          ← the page
├── <images…>           ← referenced relatively, e.g. ./hero.jpg
└── directions/         ← only when directions were explored
```

Publish with `preview_static` (`dir` = `design/<slug>`), then one short reply. Nothing after.
