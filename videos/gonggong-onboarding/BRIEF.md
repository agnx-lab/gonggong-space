---
workflow: product-launch-video
flow: automation
storyboard: yes
message: "需求不用再层层转述：在群里直接 @ AI 同事，它在同事的电脑上把活干完，你看预览、点批准就行"
destination: internal-training
aspect: 1920x1080
language: zh
audience: "公司里不懂技术的同事：产品、运营、设计、数据分析等"
length: 150-180s
angle: telephone-game-to-ai-coworker
---

## Intent

用户原话：「查看我飞书云文档前天我组织培训的会议纪要，并基于当前仓库和我之前做的一些视频，我要重新制作宣传视频，让公司里面其他不懂技术的同事都能看明白，上手使用，进行团队协作。」

选定概念（5+2 混搭）：
- 开场「传话游戏」：一句「把按钮改成蓝色」经过 4 个人传成「重做首页」，点出跨角色转述需求的损耗（纪要金句痛点），引出「直接告诉 AI」。
- 主体「招一位 AI 新同事」：用 HR 入职类比讲上手 6 步——登录（飞书一键登录）→ 分工位（添加机器，下载客户端绑定自己的电脑）→ 招聘（建 Bot，写岗位职责）→ 拉进项目群 → 派活（@Bot）→ 要签字找你（审批）→ 交付（预览链接分享）。
- 收尾：飞书群里也能直接 @Bot；有问题在 AI 群反馈；号召行动。

## Assets

- ../../website/public/screenshots/web/*.webp — 真实界面截图（所有功能实证镜头）
- ../gonggong-explainer/assets/cast/*.svg — 共字君与 12 性格角色静态形象
- ../gonggong-explainer/assets/logo.svg — 品牌 Logo
- 入口：https://ai.ludoukj.com/ ；客户端在网页「添加机器」时直接下载

## Customizations

- 配音沿用讲解片 MiniMax 声音：解说 Reliable_Executive，共字君 Cute_Spirit，其他角色按需（铁码 male-qn-badao、反推 male-qn-qingse）。
- 全片中文字幕；配乐与音效。
- 视觉沿用宣传片/讲解片浅色 Pane 风格（macOS + 飞书 IM 气质，强调蓝 #0a7cff，朱红只用于圈注/印章）。

## Notes

- 来源：2026-10-10 培训会议纪要「AI团队协作工具功能分享」（飞书云文档）。
- 不讲激励机制。不讲小程序预览等待定扩展能力；不讲 LookHome 等不接入的系统。
- 受众零技术背景：不出现 git、diff、分支、命令行、终端、token 等词；「工作区」讲成「Bot 能动的文件夹」，「审批」讲成「越界要你签字」。
- 每步配非技术场景：改活动页文案、出原型给领导看、整理周报/数据。
- 关键安全点要讲：活在自己电脑上执行；Bot 只在自己划定的范围里干活，越界要主人批；没进群的 Bot 只有自己看得到。
- 前提要讲：电脑要开机联网，Bot 才在线。
- 只讲已核实功能，以 website/ 帮助手册为准，不夸大。
