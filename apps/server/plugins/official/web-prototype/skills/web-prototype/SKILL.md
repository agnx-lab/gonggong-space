---
name: web-prototype
description: >-
  Build a self-contained HTML product prototype — marketing pages, product/admin screens, mobile app screens,
  wireframes, documents and reports, social assets — from a bundled per-template guide, seed and example plus a
  design system, write it to design/<slug>/index.html in the workspace and publish it with preview_static. Use
  when a creation request names this plugin, or when someone asks for a landing page, homepage, dashboard,
  admin screen, app screen, mobile mockup, wireframe, web mockup, prototype or a designed HTML document.
---

# Product Prototype Skill

Produce one self-contained HTML prototype. Every template has its own guide, and most ship a seed, layout library or finished example — compose from those, **not** from scratch.

## Resource map

All paths are relative to this skill's directory.

```
web-prototype/
├── SKILL.md                    ← you're reading this (shared workflow)
├── templates/<id>/GUIDE.md     ← per-template instructions (+ assets/, references/, example.html)
├── design-systems/<id>/        ← DESIGN.md + tokens.css
├── craft/                      ← cross-template craft rules (anti-ai-slop, color, typography, accessibility…)
└── references/critique.md      ← five-dimension self-review before publishing
```

## What the creation message gives you

A creation request is a chat message that @-mentions you. It names:

- the **template** id (possibly with its Chinese title);
- the **design system directory**, e.g. `design-systems/warm-editorial`;
- whether to explore visual directions first — `先出 2–3 个视觉方向：是` / `否`;
- parameters as `label：value` lines: `主题` (title, required), `内容要点` (points), `目标受众` (audience), `语气` (tone: `专业` / `亲切` / `活泼`);
- optionally attachments (logos, screenshots, photos, copy, data) — use them, they beat anything you would fetch or invent.

A plain request without this structure is fine too: pick the closest template from the index below, use `design-systems/neutral-modern`, and do not explore directions.

## Template index

The guide for template `<id>` is `templates/<id>/GUIDE.md`, except `saas`, `event`, `brand` and `docs`, which share `templates/web-prototype/GUIDE.md`.

<!-- TEMPLATE-INDEX -->
**营销网页**
- `saas` SaaS 落地页 — 产品首屏、核心功能、数据或口碑、价格对比，以行动按钮收尾
- `event` 活动报名页 — 时间地点、议程、适合谁来，页面以报名表单收尾
- `brand` 品牌官网首页 — 品牌主张、品牌故事、产品线与动态，留白多、节奏舒缓
- `docs` 产品文档首页 — 搜索、文档入口、快速开始与更新日志，信息清晰好扫读
- `web-prototype-taste-brutalist` 瑞士印刷粗野风官网 — 新闻纸底色、超大黑体数字与细线网格、警示红点缀的宣言式单页官网。
- `web-prototype-taste-editorial` 编辑极简风官网 — 暖白底、衬线标题配无衬线正文、细线便当格与柔和标签的高端产品官网。
- `web-prototype-taste-soft` 柔和高级感官网 — 银灰或奶油底、大圆角双层卡片、悬浮胶囊导航与弹性动效的精致产品官网。
- `saas-landing` SaaS 产品落地页 — 首屏、功能卡片、客户背书、价格方案与收尾行动区齐全的 SaaS 单页官网。
- `waitlist-page` 预约候补页 — 品牌标识加一个邮箱表单的上线前预约页，克制装饰、无倒计时与虚假背书。
- `pricing-page` 价格方案页 — 套餐卡片、功能对比表与常见问题折叠的独立定价页，突出推荐档位。
- `aster-atelier` 古典艺术工作室官网 — 钴蓝天空古典油画、优雅衬线与电影感滚动的创意工作室官网，含点云星仪动画。
- `dating-web` 婚恋社区数据看板 — 报刊专栏气质的婚恋产品看板：侧栏导航、滚动快讯、指标格与 30 天柱状图。
- `docs-page` 产品文档页 — 左侧导航、中间正文、右侧目录的三栏文档页，含代码块、提示框与表格，支持 RTL。
- `blog-post` 博客长文页 — 杂志式长文：报头、大标题、配图占位、引语与图注，文末作者介绍和相关文章。

