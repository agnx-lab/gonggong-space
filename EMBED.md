# 共工空间 · Agnx 子应用

## 上游嵌入

- 工作方式：整仓魔改（主流）。真树在 `~/.agnx-dev/apps/gonggong`（从下载目录整棵移入，宿主只扫描 `apps/<appId>/`）。
- 推荐模式：Wrap + Sidecar。Tab 里是上游 `apps/web`；Postgres、Fastify、Vite 由 daemon 托管，不另开桌面壳。
- 挂载：`guest.auth=none` / 策略=`direct-iframe`（登录在上游页面里完成，cookie 落在 Vite 源上；没有启动 `?token=`）
- 上游：https://github.com/yoqu/gonggong-space （本目录是解压树，没有 `.git`）
- Port 切片：无。只加 `.agnx/` 胶水。
- 默认值：Web `5173`，API `8787`，本机库 `54339`，初始管理员 `admin` / `gonggong`（仅空库第一次启动；登录后上游会要求改密码）

打开子应用后看到的是共工自己的群聊界面。Tauri 桌面壳和 Rust `gg` 不在这个 Tab 里启动；要让 Bot 在某台机器上干活，仍用页面里的「绑定新机器」命令，在那台机器上运行已安装的 `gg`。

## 嵌页宿主能力缺口

| 上游能力          | 信号位置                                      | 嵌后风险                                       | 处置 (A–E)                  | 主路径 | 备注                                           |
| ----------------- | --------------------------------------------- | ---------------------------------------------- | --------------------------- | ------ | ---------------------------------------------- |
| 登录 / 群聊主界面 | `apps/web` cookie `gonggong_session`          | 直接嵌 loopback 时与 Vite 同源，cookie 可用    | 不需要桥。`guest.auth=none` | 是     | 登录表单就在上游 UI                            |
| 上传图片和文件    | `input type=file`、粘贴 `clipboardData.files` | 浏览器文件选择可用，不需要绝对路径             | D                           | 是     | 不走宿主选目录                                 |
| 复制文字          | `apps/web/src/lib/clipboard.ts`               | `http://127.0.0.1` 是安全上下文                | D                           | 否     | 上游已有 textarea 回退                         |
| 浏览器通知        | `Notification.requestPermission`              | iframe 里可能被拦                              | D                           | 否     | 不接系统通知                                   |
| 绑定机器 / `gg`   | Web 复制 `gg login`；桌面是 Tauri             | Tauri 不能整嵌；本切片不编译 `crates/gonggong` | D                           | 是     | 主界面仍是 Web。不要用「打开共工.app」代替 Tab |
| 选目录 / 另存为   | 上游 Web 未使用系统对话框                     | 无                                             | 无缺口                      | 否     |                                                |
| 数据库            | `scripts/pg.sh`、`GONGGONG_DATABASE_URL`      | 嵌页不选目录                                   | A 详情配置                  | 是     | 默认同机起库；也可填外部 URL                   |

## 本机前置

- Node.js 24+（启动器会找 nvm 里的 v24）
- `corepack pnpm install`（在本目录）
- 不填外部数据库时，需要本机 `pg_ctl`（PostgreSQL 16+）
