# NOTICE

本插件的 skill、模板、参考文档和设计系统改编自 [open-design](https://github.com/nexu-io/open-design)，
固定提交 `4f69a426689bbd471c8f0774c13378e651ae7de8`。

```
Copyright 2026 Open Design contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

`references/craft/*.md` 在上游即注明改编自 [refero_skill](https://github.com/referodesign/refero_skill)（MIT），署名保留在各文件开头。

## 来源文件

| 本插件 | 上游 |
|---|---|
| `skills/web-prototype/SKILL.md` | `design-templates/web-prototype/SKILL.md` |
| `skills/web-prototype/assets/template.html` | `design-templates/web-prototype/assets/template.html` |
| `skills/web-prototype/references/layouts.md`、`checklist.md` | `design-templates/web-prototype/references/` |
| `skills/web-prototype/references/craft/{anti-ai-slop,color,typography}.md` | `craft/` |
| `skills/web-prototype/design-systems/neutral-modern/` | `design-systems/default/`（改名） |
| `skills/web-prototype/design-systems/warm-editorial/` | `design-systems/warm-editorial/` |

## 本仓库的改动

- `SKILL.md` 重写：frontmatter 只保留 `name`、`description`；按 4 个模板（SaaS 落地页、活动报名页、品牌官网首页、产品文档首页）给出不同版式节奏；改为读取创作消息指定的设计系统目录下的 `DESIGN.md` 和 `tokens.css`（未指定用 `neutral-modern`），不再依赖注入系统提示词；输出改为写 `design/<slug>/index.html`、资源同目录相对引用、用 `preview_static` 发布后简短说明；新增「先出视觉方向」流程（`directions/` 草图 + `ask_group_members` 的 `option_meta`）和「缺必需信息最多问一轮」规则。
- `data-od-id` 改为 `data-section`。
- 删除 open-design 专用说法：`lint-artifact` 与 daemon 校验、`<artifact>` 块、OpenDesign 预览与评论模式、内部设计系统（kami）引用。
- `template.html`：改写头部注释；新增中文（`:lang(zh)`）标题与正文行高规则。
- `layouts.md`：新增 3 个版式（分栏详情、报名表单、入口网格），默认节奏改由 `SKILL.md` 的表格维护。
- `neutral-modern/tokens.css`：精简注释，取值不变。
- `warm-editorial/DESIGN.md`：色板对齐 `tokens.css` 并注明以 `tokens.css` 为准；去掉商业字体（GT Sectra、Söhne）与真实刊物名，改用 `tokens.css` 中的字体。
