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

`skills/web-prototype/craft/*.md` 在上游即注明改编自 [refero_skill](https://github.com/referodesign/refero_skill)（MIT），署名保留在各文件开头。

## 其他许可的内容

- `templates/aster-atelier/`：MIT（Aster Atelier template contributors），`LICENSE` 与 `ASSET-SOURCES.md` 原样保留在该目录。
- `templates/web-prototype-taste-{brutalist,editorial,soft}/`：上游改编自 [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill)（MIT），署名保留在各 `GUIDE.md`。

## 来源文件

| 本插件 | 上游 |
|---|---|
| `skills/web-prototype/SKILL.md` | 依据 `design-templates/web-prototype/SKILL.md` 重写为按模板路由的公共流程 |
| `skills/web-prototype/templates/<id>/` | `design-templates/<id>/`（`SKILL.md` 改写为 `GUIDE.md`，其余文件与 `example.html` 照搬） |
| `skills/web-prototype/templates/web-prototype/` | `design-templates/web-prototype/`（saas、event、brand、docs 四个模板共用） |
| `skills/web-prototype/references/critique.md` | `plugins/_official/atoms/critique-theater/SKILL.md` |
| `skills/web-prototype/craft/` | `craft/` |
| `skills/web-prototype/design-systems/<id>/` | `design-systems/<id>/` 的 `DESIGN.md`、`tokens.css`（`neutral-modern` 来自 `default`） |
| `previews/*.webp` | 由各模板 `example.html` 截图生成 |

## 本仓库的改动

- 入口 `SKILL.md`：按模板 id 路由到 `templates/<id>/GUIDE.md`；读取创作消息指定的设计系统目录（未指定用 `neutral-modern`），不依赖注入系统提示词；输出写 `design/<slug>/index.html`，用 `preview_static` 发布；「先出视觉方向」与「缺必需信息最多问一轮」规则；发布前做五维自审（`references/critique.md`）。
- 各模板 `GUIDE.md`：去掉 frontmatter，`od.craft.requires` 改为开头的 Craft 一行；`data-od-id` 改为 `data-section`；删除 open-design 专用说法（`<artifact>` 块、lint 与 daemon 校验、评论/调参模式、`OD_*`、live-artifact、内部 kami 设计系统）；作为身份描述的真实品牌名改为通用说法；依赖实时数据的模板改为内联模拟数据。
- 未收录：幻灯片、视频、音频、图片类模板；依赖 open-design 运行时的模板（live-artifact、tweaks 等）；`dcf-valuation`（上游改编来源无许可证）、`kami-landing`（示例为 open-design 自身宣传）、仿真实产品界面的 `orbit-{github,gmail,linear,notion}`；品牌类设计系统（无商标授权）。
- 设计系统：上游 `tokens.css` 多为同一模板生成、与 `DESIGN.md` 不一致，已按各自 `DESIGN.md` 重定配色（各套互不相同，正文对比度 ≥ 4.5）；商业字体换为开源字体并补中文回退；去掉品牌来源说法。`neutral-modern`、`warm-editorial` 沿用 0.1.0 的改编版。
- `template.html`（web-prototype）：改写头部注释；新增中文（`:lang(zh)`）标题与正文行高规则。`layouts.md` 新增 3 个版式（分栏详情、报名表单、入口网格）。
