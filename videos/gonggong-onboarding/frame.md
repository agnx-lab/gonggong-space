# frame.md — 共工空间 · 浅色 Pane（沿用宣传片/讲解片视觉系统）

来源：用户已有视频 `../gonggong-explainer/assets/shared.css`（已复制到 `assets/shared.css`，`assets/shared.js` 为 GG 动作库）。不使用 frame preset：BRIEF 要求延续已有视觉。

## Colors
- canvas: #f5f5f7（浅灰底，macOS 气质）
- surface: #ffffff（白色圆角面板 / 截图卡）
- ink: #1d1d1f；ink2: #6e6e73；line: #e5e5ea；bubble: #f2f3f5
- accent: #0a7cff（systemBlue，唯一强调色）；accent-soft: #e6f0ff
- seal: #d23b2a（朱红，只用于圈注、印章、痛点）
- ok: #1f8f3f；warn: #c45f00
- section gradient: linear-gradient(135deg, #1739c9 0%, #1557d8 45%, #0d8f8b 100%)（步骤卡底）

## Typography
- display / body: system-ui, -apple-system, sans-serif；标题 800–900 字重
- mono: ui-monospace, Menlo, monospace（本片几乎不用：受众非技术）
- 标题 64–128px；正文 ≥ 26px；单行标题留 ≥10% 宽度余量

## Components
- .panel 白色圆角面板（22px，柔和蓝灰阴影）模拟界面；.screen 截图卡（macOS 三色点标题栏）
- .msg/.av/.who/.bb/.me/.at 飞书风聊天气泡；.chip(.g/.r/.y/.k) 状态标签
- .note 朱红圈注标签；.ring 朱红手绘圈
- .cameo 角色从舞台底边冒出 + .say 漫画气泡（3px 墨线 + 6px 硬阴影）
- 步骤卡：渐变底 + 大号「第 N 步」+ 标题 + 进度点

## Layout
- 1920×1080，30fps；左舞台 x 80–1200 放演示，右栏 x 1250–1860 放标题与要点；y 960 以下留给字幕；左上 y 40–90 HUD（步骤进度）

## Motion
- GSAP fromTo/to/set，确定性；入场 0.3–0.6s，power2/3.out、back.out(1.6) 用于弹出；无无限循环