**产品界面**
- `dashboard` 数据后台 — 管理/数据分析后台：固定侧栏、顶栏搜索、KPI 卡片行加内联 SVG 折线或柱状图与明细表。
- `kanban-board` 任务看板 — 冲刺任务看板：待办/进行中/评审/完成四列卡片，成员头像、筛选栏与冲刺进度侧栏。
- `github-dashboard` 代码仓库数据看板 — 单个代码仓库的增长与健康看板：Star/Fork/贡献者/Issue/PR 指标、增长图、近期动态与贡献者榜。
- `social-media-dashboard` 社媒数据仪表盘 — 创作者社媒分析页：平台切换卡、粉丝/互动率 KPI、增长曲线、本周爆款帖、热门话题与精选评论。
- `flowai-live-dashboard-template` 团队管理后台 — 可交互团队管理后台：成员/详情/动态三页签、成员表、角色分布图、在线曲线，支持暗色与导出 CSV。
- `orbit-general` 跨工具每日简报 — 汇总代码、任务、文档、日历、邮件等工具前一天动态的编辑风便当格简报，含时间轴与待办 Top 3。
- `contact-widget` 在线咨询挂件 — 网站右下角悬浮咨询挂件：欢迎页、在线状态、社交链接、预约会议卡与离线留言表单，纯前端。
- `team-okrs` 团队 OKR — 季度 OKR 追踪页：季度横幅、三个目标及关键结果进度条、负责人与状态标签、概览侧栏。
- `pm-spec` 产品需求文档 — 单页 PRD：摘要、问题、目标与非目标、成功指标表、用户故事、里程碑与待决问题。
- `webgl-experience` WebGL 视觉体验 — 全屏实时 WebGL 着色器/3D/粒子视觉，叠加简洁排版标题，单文件零外部请求。
- `worker-visualizer` 多线程粒子可视化 — 把粒子模拟、分形等重计算放进 Web Worker 的实时画布可视化，带 HUD 统计。

**移动应用**
- `mobile-app` 手机 App 界面 — 套在逼真手机外框里的单屏 App 界面：信息流、详情、引导、个人页、结算或专注卡六选一。
- `mobile-onboarding` App 引导流程 — 三台手机并排展示的引导流程：启动页、价值介绍、登录/注册选项，含分页点与主按钮。
- `gamified-app` 游戏化 App — 暗色展台上三台手机的游戏化应用原型：封面海报、今日任务与经验等级、任务详情。

**线框图**
- `wireframe-greybox` 灰盒线框图 — 低保真灰盒蓝图：灰色色块、打叉图片占位、文字条，单一强调色的等宽标注，适合后台仪表盘结构草图。
- `wireframe-annotated` 标注线框图 — 浏览器框内的落地页灰盒线框，叠加编号标注点，右侧规格面板逐条写工程与交互说明。
- `wireframe-sketch` 手绘草图线框 — 方格纸上的手绘风线框：马克笔字体、多方案页签、阴影填充图表占位和便利贴批注。
- `wireframe-mobile-flow` 移动端流程线框 — 一排手机框展示 App 用户流程，屏内灰盒内容，屏间虚线箭头配编号步骤和便签批注。

**文档报告**
- `eng-runbook` 运维手册 — 服务运维手册：服务概览、告警表、看板链接、可复制命令的常用操作、值班表和故障响应清单。
- `finance-report` 财务报告 — 季度或月度财报：KPI 卡片、营收趋势与成本图表、损益摘要表、重点客户表和展望段落。
- `invoice` 发票账单 — 可打印的发票页：收付款方信息、明细表、税费与合计、付款方式和签名栏。
- `hr-onboarding` 新员工入职计划 — 单页入职计划：首日日程、首周时间线、30/60/90 天里程碑、资源清单和到位检查表。
- `meeting-notes` 会议纪要 — 会议纪要页：标题与参会人、议程清单、决议面板、带负责人和截止日的行动项表及下次会议。
- `clinical-case-report` 临床病例报告 — 结构化病例汇报（SOAP、学术会议或查房简报格式），含生命体征与检验表、鉴别诊断和分问题诊疗计划，可打印。
- `digital-eguide` 电子指南 — 两页并排的电子指南预览：封面含标题、数据与目录，内页含正文、步骤列表、引语和练习框，杂志感排版。

**社媒与物料**
- `email-marketing` 新品发布邮件 — 居中单栏营销邮件：报头、产品主图、倾斜强调大标题、唯一按钮与参数格。
- `magazine-poster` 杂志报纸海报 — 新闻纸质感长海报：超大衬线标题含删除线与斜体强调，六格编号观点。
- `social-carousel` 社媒三连图 — 三张 1080 方图组成一句话的电影感社媒轮播，渐变模拟画面，配编号与说明。
- `motion-frames` 动态海报帧 — 16:9 循环动效画面：旋转文字环、线框地球与大标题，纯 CSS，可录成视频。
- `sprite-animation` 像素动画讲解帧 — 复古像素风讲解画面：大号年份、像素角色、日文动态字与时间轴，纯 CSS 循环。
<!-- /TEMPLATE-INDEX -->

## Interaction rules

- **Ask at most one round, only when required information is missing.** The only hard requirement is a subject (the title, or a product/screen/event/brand name you can derive one from). If it is missing and cannot be inferred from the message or attachments, call `ask_group_members` once with every open question in that single call (≤ 4). After that round — answered or timed out — proceed with your best judgement and list the assumptions in your final reply. Never ask a second round.
- **Otherwise go straight to the draft.** Do not ask for confirmation of the plan, colours or copy.
- **Visual directions first, only when the message says `是`.** See Step 2.

Tone (`语气`) shapes copy, never the rules: `专业` — restrained, precise, third person; `亲切` — second person, warm microcopy; `活泼` — shorter, punchier lines and the one allowed flourish made a little bolder. Write page copy in the language of the creation message (usually Chinese) and set `<html lang="zh-CN">` for Chinese pages.

## Workflow

### Step 0 — Pre-flight (once, before writing anything)

1. **Pick the output folder.** `slug` = short kebab-case ASCII derived from the title (e.g. `acme-launch`); if `design/<slug>/` already exists and is not this same page, append `-2`, `-3`… Everything for this page lives in `design/<slug>/` in the workspace.
2. **Read the template guide** `templates/<id>/GUIDE.md` and every file it tells you to read first (seed, layouts, craft docs). If the template folder has an `example.html`, open it: it is a finished example of the template — study its structure, density and finish, never copy its copy.
3. **Read the design system.** `DESIGN.md` and `tokens.css` in the directory named in the creation message. When the two disagree, `tokens.css` wins. Map its colours and fonts onto the seed's `:root` variables (or, without a seed, declare them once in `:root` and use only `var(--…)` afterwards). Templates whose guide says the design system is optional (wireframes) take only accent and fonts from it.
4. **Skim `craft/anti-ai-slop.md`** — it applies to every template.

### Step 1 — Build

Follow the template guide. Where the guide and this file disagree on *what to build*, the guide wins; on *where to write and how to publish*, this file wins.

### Step 2 — Visual directions (only when asked)

1. Write 2–3 direction sketches to `design/<slug>/directions/<n>-<name>.html` (e.g. `1-quiet.html`). Each is a short self-contained page — the template's chrome plus its first screen and one signature section — built from the same seed and design system tokens. Directions must differ in composition, not just copy: layout, type scale and weight, imagery treatment, density and rhythm.
2. Screenshot each sketch to a PNG next to it (`<n>-<name>.png`, 1280×800; 430×932 for mobile templates), e.g. with headless Chrome/Chromium: `--headless=new --screenshot=<abs png path> --window-size=1280,800 file://<abs html path>`. If no browser is available or the screenshot fails, skip the PNG.
3. Call `ask_group_members` with one `single` question (title like `选哪个视觉方向？`), one short Chinese option name per direction, `recommended` set to your pick, and `option_meta` aligned with the options by index: `description` — one sentence on what makes the direction distinct (≤ 120 chars); `image` — the workspace-relative PNG path (`design/<slug>/directions/1-quiet.png`), or the HTML path when there is no PNG.
4. Wait for the answer, then build the full page in the chosen direction. If someone answers with their own text, fold it in. If the question times out, use your recommended direction and say so in the final reply. This counts as your one question round.

### Step 3 — Critique

Run `references/critique.md` (it starts with the template's own checklist when there is one) and fix what it finds before publishing.

### Step 4 — Publish and reply

1. Make sure `design/<slug>/index.html` and every asset it uses are in `design/<slug>/`.
2. Call the gonggong `preview_static` tool with `dir` = `design/<slug>` and `title` = the page title.
3. Reply with one short message: the file path, template and design system used, the structure in one line, what the critique fixed, and any assumptions or remaining placeholders. Do not paste the HTML into chat.

## Hard rules

- **Tokens only.** Every colour and font comes from the design system's `tokens.css` via CSS variables. Single accent, used sparingly (the guide sets the budget).
- **Real content.** Specific copy from the brief and attachments; no lorem, "Feature One", "Metric A", invented testimonials, customer logos or awards. Mock data in product screens must be plausible and consistent (numbers add up, dates line up).
- **Real imagery, never remote hotlinks.** `.ph-img` is temporary layout scaffolding, not the default final treatment. Prefer attachments from the creation message. For a named real-world referent, search/fetch the correct real image, copy it into `design/<slug>/`, and reference it by a relative path; never generate, draw, or invent a substitute. For illustrative or atmospheric subjects, prefer suitable fetched real photography and use image generation only as a fallback. If no compliant asset can be acquired, keep an intentional labeled placeholder and say so in the final reply. Product UI icons and charts are inline SVG.
- **Preserve real-image geometry.** Set `width`/`height` to the image's intrinsic size; content images show the full frame; `object-fit: cover` only for intentionally croppable decorative fills.
- **`data-section="<id>"` on every top-level region** (short, unique, kebab-case) so people can point at a part when they give feedback. When someone later asks to change one part, edit only that region and keep the rest byte-for-byte.
- **One file, no build step.** Inline CSS (and inline JS only when the template calls for interaction), no frameworks, no CDN scripts or fonts outside what `tokens.css` declares; forms are mocks without `action`.

## Output contract

```
design/<slug>/
├── index.html          ← the prototype
├── <images…>           ← referenced relatively, e.g. ./hero.jpg
└── directions/         ← only when directions were explored
```

Publish with `preview_static` (`dir` = `design/<slug>`), then one short reply. Nothing after.
